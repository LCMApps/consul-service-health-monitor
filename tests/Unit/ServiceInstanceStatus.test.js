'use strict';

const assert = require('chai').assert;
const dataDriven = require('data-driven');
const ServiceInstanceStatus = require('src/ServiceInstanceStatus');

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
    return { value, type: (value === null ? 'null' : typeof value) };
}

const testParams = {
    // all type except number
    notANumber: [
        vt('string'), vt(true), vt(undefined), vt(Symbol()), vt({ }), vt(setTimeout), vt(null)
    ],
    // all types except string
    notAString: [
        vt(true), vt(123), vt(undefined), vt(Symbol()), vt({ }), vt(setTimeout), vt(null)
    ]
};

describe('ServiceInstanceStatus::constructor', function () {
    dataDriven(testParams.notANumber, function () {
        it('incorrect type of pid, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstanceStatus(arg.value, 'OK', 1, 1, 1, 1);
                },
                TypeError,
                'pid must be an integer'
            );
        });
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of status, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstanceStatus(1, arg.value, 1, 1, 1, 1);
                },
                TypeError,
                'status must be an non-empty string'
            );
        });
    });

    dataDriven(testParams.notANumber, function () {
        it('incorrect type of memTotal, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstanceStatus(1, 'OK', arg.value, 1, 1, 1);
                },
                TypeError,
                'memTotal must be an integer'
            );
        });
    });

    dataDriven(testParams.notANumber, function () {
        it('incorrect type of memFree, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstanceStatus(1, 'OK', 1, arg.value, 1, 1);
                },
                TypeError,
                'memFree must be an integer'
            );
        });
    });

    dataDriven(testParams.notANumber, function () {
        it('incorrect type of cpuUsage, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstanceStatus(1, 'OK', 1, 1, arg.value, 1);
                },
                TypeError,
                'cpuUsage must be a number between [0, 100]'
            );
        });
    });

    dataDriven(testParams.notANumber, function () {
        it('incorrect type of cpuCount, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstanceStatus(1, 'OK', 1, 1, 1, arg.value);
                },
                TypeError,
                'cpuCount must be an integer'
            );
        });
    });

    it('test of values of status with correct type', function () {
        // empty string is not allowed
        assert.throws(
            function () {
                new ServiceInstanceStatus(1, '', 1, 1, 1, 1);
            },
            TypeError,
            'status must be an non-empty string'
        );

        // strings that is not in allow list is not allowed
        assert.throws(
            function () {
                new ServiceInstanceStatus(1, 'SMTH', 1, 1, 1, 1);
            },
            TypeError,
            'status must be on of the following values: ["OK", "OVERLOADED", "MAINTENANCE"]'
        );

        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(1, 'OK', 1, 1, 1, 1);
        }, Error);
        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(1, 'OVERLOADED', 1, 1, 1, 1);
        }, Error);
        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(1, 'MAINTENANCE', 1, 1, 1, 1);
        }, Error);
    });

    it('test of values of pid with correct type', function () {
        // values <0 is not allowed
        assert.throws(
            function () {
                new ServiceInstanceStatus(-1, 'OK', 1, 1, 1, 1);
            },
            TypeError,
            'pid must be a positive integer'
        );

        // non-int values is not allowed
        assert.throws(
            function () {
                new ServiceInstanceStatus(50.4, 'OK', 1, 1, 1, 1);
            },
            TypeError,
            'pid must be an integer'
        );

        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(0, 'OK', 1, 1, 1, 1);
        }, Error);
        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(101, 'OK', 1, 1, 1, 1);
        }, Error);
        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(10001, 'OK', 1, 1, 1, 1);
        }, Error);
    });

    it('test of values of cpuUsage with correct type', function () {
        // values <0 is not allowed
        assert.throws(
            function () {
                new ServiceInstanceStatus(1, 'OK', 1, 1, -1, 1);
            },
            TypeError,
            'cpuUsage must be a number between [0, 100]'
        );

        // values >100 is not allowed
        assert.throws(
            function () {
                new ServiceInstanceStatus(1, 'OK', 1, 1, 101, 1);
            },
            TypeError,
            'cpuUsage must be a number between [0, 100]'
        );

        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(1, 'OK', 1, 1, 0, 1);
        }, Error);
        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(1, 'OK', 1, 1, 1, 1);
        }, Error);
        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(1, 'OK', 1, 1, 99.999, 1);
        }, Error);
        assert.doesNotThrow(function () {
            new ServiceInstanceStatus(1, 'OK', 1, 1, 100, 1);
        }, Error);
    });

    it('test getters', function () {
        const pid = 87;
        const statusOk = ServiceInstanceStatus.STATE_OK;
        const statusOverloaded = ServiceInstanceStatus.STATE_OVERLOADED;
        const memTotal = 2047;
        const memFree = 1337;
        const cpuUsage = 34.91;
        const cpuCount = 16;
        const instanceOk = new ServiceInstanceStatus(pid, statusOk, memTotal, memFree, cpuUsage, cpuCount);
        const instanceOverloaded = new ServiceInstanceStatus(
            pid, statusOverloaded, memTotal, memFree, cpuUsage, cpuCount
        );

        // instance with status 'OK'
        assert.isNumber(instanceOk.getPid());
        assert.equal(pid, instanceOk.getPid());
        assert.isString(instanceOk.getStatus());
        assert.equal(statusOk, instanceOk.getStatus());
        assert.isNumber(instanceOk.getMemTotal());
        assert.equal(memTotal, instanceOk.getMemTotal());
        assert.isNumber(instanceOk.getMemFree());
        assert.equal(memFree, instanceOk.getMemFree());
        assert.isNumber(instanceOk.getCpuUsage());
        assert.equal(cpuUsage, instanceOk.getCpuUsage());
        assert.isNumber(instanceOk.getCpuCount());
        assert.equal(cpuCount, instanceOk.getCpuCount());

        // instance with status 'OVERLOADED'
        assert.isString(instanceOverloaded.getStatus());
        assert.equal(statusOverloaded, instanceOverloaded.getStatus());
    });
});
