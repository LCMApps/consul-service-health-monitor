'use strict';

const ServiceInstanceStatus = require('./ServiceInstanceStatus');

/**
 * Checks that `variable` is non empty string
 *
 * @param {*} variable - variable value to check
 * @param {string} variableName - name of variable for pretty and descriptive errors
 * @throws {TypeError}
 * @return {void}
 */
function throwErrorIfNotEmptyString(variable, variableName) {
    if ((typeof variable !== 'string') || variable.length === 0) {
        throw new TypeError(`${variableName} must be a string`);
    }
}

/**
 * Checks that `variable` is non-empty string or null
 *
 * @param {*} variable - variable value to check
 * @param {string} variableName - name of variable for pretty and descriptive errors
 * @throws {TypeError}
 * @return {void}
 */
function throwErrorIfNotNullOrNotEmptyString(variable, variableName) {
    if (variable === null) {
        return;
    }

    if ((typeof variable === 'string') && variable.length > 0) {
        return;
    }

    throw new TypeError(`${variableName} must be a non-empty string or null`);
}

/**
 * Checks that `variable` is defined and is number
 *
 * @param {*} variable - variable value to check
 * @param {string} variableName - name of variable for pretty and descriptive errors
 * @throws {TypeError}
 * @return {void}
 */
function throwErrorIfNotNumber(variable, variableName) {
    if ((typeof variable !== 'number')) {
        throw new TypeError(`${variableName} must be a number`);
    }
}

/**
 * Represents service instance and its load status
 */
class ServiceInstance {

    /**
     * @param {string|null} lanIp
     * @param {string|null} wanIp
     * @param {number} port
     * @param {string} nodeAddress - ip or host of node on which service instance is running
     * @param {string} nodeName - in most cases it is hostname of node where service instance is running
     * @param {string} serviceId - unique identifier of service instance
     * @param {string[]} serviceTags - tags of service
     * @param {ServiceInstanceStatus} serviceInstanceStatus - status of the service
     * @throws {TypeError} on invalid type or value of one of arguments
     */
    constructor(lanIp, wanIp, port, nodeAddress, nodeName, serviceId, serviceTags, serviceInstanceStatus) {
        throwErrorIfNotNullOrNotEmptyString(lanIp, 'lanIp');
        throwErrorIfNotNullOrNotEmptyString(wanIp, 'wanIp');
        throwErrorIfNotNumber(port, 'port');
        throwErrorIfNotEmptyString(nodeAddress, 'nodeAddress');
        throwErrorIfNotEmptyString(nodeName, 'nodeName');
        throwErrorIfNotEmptyString(serviceId, 'serviceId');

        if (!Array.isArray(serviceTags)) {
            throw new TypeError('serviceTags must be an array');
        }

        for (let tag of serviceTags) {
            throwErrorIfNotEmptyString(tag, 'serviceTag item');
        }

        if (!(serviceInstanceStatus instanceof ServiceInstanceStatus)) {
            throw new TypeError('serviceInstanceStatus must be an instance of ServiceInstanceStatus');
        }

        this._lanIp = lanIp;
        this._wanIp = wanIp;
        this._port = port;
        this._nodeAddress = nodeAddress;
        this._nodeName = nodeName;
        this._serviceId = serviceId;
        this._serviceTags = serviceTags;
        this._serverInstanceStatus = serviceInstanceStatus;
    }

    /**
     * Returns lanIp.
     *
     * May be null if consul agent (or whole server) on the node goes down. In such situation consul leader remembers
     * service and node for some time and marks serfHealth as critical. While node exists, health api returns
     * null for `Node.TaggedAddresses`.
     *
     * @returns {string|null}
     */
    getLanIp() {
        return this._lanIp;
    }

    /**
     * Returns wanIp.
     *
     * May be null if consul agent (or whole server) on the node goes down. In such situation consul leader remembers
     * service and node for some time and marks serfHealth as critical. While node exists, health api returns
     * null for `Node.TaggedAddresses`.
     *
     * @returns {string|null}
     */
    getWanIp() {
        return this._wanIp;
    }

    /**
     * Returns port.
     *
     * @returns {number}
     */
    getPort() {
        return this._port;
    }

    /**
     * Returns nodeName of node where service is running. In most cases it is hostname of the node where service
     * instance is running. From the other hand, it may be uuid of the node.
     *
     * May be empty string if consul agent (or whole server) on the node goes down. In such situation
     * consul leader remembers service and node for some time but returns empty string as nodeName.
     *
     * @returns {string}
     */
    getNodeName() {
        return this._nodeName;
    }

    /**
     * Returns address (ip or host) of node where service is running
     *
     * @returns {string}
     */
    getNodeAddress() {
        return this._nodeAddress;
    }

    /**
     * Returns ID of service instance
     *
     * @returns {string}
     */
    getServiceId() {
        return this._serviceId;
    }

    /**
     * Returns array of serviceTags
     *
     * @returns {string[]}
     */
    getServiceTags() {
        return this._serviceTags;
    }

    /**
     * Return object that represents status of instance
     *
     * @returns {ServiceInstanceStatus}
     */
    getStatus() {
        return this._serverInstanceStatus;
    }
}

module.exports = ServiceInstance;
