'use strict';

const CpuInfo = require('./CpuInfo');

class CpuInfoExtractor {

    /**
     * @param {boolean} isMandatory - allows field to be absent in outputObject passed to extractor
     */
    constructor(isMandatory = true) {
        this._isMandatory = isMandatory;
    }

    /**
     * @param {Object} outputObject
     * @returns {CpuInfo|undefined}
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

        const cpuObject = outputObject.data.cpu;

        if (typeof cpuObject !== 'object') {
            if (this._isMandatory) {
                throw new TypeError('"data.cpu" field must be an object');
            } else {
                return undefined;
            }
        }

        if (!Number.isInteger(cpuObject.count)) {
            if (this._isMandatory) {
                throw new TypeError('"data.cpu.count" field must be an integer');
            } else {
                return undefined;
            }
        }

        if (typeof cpuObject.usage !== 'number' || cpuObject.usage < 0 || cpuObject.usage > 100) {
            if (this._isMandatory) {
                throw new TypeError('"data.cpu.usage" field must be a number between [0, 100]');
            } else {
                return undefined;
            }
        }

        return new CpuInfo(cpuObject.usage, cpuObject.count);
    }
}

module.exports = CpuInfoExtractor;
