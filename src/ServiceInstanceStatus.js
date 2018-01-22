'use strict';

const STATE_OK          = 'OK';
const STATE_OVERLOADED  = 'OVERLOADED';
const STATE_MAINTENANCE = 'MAINTENANCE';

/**
 * Checks that `variable` is integer
 *
 * @param {*} variable - variable value to check
 * @param {string} variableName - name of variable for pretty and descriptive errors
 * @throws {TypeError}
 * @return {void}
 */
function throwErrorIfNotInt(variable, variableName) {
    if (!Number.isInteger(variable)) {
        throw new TypeError(`${variableName} must be an integer`);
    }
}

/**
 * Represents status of load of service instance
 */
class ServiceInstanceStatus {

    /**
     * @param {number} pid - process id of the instance
     * @param {string} status - status returned by instance, may be "OK", "OVERLOADED" or "MAINTENANCE"
     * @param {number} memTotal - total memory in kB, integer, may be -1
     * @param {number} memFree - free memory in kB, integer, may be -1
     * @param {number} cpuUsage - float number between 0 and 100 and it represents average usage between available cores
     * @param {number} cpuCount - number of available cores on the instance, may be -1
     * @param {Object} rowOutput - data that service returns on Health Check request
     * @throws {TypeError} on invalid type or value of one of arguments
     */
    constructor(pid, status, memTotal, memFree, cpuUsage, cpuCount, rowOutput) {
        if (!(typeof status === 'string') || status.length === 0) {
            throw new TypeError('status must be an non-empty string');
        }

        if (status !== ServiceInstanceStatus.STATE_OK &&
            status !== ServiceInstanceStatus.STATE_OVERLOADED &&
            status !== ServiceInstanceStatus.STATE_MAINTENANCE
        ) {
            throw new TypeError(
                `status must be on of the following values: ["${ServiceInstanceStatus.STATE_OK}", `
                + `"${ServiceInstanceStatus.STATE_OVERLOADED}", "${ServiceInstanceStatus.STATE_MAINTENANCE}"]`
            );
        }

        throwErrorIfNotInt(pid, 'pid');

        if (pid < 0) {
            throw new TypeError('pid must be a positive integer');
        }

        throwErrorIfNotInt(memTotal, 'memTotal');
        throwErrorIfNotInt(memFree, 'memFree');
        throwErrorIfNotInt(cpuCount, 'cpuCount');

        if (!(typeof cpuUsage === 'number') || cpuUsage < 0 || cpuUsage > 100) {
            throw new TypeError('cpuUsage must be a number between [0, 100]');
        }

        this._status = status;
        this._pid = pid;
        this._memTotal = memTotal;
        this._memFree = memFree;
        this._cpuUsage = cpuUsage;
        this._cpuCount = cpuCount;
        this._rawOutput = rowOutput;
    }

    /**
     * @return {string} OK
     */
    static get STATE_OK() {
        return STATE_OK;
    }

    /**
     * @return {string} OVERLOADED
     */
    static get STATE_OVERLOADED() {
        return STATE_OVERLOADED;
    }

    /**
     * @return {string} MAINTENANCE
     */
    static get STATE_MAINTENANCE() {
        return STATE_MAINTENANCE;
    }

    /**
     * Returns amount of cores available on service instance.
     *
     * May be -1 if instance can't determine amount of cores.
     *
     * @returns {number}
     */
    getCpuCount() {
        return this._cpuCount;
    }

    /**
     * Returns CPU usage.
     *
     * CPU usage is a number between 0 and 100 and it represents average usage between available cores.
     *
     * Example, if there are 4 cores, 3 of them with 0% usage and the last one with 100% usage, CPU
     * usage will be 25%.
     *
     * @returns {number}
     */
    getCpuUsage() {
        return this._cpuUsage;
    }

    /**
     * Amount of free memory in mB
     *
     * May be -1 if instance can't determine free memory.
     *
     * @returns {number}
     */
    getMemFree() {
        return this._memFree;
    }

    /**
     * Amount of total memory in mB
     *
     * May be -1 if instance can't determine total available memory.
     *
     * @returns {number}
     */
    getMemTotal() {
        return this._memTotal;
    }

    /**
     * Return pid of the instace
     *
     * @returns {number}
     */
    getPid() {
        return this._pid;
    }

    /**
     * Returns status of service on the instance
     *
     * May be "OK", "OVERLOADED" or "MAINTENANCE". This status set up by the instance itself.
     *
     * @returns {string}
     */
    getStatus() {
        return this._status;
    }

    /**
     * Returns parsed data of Health Check output
     *
     * @returns {Object}
     */
    getRowOutput() {
        return this._rawOutput;
    }

    /**
     * Returns true if status is "OK"
     *
     * @return {boolean}
     */
    isOk() {
        return this._status === STATE_OK;
    }

    /**
     * Returns true if status is "OVERLOADED"
     *
     * @return {boolean}
     */
    isOverloaded() {
        return this._status === STATE_OVERLOADED;
    }

    /**
     * Returns true if status is "MAINTENANCE"
     *
     * @return {boolean}
     */
    isOnMaintenance() {
        return this._status === STATE_MAINTENANCE;
    }
}

module.exports = ServiceInstanceStatus;
