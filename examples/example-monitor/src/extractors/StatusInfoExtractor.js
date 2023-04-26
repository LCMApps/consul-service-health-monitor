'use strict';

const StatusInfo = require('./dto/StatusInfo');
const allowedStatuses = [StatusInfo.STATE_OK, StatusInfo.STATE_OVERLOADED, StatusInfo.STATE_MAINTENANCE];

class StatusInfoExtractor {

    /**
     * @param {boolean} isMandatory - allows field to be absent in outputObject passed to extractor
     */
    constructor(isMandatory = true) {
        this._isMandatory = isMandatory;
    }

    /**
     * @param {Object} outputObject
     * @returns {StatusInfo|undefined}
     * @throws {TypeError} on invalid type or value of one of arguments
     */
    extract(outputObject) {
        if (typeof outputObject.data !== 'object') {
            if (this._isMandatory) {
                throw new TypeError('"data" field must be an object');
            } else {
                return undefined;
            }
        }

        if (!allowedStatuses.includes(outputObject.data.status)) {
            if (this._isMandatory) {
                throw new TypeError(
                    `"data.status" must be on of the following values: ["${StatusInfo.STATE_OK}", `
                    + `"${StatusInfo.STATE_OVERLOADED}", "${StatusInfo.STATE_MAINTENANCE}"]`
                );
            } else {
                return undefined;
            }
        }

        return new StatusInfo(outputObject.data.status);
    }
}

module.exports = StatusInfoExtractor;
