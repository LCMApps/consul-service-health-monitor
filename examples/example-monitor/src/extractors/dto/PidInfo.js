'use strict';

class PidInfo {

    /**
     * @param {number} pid - process id of the instance
     */
    constructor(pid) {
        this._pid = pid;
    }

    /**
     * Return pid of the instance
     *
     * @returns {number}
     */
    getPid() {
        return this._pid;
    }
}

module.exports = PidInfo;
