'use strict';

const _ = require('lodash');

/**
 * Represents collection of instance information
 */
class ServiceInstanceInfo {

    /**
     * @param {Object} instanceInfo - process id of the instance
     * @throws {TypeError} on invalid type or value of one of arguments
     */
    constructor(instanceInfo) {
        if (!_.isPlainObject(instanceInfo)) {
            throw new TypeError('instanceInfo argument must be a plain object');
        }

        this._instanceInfo = instanceInfo;
    }

    /**
     * Returns DTO that was built by extractor with name [extractorName]
     *
     * param {string} extractorName
     * @returns {*}
     */
    get(extractorName) {
        if (typeof extractorName !== 'string') {
            throw new TypeError('extractorName argument must be a string');
        }

        return this._instanceInfo[extractorName];
    }
}

module.exports = ServiceInstanceInfo;
