'use strict';

const ServiceInstanceInfo = require('./ServiceInstanceInfo');

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
     * @param {string|null} serviceAddress
     * @param {number} servicePort
     * @param {string} nodeAddress - ip or host of node on which service instance is running
     * @param {string} nodeName - in most cases it is hostname of node where service instance is running
     * @param {string} nodeDc - consul datacenter of node on which service instance is running
     * @param {string} serviceId - unique identifier of service instance
     * @param {string[]} serviceTags - tags of service
     * @param {ServiceInstanceInfo|null} serviceInstanceInfo - info of the service
     * @throws {TypeError} on invalid type or value of one of arguments
     */
    constructor(
        lanIp,
        wanIp,
        serviceAddress,
        servicePort,
        nodeAddress,
        nodeName,
        nodeDc,
        serviceId,
        serviceTags,
        serviceInstanceInfo
    ) {
        throwErrorIfNotNullOrNotEmptyString(lanIp, 'lanIp');
        throwErrorIfNotNullOrNotEmptyString(wanIp, 'wanIp');
        throwErrorIfNotNullOrNotEmptyString(serviceAddress, 'serviceAddress');
        throwErrorIfNotNumber(servicePort, 'servicePort');
        throwErrorIfNotEmptyString(nodeAddress, 'nodeAddress');
        throwErrorIfNotEmptyString(nodeName, 'nodeName');
        throwErrorIfNotEmptyString(nodeDc, 'nodeDc');
        throwErrorIfNotEmptyString(serviceId, 'serviceId');

        if (!Array.isArray(serviceTags)) {
            throw new TypeError('serviceTags must be an array');
        }

        for (let tag of serviceTags) {
            throwErrorIfNotEmptyString(tag, 'serviceTag item');
        }

        if (!(serviceInstanceInfo instanceof ServiceInstanceInfo) && serviceInstanceInfo !== null) {
            throw new TypeError('serviceInstanceInfo must be an instance of ServiceInstanceInfo');
        }

        this._lanIp = lanIp;
        this._wanIp = wanIp;
        this._serviceAddress = serviceAddress;
        this._port = servicePort;
        this._nodeAddress = nodeAddress;
        this._nodeName = nodeName;
        this._nodeDc = nodeDc;
        this._serviceId = serviceId;
        this._serviceTags = serviceTags;
        this._serverInstanceInfo = serviceInstanceInfo;
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
     * Returns Service.Address value from the consul.
     *
     * May be null if service explicitly ignores setting of address.
     *
     * @returns {string|null}
     */
    getServiceAddress() {
        return this._serviceAddress;
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
     * Returns consul datacenter of node where service is running
     *
     * @returns {string}
     */
    getNodeDatacenter() {
        return this._nodeDc;
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
     * @returns {ServiceInstanceInfo}
     */
    getInfo() {
        return this._serverInstanceInfo;
    }
}

module.exports = ServiceInstance;
