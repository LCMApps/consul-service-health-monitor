'use strict';

const assert = require('chai').assert;
const dataDriven = require('data-driven');
const deepFreeze = require('deep-freeze');
const ServiceInstanceInfo = require('src/ServiceInstanceInfo');

/**
 * Returns object with passed to function variable itself and its type.
 *
 * As of 'null' has type of 'object' in ECMAScript, function returns 'null' for it.
 *
 * @example
 *   `{value: 123, type: 'number'}`
 *   '{value: Symbol(), type: 'symbol'}`
 *   `{value: null, type: 'null'}`
 *
 * @param {*} value - value of any type
 * @returns {{value: *, type: string}}
 */
function vt(value) {
    return {value, type: (value === null ? 'null' : typeof value)};
}

const testParams = {
    // all types except string
    notAString: [
        vt(true), vt(123), vt(undefined), vt(Symbol()), vt({}), vt(setTimeout), vt(null)
    ],
    // all types except an plain object
    notAnPlainObject: [
        vt('8080'), vt(123), vt(true), vt(undefined), vt(Symbol()), vt(setTimeout), vt(null), vt([])
    ]
};

describe('ServiceInstanceInfo', function () {
    it('valid argument for constructor', function () {
        new ServiceInstanceInfo({});
    });

    dataDriven(testParams.notAnPlainObject, function () {
        it('constructor: incorrect type of "instanceInfo", type = {type}', function (arg) {
            assert.throws(
                function () {
                    new ServiceInstanceInfo(arg.value);
                },
                TypeError,
                'instanceInfo argument must be a plain object'
            );
        });
    });

    it('"get" method success', function () {
        const extractorName = 'someExtractorName';
        const extractorsInfo = deepFreeze({
            [extractorName]: 'extractorData'
        });

        const serviceInstanceInfo = new ServiceInstanceInfo(extractorsInfo);
        const data = serviceInstanceInfo.get(extractorName);

        assert.strictEqual(data, extractorsInfo[extractorName]);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of "extractorName" argument for "get" method, type = {type}', function (arg) {
            const serviceInstanceInfo = new ServiceInstanceInfo({});

            assert.throws(
                function () {
                    serviceInstanceInfo.get(arg.value);
                },
                TypeError,
                'extractorName argument must be a string'
            );
        });
    });
});
