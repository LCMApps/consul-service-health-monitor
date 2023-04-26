'use strict';

class MemoryInfo {

    /**
     * @param {number} memTotal - integer number and it represents total RAM in MB, may be -1
     * @param {number} memFree - integer number and it represents free RAM in MB, may be -1
     */
    constructor(memTotal, memFree) {
        this._memTotal = memTotal;
        this._memFree = memFree;
    }

    /**
     * Amount of total memory in MB
     *
     * May be -1 if instance can't determine total available memory.
     *
     * @returns {number}
     */
    getTotalMemory() {
        return this._memTotal;
    }

    /**
     * Amount of free memory in MB
     *
     * May be -1 if instance can't determine free memory.
     *
     * @returns {number}
     */
    getFreeMemory() {
        return this._memFree;
    }
}

module.exports = MemoryInfo;
