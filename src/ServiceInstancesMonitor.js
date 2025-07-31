const EventEmitter = require('events');
const _ = require('lodash');
const instancesFactory = require('./Factory');
const ServiceInstances = require('./ServiceInstances');
const WatchError = require('./Error').WatchError;
const WatchTimeoutError = require('./Error').WatchTimeoutError;
const AlreadyInitializedError = require('./Error').AlreadyInitializedError;

const DEFAULT_TIMEOUT_MSEC = 5000;
const HEALTH_FALLBACK_INTERVAL_MSEC = 1000;
const DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC = 1000;
const X_CONSUL_HEADERS = ['x-consul-index', 'x-consul-knownleader', 'x-consul-lastcontact'];

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
     * @param {Consul} consul
     * @param {Object} extractors
     * @throws {TypeError} On invalid options format
     * @public
     */
    constructor(options, consul, extractors = undefined) {
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

        if (_.has(options, 'dc') && (!_.isString(options.dc) || _.isEmpty(options.dc))) {
            throw new TypeError('options.dc must be a non-empty string');
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
        this._dc = options.dc;
        this._initialized = false;

        this._consul = consul;
        this._extractors = extractors;

        this._onWatcherChange = this._onWatcherChange.bind(this);
        this._onWatcherError = this._onWatcherError.bind(this);
        this._onWatcherEnd = this._onWatcherEnd.bind(this);
        this._retryStartService = this._retryStartService.bind(this);

        this._serviceInstances = new ServiceInstances();
        this._consulHeaders = {};
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

    getConsulHeaders() {
        return this._consulHeaders;
    }

    /**
     * Starts service and resolves promise with initial list of nodes that provide the service, "change" or "error"
     * events will not be emited
     *
     * Listens for changes after successful resolve.
     *
     * Promise will be rejected with:
     *   `AlreadyInitializedError` if service is already started.
     *   `WatchTimeoutError` if either initial data nor error received for timeotMsec or default timeout.
     *   `WatchError` on error from `consul` underlying method
     *
     * Rejection of promise means that watcher was stopped and no retries will be done.
     *
     * @returns {Promise<ServiceInstances,AlreadyInitializedError|WatchError|WatchTimeoutError>}
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
        if (this._retryTimer !== null) {
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
     * Registers `consul.watch` and assigns watcher to `this._watchAnyNodeChange` and waits for the
     * first successful response from consul with list of healthy nodes that provide the service.
     * On successful response resolves promise with array of healthy nodes (it may be empty). Method doesn't
     * add listener for `change` event.
     *
     * Promise will be rejected with:
     *   `AlreadyInitializedError` if another `consul.watch` execution is found.
     *   `WatchTimeoutError` if either initial data nor error received for 5000 msec
     *   `WatchError` on error from `consul` underlying method
     *
     * Rejection of promise means that watch was stopped and `this._watchAnyNodeChange` was cleared.
     *
     * @returns {Promise<ServiceInstances,AlreadyInitializedError|WatchError|WatchTimeoutError>}
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
                    dc: this._dc,
                    wait: '60s',
                },
            });

            const firstChange = (data, response) => {
                this._watchAnyNodeChange.removeListener('error', firstError);
                clearTimeout(timerId);

                const {instances, errors} = instancesFactory.buildServiceInstances(
                    data,
                    this._checkNameWithStatus,
                    this._extractors
                );

                for (const headerName of X_CONSUL_HEADERS) {
                    this._consulHeaders[headerName] = response.headers[headerName];
                }

                if (!_.isEmpty(errors)) {
                    this._emitFactoryErrors(errors);
                }

                resolve(instances);
            };

            const firstError = (err) => {
                this._watchAnyNodeChange.removeListener('change', firstChange);
                this._watchAnyNodeChange.end();
                this._watchAnyNodeChange = null;
                clearTimeout(timerId);
                reject(new WatchError(err.message, {err}));
            };

            const timerId = setTimeout(() => {
                this._watchAnyNodeChange.removeListener('error', firstError);
                this._watchAnyNodeChange.removeListener('change', firstChange);
                this._watchAnyNodeChange.end();
                this._watchAnyNodeChange = null;
                reject(new WatchTimeoutError('Initial consul watch request was timed out'));
            }, this._timeoutMsec);

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
     * @param {IncomingMessage} response - response from Consul
     * @emits ServiceInstancesMonitor#changed actual array of a valid nodes
     * @private
     */
    _onWatcherChange(data, response) {
        let isHealthyStateChanged = false;
        if (!this.isWatchHealthy()) {
            this._setWatchHealthy();
            isHealthyStateChanged = true;
        }

        const {instances, errors} = instancesFactory.buildServiceInstances(
            data,
            this._checkNameWithStatus,
            this._extractors
        );

        this._serviceInstances = instances;
        for (const headerName of X_CONSUL_HEADERS) {
            this._consulHeaders[headerName] = response.headers[headerName];
        }
        if (isHealthyStateChanged) {
            this.emit('healthy');
        }
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

        this.emit('error', new WatchError(err.message, {err}));
    }

    async _onWatcherEnd() {
        this._unsetFallbackToWatchHealthy();
        this._setUninitialized();

        if (this.isWatchHealthy()) {
            this._setWatchUnealthy();
            this.emit('unhealthy');
        }

        this._watchAnyNodeChange.removeAllListeners();
        this._watchAnyNodeChange = null;
        await this._retryStartService();
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
            if (this.isWatchHealthy()) {
                // watcher is currently becomes `healthy`, unset fallback interval',
                this._unsetFallbackToWatchHealthy();

                return;
            }

            const lastUpdateTime = this._watchAnyNodeChange.updateTime();

            if (initialUpdateTime !== lastUpdateTime) {
                this._unsetFallbackToWatchHealthy();

                this._setWatchHealthy();
                this.emit('healthy');
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
