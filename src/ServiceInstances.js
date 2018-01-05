'use strict';

class ServiceInstances {
    constructor() {
        this._healthyMap = new Map();
        this._onMaintenanceMap = new Map();
        this._overloadedMap = new Map();
        this._unhealthyMap = new Map();
    }

    /**
     * Adds an instance to the list and mark it as `healthy`.
     *
     * Healthy instance is one with all checks in `passing` state and status of server
     * that comes in response to consul healthcheck request is in "OK" state.
     *
     * In example below response from `consul.health.service` will be interpret "healthy"
     * @example
     * {
     *   "Node": { "Node": "transcoder_app", "Address": "192.168.101.4", ... },
     *   "Service": { "Service": "transcoder", ... },
     *   "Checks": [
     *     {
     *       "CheckID": "serfHealth",
     *       "Status": "passing",
     *       "Output": "Agent alive and reachable"
     *     },
     *     {
     *       "CheckID": "service:transcoder",
     *       "Status": "passing",
     *       "Output": "HTTP GET ${path}: 200 OK Output: " +
     *         "\"data\":{" +
     *           "{\"status\":\"OK\",\"pid\":100,\"mem\":{\"total\":13121352,\"free\":4256144},\"cpu\":' +
     *           "{\"usage\":1.2295908130391557,\"count\":16}}" +
     *         "}"
     *     }
     *   ]
     * }
     *
     * @param {ServiceInstance} instance
     * @return {ServiceInstances} return link to itself to make method chainable
     */
    addHealthy(instance) {
        this._healthyMap.set(this._generateStorageKey(instance), instance);
        return this;
    }

    /**
     * Adds an instance to the list and mark it as `on-maintenance`.
     *
     * On-maintenance instance is one that has one of the following criteria:
     *   - all checks are in `passing` state
     *   - instance-status check is passing and `ServiceInstance.getStatus().isOnMaintenance() === true`
     *
     * If instance check status is in failing state but status is "MAINTENANCE" this node must be considered
     * as unhealthy and another method to add instance must be used!
     *
     * In example below response from `consul.health.service` will be interpret "on-maintenance"
     * @example
     * {
     *   "Node": { "Node": "transcoder_app", "Address": "192.168.101.4", ... },
     *   "Service": { "Service": "transcoder", ... },
     *   "Checks": [
     *     {
     *       "CheckID": "serfHealth",
     *       "Status": "passing",
     *       "Output": "Agent alive and reachable"
     *     },
     *     {
     *       "CheckID": "service:transcoder",
     *       "Status": "critical",
     *       "Output": "HTTP GET ${path}: 200 OK Output: " +
     *         "{\"data\":" +
     *           "{\"status\":\"MAINTENANCE\",\"pid\":100,\"mem\":{\"total\":13121352,\"free\":4256144},\"cpu\":' +
     *           "{\"usage\":1.2295908130391557,\"count\":16}}" +
     *         "}"
     *     }
     *   ]
     * }
     *
     * The next one example will be "unhealthy", but with "MAINTENANCE" status. The reason is that instance
     * status check is in critical state but, but be in passing:
     * @example
     * {
     *   "Node": { "Node": "transcoder_app", "Address": "192.168.101.4", ... },
     *   "Service": { "Service": "transcoder", ... },
     *   "Checks": [
     *     {
     *       "CheckID": "serfHealth",
     *       "Status": "critical",
     *       "Output": "Agent alive and reachable"
     *     },
     *     {
     *       "CheckID": "service:transcoder",
     *       "Status": "critical",
     *       "Output": "HTTP GET ${path}: 503 Service Unavailable Output: " +
     *         "{\"data\":"
     *           "{\"status\":\"MAINTENANCE\",\"pid\":100,\"mem\":{\"total\":13121352,\"free\":4256144},\"cpu\":' +
     *           "{\"usage\":1.2295908130391557,\"count\":16}}" +
     *         "}"
     *     }
     *   ]
     * }
     *
     * @param {ServiceInstance} instance
     * @return {ServiceInstances} return link to itself to make method chainable
     */
    addOnMaintenance(instance) {
        this._onMaintenanceMap.set(this._generateStorageKey(instance), instance);
        return this;
    }

    /**
     * Adds an instance to the list and mark it as `overloaded`.
     *
     * Overloaded instance is one that has one of the following criteria:
     *   - all checks are in `passing` state and `ServiceInstance.getStatus().isOverloaded() === true`
     *   - only instance-status check is not passing and `ServiceInstance.getStatus().isOverloaded() === true`
     *
     * If instance check status is in failing state but check doesn't contain output
     * or output has invalid format this node must be considered as unhealthy and another method
     * to add instance must be used!
     *
     * In example below response from `consul.health.service` will be interpret "overloaded"
     * @example
     * {
     *   "Node": { "Node": "transcoder_app", "Address": "192.168.101.4", ... },
     *   "Service": { "Service": "transcoder", ... },
     *   "Checks": [
     *     {
     *       "CheckID": "serfHealth",
     *       "Status": "passing",
     *       "Output": "Agent alive and reachable"
     *     },
     *     {
     *       "CheckID": "service:transcoder",
     *       "Status": "critical",
     *       "Output": "HTTP GET ${path}: 503 Service Unavailable Output: " +
     *         "{\"data\":" +
     *           "{\"status\":\"OVERLOADED\",\"pid\":100,\"mem\":{\"total\":13121352,\"free\":4256144},\"cpu\":' +
     *           "{\"usage\":1.2295908130391557,\"count\":16}}" +
     *         "}"
     *     }
     *   ]
     * }
     *
     * @param {ServiceInstance} instance
     * @return {ServiceInstances} return link to itself to make method chainable
     */
    addOverloaded(instance) {
        this._overloadedMap.set(this._generateStorageKey(instance), instance);
        return this;
    }

    /**
     * Adds an instance to the list and mark it as `unhealthy`.
     *
     * Unhealthy instance is one that has one of the following criteria:
     *   - at least one check, except check with instance-status, not in `passing` state
     *   - instance-status check isn't in passing state while `ServiceInstance.getStatus().isOk() === true`
     *
     * Anyway, instance status check must have output and it must be valid.
     * Instance must not be added buy this method or by any method of this class if
     * instance status check output can't be parsed. It must be interpret as invalid service ant must
     * not be in this list.
     *
     * In example below response from `consul.health.service` will be interpret "unhealthy":
     * @example
     * {
     *   "Node": { "Node": "transcoder_app", "Address": "192.168.101.4", ... },
     *   "Service": { "Service": "transcoder", ... },
     *   "Checks": [
     *     {
     *       "CheckID": "serfHealth",
     *       "Status": "critical",
     *       "Output": "Agent alive and reachable"
     *     },
     *     {
     *       "CheckID": "service:transcoder",
     *       "Status": "passing",
     *       "Output": "HTTP GET ${path}: 200 OK Output: " +
     *         "{\"data\":"
     *           "{\"status\":\"OK\",\"pid\":100,\"mem\":{\"total\":13121352,\"free\":4256144},\"cpu\":' +
     *           "{\"usage\":1.2295908130391557,\"count\":16}}" +
     *         "}"
     *     }
     *   ]
     * }
     *
     * The next one example will be "unhealthy too, the reason is that instance status check
     * is in critical state but `ServiceInstance.getStatus().isOk()`:
     * @example
     * {
     *   "Node": { "Node": "transcoder_app", "Address": "192.168.101.4", ... },
     *   "Service": { "Service": "transcoder", ... },
     *   "Checks": [
     *     {
     *       "CheckID": "serfHealth",
     *       "Status": "critical",
     *       "Output": "Agent alive and reachable"
     *     },
     *     {
     *       "CheckID": "service:transcoder",
     *       "Status": "critical",
     *       "Output": "HTTP GET ${path}: 200 OK Output: " +
     *         "{\"data\":"
     *           "{\"status\":\"OK\",\"pid\":100,\"mem\":{\"total\":13121352,\"free\":4256144},\"cpu\":' +
     *           "{\"usage\":1.2295908130391557,\"count\":16}}" +
     *         "}"
     *     }
     *   ]
     * }
     *
     * @param {ServiceInstance} instance
     * @return {ServiceInstances} return link to itself to make method chainable
     */
    addUnhealthy(instance) {
        this._unhealthyMap.set(this._generateStorageKey(instance), instance);
        return this;
    }

    /**
     * @return {ServiceInstance[]}
     */
    getHealthy() {
        return [...this._healthyMap.values()];
    }

    /**
     * @return {ServiceInstance[]}
     */
    getOnMaintenance() {
        return [...this._onMaintenanceMap.values()];
    }

    /**
     * @return {ServiceInstance[]}
     */
    getOverloaded() {
        return [...this._overloadedMap.values()];
    }

    /**
     * @return {ServiceInstance[]}
     */
    getUnhealthy() {
        return [...this._unhealthyMap.values()];
    }

    /**
     * @param {ServiceInstance} instance
     * @return {string}
     */
    _generateStorageKey(instance) {
        return `${instance.getServiceId()}_${instance.getNodeAddress()}`;
    }
}

module.exports = ServiceInstances;
