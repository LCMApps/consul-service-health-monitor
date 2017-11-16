'use strict';

const _ = require('lodash');
const consul = require('consul');
const assert = require('chai').assert;
const dataDriven = require('data-driven');
const deepFreeze = require('deep-freeze');
const ServiceInstancesMonitor = require('src/ServiceInstancesMonitor');

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
    ],
    // all types except object
    notAnObject: [
        vt('string'), vt(true), vt(123), vt(undefined), vt(Symbol()), vt(setTimeout), vt(null)
    ],
    notAFunction: [
        vt('string'), vt(true), vt(123), vt(undefined), vt(Symbol()), vt({ }), vt(null)
    ]
};

describe('ServiceInstancesMonitor::constructor', function () {

    const validOptions = deepFreeze({
        serviceName: 'transcoder',
        timeoutMsec: 1000,
        checkNameWithStatus: "Service 'transcoder' check"
    });

    let validConsulClient;

    beforeEach(() => {
        validConsulClient = consul();
    });

    it('valid arguments', function () {
        (new ServiceInstancesMonitor(validOptions, validConsulClient));
    });

    dataDriven(testParams.notAnObject, function () {
        it('incorrect type of options argument, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(arg.value, validConsulClient);
                },
                TypeError,
                'options must be an object'
            );
        });
    });

    it('missed mandatory options.serviceName argument', function () {
        const options = {};

        assert.throws(
            function () {
                new ServiceInstancesMonitor(options, validConsulClient);
            },
            TypeError,
            'options.serviceName must be set and be a non-empty string'
        );
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of options.serviceName argument, type = {type}', function (arg) {
            const options = _.set(_.cloneDeep(validOptions), 'serviceName', arg.value);

            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(options, validConsulClient);
                },
                TypeError,
                'options.serviceName must be set and be a non-empty string'
            );
        });
    });

    it('empty options.serviceName argument', function () {
        const options = _.set(_.cloneDeep(validOptions), 'serviceName', '');

        assert.throws(
            function () {
                new ServiceInstancesMonitor(options, validConsulClient);
            },
            TypeError,
            'options.serviceName must be set and be a non-empty string'
        );
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of options.checkNameWithStatus argument, type = {type}', function (arg) {
            const options = _.set(_.cloneDeep(validOptions), 'checkNameWithStatus', arg.value);

            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(options, validConsulClient);
                },
                TypeError,
                'options.checkNameWithStatus must be set and be a non-empty string'
            );
        });
    });

    it('empty options.checkNameWithStatus argument', function () {
        const options = _.set(_.cloneDeep(validOptions), 'checkNameWithStatus', '');

        assert.throws(
            function () {
                new ServiceInstancesMonitor(options, validConsulClient);
            },
            TypeError,
            'options.checkNameWithStatus must be set and be a non-empty string'
        );
    });

    it('absent options.timeoutMsec argument', function () {
        const options = deepFreeze(_.omit(_.cloneDeep(validOptions), 'timeoutMsec'));

        assert.notProperty(options, 'timeoutMsec');
        (new ServiceInstancesMonitor(options, validConsulClient));
    });

    dataDriven(testParams.notANumber, function () {
        it('incorrect type of options.timeoutMsec property, type = {type}', function (arg) {
            const options = _.set(_.cloneDeep(validOptions), 'timeoutMsec', arg.value);

            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(options, validConsulClient);
                },
                TypeError,
                'options.timeoutMsec must be a positive integer if set'
            );
        });
    });

    dataDriven(testParams.notAnObject, function () {
        it('incorrect type of consul argument, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(validOptions, arg.value);
                },
                TypeError,
                'consul argument does not look like Consul object'
            );
        });
    });

    dataDriven(testParams.notAFunction, function () {
        it('incorrect type of consul.watch method, type = {type}', function (arg) {
            const consulClient = _.set(_.cloneDeep(validConsulClient), 'watch', arg.value);

            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(validOptions, consulClient);
                },
                TypeError,
                'consul argument does not look like Consul object'
            );
        });
    });

    dataDriven(testParams.notAnObject, function () {
        it('incorrect type of consul.health object, type = {type}', function (arg) {
            const consulClient = _.set(_.cloneDeep(validConsulClient), 'health', arg.value);

            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(validOptions, consulClient);
                },
                TypeError,
                'consul argument does not look like Consul object'
            );
        });
    });

    dataDriven(testParams.notAFunction, function () {
        it('incorrect type of consul.health.service method, type = {type}', function (arg) {
            const consulClient = _.set(_.cloneDeep(validConsulClient), 'health.service', arg.value);

            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(validOptions, consulClient);
                },
                TypeError,
                'consul argument does not look like Consul object'
            );
        });
    });
});
