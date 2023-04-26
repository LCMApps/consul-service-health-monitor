'use strict';

class CpuInfo {

    /**
     * @param {number} cpuUsage - float number between 0 and 100 and it represents average usage between available cores
     * @param {number} cpuCount - number of available cores on the instance, may be -1
     */
    constructor(cpuUsage, cpuCount) {
        this._cpuUsage = cpuUsage;
        this._cpuCount = cpuCount;
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
}

module.exports = CpuInfo;
