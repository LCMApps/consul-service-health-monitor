'use strict';

const util = require('util');

class ExtendableError extends Error {
    /**
     * @param {string} message
     * @param {*} extra
     */
    constructor(message = '', extra) {
        super(message);

        this.message = message;
        this.extra   = extra;
        this.name    = this.constructor.name;

        // noinspection JSUnresolvedFunction
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * @return {string}
     */
    toString() {
        return this.extra ? super.toString() + ' Extra: ' + util.inspect(this.extra, false, 2) : super.toString();
    }
}

module.exports = ExtendableError;
