const EventEmitter = require('events');
const _ = require('lodash');
const async_ = require('asyncawait/async');
const await_ = require('asyncawait/await');
const instancesFactory = require('./Factory');
const WatchError = require('./Error').WatchError;
const WatchTimeoutError = require('./Error').WatchTimeoutError;
const AlreadyInitializedError = require('./Error').AlreadyInitializedError;


const CONSUL_WAIT_INIT_TIMEOUT_MSEC = 5000;

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
 * @fires ServiceInstancesMonitor#initialized
 * @fires ServiceInstancesMonitor#changed
 */
class ServiceInstancesMonitor extends EventEmitter {

    /**
     * @param {Object} options
     * @param {string} options.serviceName -  name of service in consul to monitor
     * @param {string} options.checkNameWithStatus
     * @param {Consul} consul
     * @throws {TypeError} On invalid options format
     * @public
     */
    constructor(options, consul) {
        super();

        if (!_.isObject(options)) {
            throw new TypeError('options must be an object');
        }

        if (!_.has(options, 'serviceName') || !_.isString(options.serviceName) || _.isEmpty(options.serviceName)) {
            throw new TypeError('options.serviceName must be set and be a non-empty string');
        }

        if (!_.has(options, 'checkNameWithStatus') ||
            !_.isString(options.checkNameWithStatus) ||
            _.isEmpty(options.checkNameWithStatus)
        ) {
            throw new TypeError('options.checkNameWithStatus must be a non-empty string');
        }

        this._serviceName         = options.serviceName;
        this._checkNameWithStatus = options.checkNameWithStatus;
        this._initialized         = false;
        this._serversList         = [];

        this._consul = consul;

        this._onWatcherChange = this._onWatcherChange.bind(this);
        this._onWatcherError = this._onWatcherError.bind(this);
        this._onWatcherEnd = this._onWatcherEnd.bind(this);

        this._serviceInstances = null;
        this._watchAnyNodeChange = null;
        this._setWatchUnealthy();
        this._setUninitialized();
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

    getHealthyNodes() {
        return this._nodes.healthy;
    }

    getUnhealthyNodes() {
        return this._nodes.unhealthy;
    }

    /**
     * Starts service and resolves promise with initial list of nodes that provide the service.
     *
     * Listens for changes after successful resolve.
     *
     * Promise will be rejected with:
     *   `AlreadyInitializedError` if service is already started.
     *   `WatchTimeoutError` if either initial data nor error received for 5000 msec
     *   `WatchError` on error from `consul` underlying method
     *
     * Rejection of promise means that watcher was stopped and no retries will be done.
     *
     * @returns {Promise<Array,AlreadyInitializedError|WatchError|WatchTimeoutError>}
     * @public
     */
    startService() {
        return async_(() => {
            if (this._isWatcherRegistered()) {
                throw new AlreadyInitializedError('Service is already started');
            }

            const initialListOfNodes = await_(this._registerWatcherAndWaitForInitialNodes());
            this._watchAnyNodeChange.on('change', this._onWatcherChange);
            this._watchAnyNodeChange.on('error', this._onWatcherError);
            this._watchAnyNodeChange.on('end', this._onWatcherEnd);

            this._setInitialized();
            this._setWatchHealthy();
            return initialListOfNodes;
        })();
    }

    stopService() {
        if (!this._isWatcherRegistered()) {
            return;
        }

        // we need to remove listener to prevent emitting of `end` event after stop of watcher
        this._watchAnyNodeChange.removeListener('end', this._onWatcherEnd);
        this._watchAnyNodeChange.end();
        this._watchAnyNodeChange = null;
        this._setUninitialized();
        this._setWatchUnealthy();
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
     * @returns {Promise<Array,AlreadyInitializedError|WatchError|WatchTimeoutError>}
     * @private
     */
    _registerWatcherAndWaitForInitialNodes() {
        return new Promise((resolve, reject) => {
            if (this._watchAnyNodeChange !== null) {
                reject(new AlreadyInitializedError('Another `consul.watch` execution is found'));
            }

            this._watchAnyNodeChange = this._consul.watch({
                method: this._consul.health.service,
                options: {
                    service: this._serviceName,
                    wait: '60s',
                },
            });

            const firstChange = (data) => {
                this._watchAnyNodeChange.removeListener('error', firstError);
                clearTimeout(timerId);

                const {instances} = instancesFactory.buildServiceInstances(
                    data, this._checkNameWithStatus
                );

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
            }, CONSUL_WAIT_INIT_TIMEOUT_MSEC);

            this._watchAnyNodeChange.once('change', firstChange);
            this._watchAnyNodeChange.once('error', firstError);
        });
    }

    /**
     * This method receives list of healthy nodes sent by `consul.watch` in `consul` format. Performs
     * validation of response format.
     *
     * If service was unhealthy, it becomes healthy.
     *
     * @param {Array} data - list of healthy nodes after some changes
     * @emits ServiceInstancesMonitor#changed actual array of healthy nodes
     * @private
     */
    _onWatcherChange(data) {
        if (!this.isWatchHealthy()) {
            this._setWatchHealthy();
        }

        const {instances, errors} = instancesFactory.buildServiceInstances(
            data, this._checkNameWithStatus
        );

        this._serviceInstances = instances;
        this.emit('changed', instances);

        if (!_.isEmpty(errors)) {
            this._emitFactoryErrors(errors);
        }
    }

    _onWatcherError(err) {
        if (this.isWatchHealthy()) {
            this._setWatchUnealthy();
        }

        this.emit('error', new WatchError(err.message, { err }));
    }

    _onWatcherEnd() {
        this._setUninitialized();
        this._setWatchUnealthy();
        this._watchAnyNodeChange = null;
        this.emit('emergencyStop');
    }

    _emitFactoryErrors(errors) {
        setImmediate(() => {
            errors.forEach(error => this.emit.call('error', error));
        });
    }
}

module.exports = ServiceInstancesMonitor;
