const EventEmitter = require('events');
const _ = require('lodash');
const instancesFactory = require('./Factory');
const ServiceInstances = require('./ServiceInstances');
const WatchError = require('./Error').WatchError;
const AlreadyInitializedError = require('./Error').AlreadyInitializedError;
const NotInitializedError = require('./Error').NotInitializedError;

const DEFAULT_TIMEOUT_MSEC = 5000;
const HEALTH_FALLBACK_INTERVAL_MSEC = 1000;
const DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC = 1000;

/**
 * Single node data
 *
 * @typedef {Object} ServiceInstancesMonitor~ConsulHealthyNode
 * @property {string} serverId - the id of the server
 */

/**
 * Event is emmitted when something happens
 *
 * @event ServiceInstancesMonitor#initialized
 * @param {Array.<ServiceInstancesMonitor~ConsulHealthyNode>} data - The data.
 */

/**
 * @emits ServiceInstancesMonitor#initialized
 * @emits ServiceInstancesMonitor#changed
 * @emits ServiceInstancesMonitor#error
 * @emits ServiceInstancesMonitor#healthy
 * @emits ServiceInstancesMonitor#unhealthy
 */
class ServiceInstancesMonitor extends EventEmitter {

    /**
     * @param {Object} options
     * @param {string} options.serviceName -  name of service in consul to monitor
     * @param {string} options.checkNameWithStatus
     * @param {number} [options.timeoutMsec=5000] - connection timeout to consul
     * @param {boolean} [options.autoReconnect=true] - enable auto reconnect on watcher end
     * @param {Consul} consul
     * @param {Object} extractors
     * @throws {TypeError} On invalid options format
     * @public
     */
    constructor(options, consul, extractors) {
        super();

        if (!_.isPlainObject(options)) {
            throw new TypeError('options must be an object');
        }

        if (!_.has(options, 'serviceName') || !_.isString(options.serviceName) || _.isEmpty(options.serviceName)) {
            throw new TypeError('options.serviceName must be set and be a non-empty string');
        }

        if (!_.has(options, 'checkNameWithStatus') ||
            !_.isString(options.checkNameWithStatus) ||
            _.isEmpty(options.checkNameWithStatus)
        ) {
            throw new TypeError('options.checkNameWithStatus must be set and be a non-empty string');
        }

        if (!_.has(options, 'timeoutMsec')) {
            this._timeoutMsec = DEFAULT_TIMEOUT_MSEC;
        } else {
            if (!_.isSafeInteger(options.timeoutMsec) || options.timeoutMsec <= 0) {
                throw new TypeError('options.timeoutMsec must be a positive integer if set');
            }

            this._timeoutMsec = options.timeoutMsec;
        }

        // duck typing check
        if (!_.isObject(consul) || !_.isFunction(consul.watch) ||
            !_.isObject(consul.health) || !_.isFunction(consul.health.service)
        ) {
            throw new TypeError('consul argument does not look like Consul object');
        }

        if (_.isPlainObject(extractors)) {
            for (const extractorName in extractors) {
                if (!extractors[extractorName] || !_.isFunction(extractors[extractorName].extract)) {
                    throw new TypeError('extractors instances must have a method "extract"');
                }
            }
        } else if (extractors !== undefined) {
            throw new TypeError('extractors argument must be an plain object or undefined');
        }

        this._serviceName = options.serviceName;
        this._checkNameWithStatus = options.checkNameWithStatus;
        this._initialized = false;

        this._consul = consul;
        this._extractors = extractors;

        this._onWatcherChange = this._onWatcherChange.bind(this);
        this._onWatcherError = this._onWatcherError.bind(this);
        this._onWatcherEnd = this._onWatcherEnd.bind(this);
        this._retryStartService = this._retryStartService.bind(this);

        this._serviceInstances = new ServiceInstances();
        this._watchAnyNodeChange = null;
        this._setWatchUnealthy();
        this._setUninitialized();

        this._fallbackToWatchHealthyInterval = null;
        this._retryTimer = null;
    }

    isWatchHealthy() {
        return this._isWatchHealthy;
    }

    _setWatchHealthy() {
        this._isWatchHealthy = true;
    }

    _setWatchUnealthy() {
        this._isWatchHealthy = false;
    }

    isInitialized() {
        return this._initialized;
    }

    _setInitialized() {
        this._initialized = true;
    }

    _setUninitialized() {
        this._initialized = false;
    }

    _isWatcherRegistered() {
        return this._watchAnyNodeChange !== null;
    }

    getInstances() {
        return this._serviceInstances;
    }

    /**
     * Starts service and resolves promise with initial list of nodes that provide the service, "change" or "error"
     * events will not be emited
     *
     * Listens for changes after successful resolve.
     *
     * Promise will be rejected with:
     *   `AlreadyInitializedError` if service is already started.
     *   `WatchError` on error from `consul` underlying method
     *
     * Rejection of promise means that watcher was stopped and no retries will be done.
     *
     * @returns {Promise<ServiceInstances,AlreadyInitializedError|WatchError>}
     * @public
     */
    startService() {
        if (this._isWatcherRegistered()) {
            return Promise.reject(new AlreadyInitializedError('Service is already started'));
        }

        return this._registerWatcherAndWaitForInitialNodes()
            .then(initialListOfNodes => {
                this._watchAnyNodeChange.on('change', this._onWatcherChange);
                this._watchAnyNodeChange.on('error', this._onWatcherError);
                this._watchAnyNodeChange.on('end', this._onWatcherEnd);

                this._setInitialized();
                this._setWatchHealthy();
                this._serviceInstances = initialListOfNodes;
                return initialListOfNodes;
            });
    }

    /**
     * Stops service even if it is not started yet. Monitor becomes `uninitialized` and `unhalthy`.
     *
     * Listens for changes after successful resolve.
     *
     * Promise will be rejected with:
     *   `AlreadyInitializedError` if service is already started.
     *   `WatchError` on error from `consul` underlying method
     *
     * Rejection of promise means that watcher was stopped and no retries will be done.
     *
     * @returns {ServiceInstancesMonitor}
     * @public
     */
    stopService() {
        if (this._retryTimer !== undefined) {
            clearTimeout(this._retryTimer);
            this._retryTimer = null;
        }

        if (!this._isWatcherRegistered()) {
            return this;
        }

        // we need to remove listener to prevent emitting of `end` event after stop of watcher
        this._watchAnyNodeChange.removeListener('end', this._onWatcherEnd);
        this._watchAnyNodeChange.end();
        this._watchAnyNodeChange = null;
        this._unsetFallbackToWatchHealthy();
        this._setUninitialized();
        this._setWatchUnealthy();

        return this;
    }

    /**
     * Returns unix timestamp when last success response was received from consul
     *
     * @returns {number}
     * @throws {NotInitializedError} On not started service
     * @public
     */
    getUpdateTime() {
        if (!this._isWatcherRegistered()) {
            throw new NotInitializedError('Service is not started');
        }

        return this._watchAnyNodeChange.updateTime();
    }

    /**
     * Registers `consul.watch` and assigns watcher to `this._watchAnyNodeChange` and waits for the
     * first successful response from consul with list of healthy nodes that provide the service.
     * On successful response resolves promise with array of healthy nodes (it may be empty). Method doesn't
     * add listener for `change` event.
     *
     * Promise will be rejected with:
     *   `AlreadyInitializedError` if another `consul.watch` execution is found.
     *   `WatchError` on error from `consul` underlying method
     *
     * Rejection of promise means that watch was stopped and `this._watchAnyNodeChange` was cleared.
     *
     * @returns {Promise<ServiceInstances,AlreadyInitializedError|WatchError>}
     * @private
     */
    _registerWatcherAndWaitForInitialNodes() {
        return new Promise((resolve, reject) => {
            if (this._watchAnyNodeChange !== null) {
                return reject(new AlreadyInitializedError('Another `consul.watch` execution is found'));
            }

            this._watchAnyNodeChange = this._consul.watch({
                method: this._consul.health.service,
                options: {
                    service: this._serviceName,
                    wait: '60s',
                    timeout: this._timeoutMsec
                },
            });

            const firstChange = (data) => {
                this._watchAnyNodeChange.removeListener('error', firstError);

                const {instances, errors} = instancesFactory.buildServiceInstances(
                    data,
                    this._checkNameWithStatus,
                    this._extractors
                );

                if (!_.isEmpty(errors)) {
                    this._emitFactoryErrors(errors);
                }

                resolve(instances);
            };

            const firstError = (err) => {
                this._watchAnyNodeChange.removeListener('change', firstChange);
                this._watchAnyNodeChange.end();
                this._watchAnyNodeChange = null;
                reject(new WatchError(err.message, {err}));
            };

            this._watchAnyNodeChange.once('change', firstChange);
            this._watchAnyNodeChange.once('error', firstError);
        });
    }

    /**
     * This method receives list of a valid nodes sent by `consul.watch` in `consul` format. Performs
     * validation of response format.
     *
     * If service was unhealthy, it becomes healthy.
     *
     * @param {Array} data - list of healthy nodes after some changes
     * @emits ServiceInstancesMonitor#changed actual array of a valid nodes
     * @private
     */
    _onWatcherChange(data) {
        if (!this.isWatchHealthy()) {
            this._setWatchHealthy();
            this.emit('healthy');
        }

        const {instances, errors} = instancesFactory.buildServiceInstances(
            data,
            this._checkNameWithStatus,
            this._extractors
        );

        this._serviceInstances = instances;
        this.emit('changed', instances);

        if (!_.isEmpty(errors)) {
            this._emitFactoryErrors(errors);
        }
    }

    _onWatcherError(err) {
        this._unsetFallbackToWatchHealthy();

        if (this.isWatchHealthy()) {
            this._setWatchUnealthy();
            this.emit('unhealthy');
        }

        this._setFallbackToWatchHealthy();

        this.emit('error', new WatchError(err.message, { err }));
    }

    _onWatcherEnd() {
        this._setUninitialized();
        this._setWatchUnealthy();
        this._watchAnyNodeChange.removeAllListeners();
        this._watchAnyNodeChange = null;
        this.emit('unhealthy');
        this._retryStartService();
    }

    _emitFactoryErrors(errors) {
        setImmediate(() => {
            errors.forEach(error => this.emit.call(this, 'error', error));
        });
    }

    _setFallbackToWatchHealthy() {
        if (this._fallbackToWatchHealthyInterval) {
            this._unsetFallbackToWatchHealthy();
        }

        const initialUpdateTime = this._watchAnyNodeChange.updateTime();

        this._fallbackToWatchHealthyInterval = setInterval(() => {
            const isWatcherRunning = this._isWatcherRegistered() && this._watchAnyNodeChange.isRunning();

            if (!isWatcherRunning || this.isWatchHealthy()) {

                // watcher is currently ends or becomes `healthy`, unset fallback interval',
                this._unsetFallbackToWatchHealthy();

                return;
            }

            const lastUpdateTime = this._watchAnyNodeChange.updateTime();

            if (initialUpdateTime !== lastUpdateTime) {
                this._unsetFallbackToWatchHealthy();

                this._setWatchHealthy();
            }

        }, HEALTH_FALLBACK_INTERVAL_MSEC);
    }

    _unsetFallbackToWatchHealthy() {
        clearInterval(this._fallbackToWatchHealthyInterval);

        this._fallbackToWatchHealthyInterval = null;
    }


    async _retryStartService() {
        try {
            const serviceInstances = await this.startService();
            this._serviceInstances = serviceInstances;

            this.emit('healthy');
            this.emit('changed', serviceInstances);
        } catch (err) {
            setImmediate(() => this.emit('error', err));

            this._retryTimer = setTimeout(this._retryStartService, DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC);
        }
    }
}

module.exports = ServiceInstancesMonitor;
