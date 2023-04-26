'use strict';

const STATE_OK          = 'OK';
const STATE_OVERLOADED  = 'OVERLOADED';
const STATE_MAINTENANCE = 'MAINTENANCE';

class StatusInfo {
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
     * @param {string} status - status returned by instance, may be "OK", "OVERLOADED" or "MAINTENANCE"
     */
    constructor(status) {
        this._status = status;
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

module.exports = StatusInfo;
