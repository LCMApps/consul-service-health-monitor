'use strict';

class ServiceInstances {
    constructor() {
        this._healthyMap = new Map();
        this._unhealthyMap = new Map();
    }

    /**
     * Adds an instance to the list and mark it as `healthy`.
     *
     * Healthy instance is one with all checks in `passing` state.
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
     * Adds an instance to the list and mark it as `unhealthy`.
     *
     * Unhealthy instance is one that has one of the following criteria:
     *   - at least one check, except serfHealth check, not in `passing` state
     *
     * Instance must not be added by this method or by any method of this class if
     * instance status check output is absent. It must be interpret as invalid service and must
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
