'use strict';

const _ = require('lodash');
const consul = require('consul');
const assert = require('chai').assert;
const sinon = require('sinon');
const dataDriven = require('data-driven');
const deepFreeze = require('deep-freeze');
const ServiceInstancesMonitor = require('src/ServiceInstancesMonitor');
const ServiceInstances = require('src/ServiceInstances');
const WatchError = require('src/Error').WatchError;

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
    // all type except number
    notANumber: [
        vt('string'), vt(true), vt(undefined), vt(Symbol()), vt({}), vt(setTimeout), vt(null)
    ],
    // all types except string
    notAString: [
        vt(true), vt(123), vt(undefined), vt(Symbol()), vt({}), vt(setTimeout), vt(null)
    ],
    // all types except object
    notAnObject: [
        vt('string'), vt(true), vt(123), vt(undefined), vt(Symbol()), vt(setTimeout), vt(null)
    ],
    // all types except object
    notAnObjectExceptUndefined: [
        vt('string'), vt(true), vt(123), vt(Symbol()), vt(setTimeout), vt(null), vt([])
    ],
    notAFunction: [
        vt('string'), vt(true), vt(123), vt(undefined), vt(Symbol()), vt({}), vt(null)
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
        new ServiceInstancesMonitor(validOptions, validConsulClient);
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

    dataDriven(testParams.notAnObjectExceptUndefined, function () {
        it('incorrect type of extractors argument, type = {type}', function (arg) {

            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(validOptions, validConsulClient, arg.value);
                },
                TypeError,
                'extractors argument must be an plain object or undefined'
            );
        });
    });

    dataDriven(testParams.notAFunction, function () {
        it('method "extract" of extractors is incorrect, type = {type}', function (arg) {
            /** @var {{value: *, type: string}} arg */
            assert.throws(
                function () {
                    new ServiceInstancesMonitor(validOptions, validConsulClient, {[arg.type]: arg.value});
                },
                TypeError,
                'extractors instances must have a method "extract"'
            );
        });
    });

    it('no errors on extractors argument equal undefined', function () {
        new ServiceInstancesMonitor(validOptions, validConsulClient, undefined);
    });
});

describe('ServiceInstancesMonitor::_retryStartService', function () {
    const options = deepFreeze({
        serviceName: 'transcoder',
        timeoutMsec: 100,
        checkNameWithStatus: "Service 'transcoder' check"
    });
    const consulClient = consul();

    it('successfully restart watcher', async function () {
        const serviceInstances = new ServiceInstances();
        const monitor = new ServiceInstancesMonitor(options, consulClient, undefined);

        const serviceStartStub = sinon.stub(monitor, 'startService');
        serviceStartStub.returns(serviceInstances);

        let changeFired = false;
        let healthyFired = false;
        let firedInstances = undefined;

        monitor.on('changed', instances => {
            changeFired = true;
            firedInstances = instances;
        });

        monitor.on('healthy', () => {
            healthyFired = true;
        });

        await monitor._retryStartService();

        assert.isTrue(changeFired);
        assert.isTrue(healthyFired);
        assert.isTrue(serviceStartStub.calledOnce);
        assert.isTrue(serviceStartStub.calledWithExactly());
        assert.deepEqual(monitor._serviceInstances, serviceInstances);
        assert.deepEqual(firedInstances, serviceInstances);
    });

    it('on error from "startService()" retry run "_retryStartService" after timeout', async function () {
        const DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC = 1000;

        this.timeout(DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC * 3);

        const serviceInstances = new ServiceInstances();
        const monitor = new ServiceInstancesMonitor(options, consulClient, undefined);

        const serviceStartStub = sinon.stub(monitor, 'startService');
        serviceStartStub.onFirstCall().rejects(new WatchError('Some error'));
        serviceStartStub.onSecondCall().returns(serviceInstances);

        const retryStartServiceSpy = sinon.spy(monitor, '_retryStartService');

        let changedFiredCount = 0;
        let healthyFiredCount = 0;
        let firedInstances = undefined;
        const errors = [];

        monitor.on('changed', instances => {
            changedFiredCount++;
            firedInstances = instances;
        });

        monitor.on('error', error => {
            errors.push(error);
        });

        monitor.on('healthy', () => {
            healthyFiredCount++;
        });

        function waitFn() {
            return new Promise(resolve => {
                setTimeout(resolve, DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC * 2);
            });
        }

        await monitor._retryStartService();

        await waitFn();

        assert.equal(changedFiredCount, 1);
        assert.equal(healthyFiredCount, 1);
        assert.isTrue(retryStartServiceSpy.calledTwice);
        assert.isTrue(serviceStartStub.calledTwice);
        assert.isTrue(serviceStartStub.calledWithExactly());
        assert.deepEqual(monitor._serviceInstances, serviceInstances);
        assert.deepEqual(firedInstances, serviceInstances);
        assert.lengthOf(errors, 1);
        assert.instanceOf(errors[0], WatchError);
        assert.match(errors[0], /Some error/);
    });

    it('not retry run "_retryStartService" after "stopService" calling', async function () {
        const DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC = 1000;

        this.timeout(DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC * 3);

        const serviceInstances = new ServiceInstances();
        const monitor = new ServiceInstancesMonitor(options, consulClient, undefined);

        const serviceStartStub = sinon.stub(monitor, 'startService');
        serviceStartStub.onFirstCall().rejects(new WatchError('Some error'));
        serviceStartStub.onSecondCall().returns(serviceInstances);

        const retryStartServiceSpy = sinon.spy(monitor, '_retryStartService');

        let isChangeFired = false;
        const errors = [];

        monitor.on('changed', instances => {
            isChangeFired = true;
        });

        monitor.on('error', error => {
            errors.push(error);
        });

        function waitFn() {
            return new Promise(resolve => {
                setTimeout(resolve, DEFAULT_RETRY_START_SERVICE_TIMEOUT_MSEC * 2);
            });
        }

        await monitor._retryStartService();

        monitor.stopService();

        await waitFn();

        assert.isFalse(isChangeFired);
        assert.isTrue(retryStartServiceSpy.calledOnce);
        assert.isTrue(serviceStartStub.calledOnce);
        assert.isTrue(serviceStartStub.calledWithExactly());
        assert.lengthOf(errors, 1);
        assert.instanceOf(errors[0], WatchError);
        assert.match(errors[0], /Some error/);
    });
});

describe('ServiceInstancesMonitor::_setFallbackToWatchHealthy', () => {
    let tg;
    let clock;

    beforeEach(() => {
        clock = sinon.useFakeTimers();

        tg = sinon.createStubInstance(ServiceInstancesMonitor);

        tg._watchAnyNodeChange = {
            updateTime: sinon.stub(),
            isRunning:  sinon.stub(),
        };
    });

    afterEach(() => clock.restore());

    it('should unset previous fallback interval if it exists', () => {
        tg._setFallbackToWatchHealthy.restore();

        tg._fallbackToWatchHealthyInterval = 123;

        tg._setFallbackToWatchHealthy();

        assert.isOk(tg._unsetFallbackToWatchHealthy.calledOnce);

        sinon.assert.callOrder(
            tg._unsetFallbackToWatchHealthy, tg._watchAnyNodeChange.updateTime
        );

        clearInterval(tg._fallbackToWatchHealthyInterval);
    });

    it('should correctly stops working when watcher becomes unregistered', () => {
        tg._setFallbackToWatchHealthy.restore();

        tg._unsetFallbackToWatchHealthy.callThrough();

        tg._fallbackToWatchHealthyInterval = null;

        tg._watchAnyNodeChange.updateTime.returns(123);
        tg._isWatcherRegistered.returns(true);
        tg._watchAnyNodeChange.isRunning.returns(true);

        tg._setFallbackToWatchHealthy();

        assert.isOk(tg._watchAnyNodeChange.updateTime.calledOnce);
        assert.isNotNull(tg._fallbackToWatchHealthyInterval);
        assert.isOk(tg._unsetFallbackToWatchHealthy.notCalled);

        clock.tick(5000);

        tg._isWatcherRegistered.returns(false);

        clock.tick(1000);

        assert.isOk(tg._unsetFallbackToWatchHealthy.calledOnce);
        assert.isOk(tg._setWatchHealthy.notCalled);

        sinon.assert.callOrder(
            tg._watchAnyNodeChange.updateTime, tg._unsetFallbackToWatchHealthy
        );

        assert.isNull(tg._fallbackToWatchHealthyInterval);
    });

    it('should correctly stops working when watcher is not running', () => {
        tg._setFallbackToWatchHealthy.restore();

        tg._unsetFallbackToWatchHealthy.callThrough();

        tg._fallbackToWatchHealthyInterval = null;

        tg._watchAnyNodeChange.updateTime.returns(123);
        tg._isWatcherRegistered.returns(true);
        tg._watchAnyNodeChange.isRunning.returns(true);

        tg._setFallbackToWatchHealthy();

        assert.isOk(tg._watchAnyNodeChange.updateTime.calledOnce);
        assert.isNotNull(tg._fallbackToWatchHealthyInterval);
        assert.isOk(tg._unsetFallbackToWatchHealthy.notCalled);

        clock.tick(5000);

        tg._watchAnyNodeChange.isRunning.returns(false);

        clock.tick(1000);

        assert.isOk(tg._unsetFallbackToWatchHealthy.calledOnce);
        assert.isOk(tg._setWatchHealthy.notCalled);

        sinon.assert.callOrder(
            tg._watchAnyNodeChange.updateTime, tg._unsetFallbackToWatchHealthy
        );

        assert.isNull(tg._fallbackToWatchHealthyInterval);
    });

    it('should correctly stops working when watch becomes healthy', () => {
        tg._setFallbackToWatchHealthy.restore();

        tg._unsetFallbackToWatchHealthy.callThrough();

        tg._fallbackToWatchHealthyInterval = null;

        tg._watchAnyNodeChange.updateTime.returns(123);
        tg._isWatcherRegistered.returns(true);
        tg._watchAnyNodeChange.isRunning.returns(true);
        tg.isWatchHealthy.returns(false);

        tg._setFallbackToWatchHealthy();

        assert.isOk(tg._watchAnyNodeChange.updateTime.calledOnce);
        assert.isNotNull(tg._fallbackToWatchHealthyInterval);
        assert.isOk(tg._unsetFallbackToWatchHealthy.notCalled);

        clock.tick(5000);

        tg.isWatchHealthy.returns(true);

        clock.tick(1000);

        assert.isOk(tg._unsetFallbackToWatchHealthy.calledOnce);
        assert.isOk(tg._setWatchHealthy.notCalled);

        sinon.assert.callOrder(
            tg._watchAnyNodeChange.updateTime, tg.isWatchHealthy, tg._unsetFallbackToWatchHealthy
        );

        assert.isNull(tg._fallbackToWatchHealthyInterval);
    });

    it('should correctly fallbacks to healthy state', () => {
        tg._setFallbackToWatchHealthy.restore();

        tg._unsetFallbackToWatchHealthy.callThrough();

        tg._fallbackToWatchHealthyInterval = null;

        tg._watchAnyNodeChange.updateTime.returns(123);
        tg._isWatcherRegistered.returns(true);
        tg._watchAnyNodeChange.isRunning.returns(true);
        tg.isWatchHealthy.returns(false);

        tg._setFallbackToWatchHealthy();

        assert.isOk(tg._watchAnyNodeChange.updateTime.calledOnce);
        assert.isNotNull(tg._fallbackToWatchHealthyInterval);
        assert.isOk(tg._unsetFallbackToWatchHealthy.notCalled);

        clock.tick(5000);

        tg._watchAnyNodeChange.updateTime.returns(1234);

        clock.tick(1000);

        assert.isOk(tg._unsetFallbackToWatchHealthy.calledOnce);
        assert.isOk(tg._setWatchHealthy.calledOnce);

        sinon.assert.callOrder(
            tg._watchAnyNodeChange.updateTime,
            tg.isWatchHealthy,
            tg._watchAnyNodeChange.updateTime,
            tg._unsetFallbackToWatchHealthy,
            tg._setWatchHealthy
        );

        assert.isNull(tg._fallbackToWatchHealthyInterval);
    });
});
