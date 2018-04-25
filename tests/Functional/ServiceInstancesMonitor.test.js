'use strict';

const _ = require('lodash');
const {assertThrowsAsync} = require('../support/helpers');
const consul = require('consul');
const nock = require('nock');
const assert = require('chai').assert;
const sinon = require('sinon');
const deepFreeze = require('deep-freeze');
const getPort = require('get-port');
const ServiceInstance = require('src/ServiceInstance');
const ServiceInstances = require('src/ServiceInstances');
const ServiceInstancesMonitor = require('src/ServiceInstancesMonitor');
const {WatchError, InvalidDataError} = require('src/Error');

const nockTestParams = require('./nock.data');

describe('ServiceInstancesMonitor methods tests', function () {

    const consulHost = '127.0.0.1';
    let consulPort;
    let consulHostAndPort;
    let consulClient;

    const options = deepFreeze({
        serviceName: 'transcoder',
        timeoutMsec: 500,
        checkNameWithStatus: 'Transcoder health status'
    });

    before(async () => {
        consulPort = await getPort();
        consulHostAndPort = `http://${consulHost}:${consulPort}`;
    });

    beforeEach(function () {
        consulClient = consul({
            host: consulHost,
            port: consulPort,
            promisify: true
        });

        nock.cleanAll();
    });

    after(function () {
        nock.cleanAll();
    });


    it('not started monitor', function () {
        const monitor = new ServiceInstancesMonitor(options, consulClient);

        assert.isFalse(monitor.isInitialized());
        assert.isFalse(monitor.isWatchHealthy());
        assert.instanceOf(monitor.getInstances(), ServiceInstances);
        assert.isEmpty(monitor.getInstances().getHealthy());
        assert.isEmpty(monitor.getInstances().getUnhealthy());
    });

    it('stop on not started monitor', function () {
        const monitor = new ServiceInstancesMonitor(options, consulClient);
        let returnedValue;
        assert.doesNotThrow(() => {
            returnedValue = monitor.stopService();
        });

        assert.isFalse(monitor.isInitialized());
        assert.isFalse(monitor.isWatchHealthy());
        assert.instanceOf(monitor.getInstances(), ServiceInstances);
        assert.isEmpty(monitor.getInstances().getHealthy());
        assert.isEmpty(monitor.getInstances().getUnhealthy());
        assert.strictEqual(returnedValue, monitor);
    });

    it('start monitor fails if port is closed', async function () {
        const monitor = new ServiceInstancesMonitor(options, consulClient);

        await assertThrowsAsync(
            () => monitor.startService(),
            WatchError,
            /connect ECONNREFUSED/
        );
    });

    it('start monitor fails due to consul response timeout - no requests after timeout', async function () {
        // in this test monitor must response with WatchTimeoutError after options.timeoutMsec
        // then after extra options.timeoutMsec time response from nock must be returned
        // and monitor must ignore that update

        this.slow(options.timeoutMsec * 8);
        this.timeout(options.timeoutMsec * 4);

        const nockInstance = nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: '0', wait: '60s'})
            .delay(options.timeoutMsec * 2)
            .reply(200, 'not a json')
            .get(`/v1/health/service/${options.serviceName}`).query({index: '0', wait: '60s'})
            .reply(200, 'not a json');

        let changeFired = false;
        const monitor = new ServiceInstancesMonitor(options, consulClient);
        monitor.on('changed', () => {
            changeFired = true;
        });

        await assertThrowsAsync(
            () => monitor.startService(),
            WatchError,
            /request timed out/ig
        );

        const waitFn = () => {
            return new Promise(resolve => {
                setTimeout(resolve, options.timeoutMsec * 2);
            });
        };

        await waitFn();

        assert.isFalse(nockInstance.isDone());
        assert.isFalse(changeFired);
        assert.isFalse(monitor.isInitialized());
        assert.isFalse(monitor.isWatchHealthy());
        assert.isEmpty(monitor.getInstances().getHealthy());
        assert.isEmpty(monitor.getInstances().getUnhealthy());
    });

    it('monitor becomes initialized and watch becomes healthy after start of monitor', async function () {
        const firstRequestIndex = 0;
        // blocking queries read X-Consul-Index header and make next request using that value as index
        const secondRequestIndex = nockTestParams.firstResponseHeaders['X-Consul-Index'];

        nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders)
            .get(`/v1/health/service/${options.serviceName}`).query({index: secondRequestIndex, wait: '60s'})
            .delay(60000)
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders);

        const monitor = new ServiceInstancesMonitor(options, consulClient);
        await monitor.startService();

        assert.isTrue(monitor.isInitialized());
        assert.isTrue(monitor.isWatchHealthy());
        monitor.stopService();
    });

    it('check of initial list of nodes received from startService', async function () {
        const expectedNode1 = new ServiceInstance(
            nockTestParams.firstResponseBody[0].Node.TaggedAddresses.lan,
            nockTestParams.firstResponseBody[0].Node.TaggedAddresses.wan,
            nockTestParams.firstResponseBody[0].Service.Port,
            nockTestParams.firstResponseBody[0].Node.Address,
            nockTestParams.firstResponseBody[0].Node.Node,
            nockTestParams.firstResponseBody[0].Service.ID,
            nockTestParams.firstResponseBody[0].Service.Tags,
            null
        );

        const expectedNode2 = new ServiceInstance(
            nockTestParams.firstResponseBody[1].Node.TaggedAddresses.lan,
            nockTestParams.firstResponseBody[1].Node.TaggedAddresses.wan,
            nockTestParams.firstResponseBody[1].Service.Port,
            nockTestParams.firstResponseBody[1].Node.Address,
            nockTestParams.firstResponseBody[1].Node.Node,
            nockTestParams.firstResponseBody[1].Service.ID,
            nockTestParams.firstResponseBody[1].Service.Tags,
            null
        );

        const firstRequestIndex = 0;
        // blocking queries read X-Consul-Index header and make next request using that value as index
        const secondRequestIndex = nockTestParams.firstResponseHeaders['X-Consul-Index'];

        nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders)
            .get(`/v1/health/service/${options.serviceName}`).query({index: secondRequestIndex, wait: '60s'})
            .delay(60000)
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders);

        const monitor = new ServiceInstancesMonitor(options, consulClient);
        const initialInstances = await monitor.startService();
        monitor.stopService();

        assert.instanceOf(initialInstances, ServiceInstances);
        assert.lengthOf(initialInstances.getHealthy(), 2);
        assert.isEmpty(initialInstances.getUnhealthy());

        const [node1, node2] = initialInstances.getHealthy();

        assert.instanceOf(node1, ServiceInstance);
        assert.instanceOf(node2, ServiceInstance);
        assert.deepEqual(node1, expectedNode1);
        assert.deepEqual(node2, expectedNode2);
    });

    it('initial list of nodes is the same as received from getter', async function () {
        const firstRequestIndex = 0;
        // blocking queries read X-Consul-Index header and make next request using that value as index
        const secondRequestIndex = nockTestParams.firstResponseHeaders['X-Consul-Index'];

        nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders)
            .get(`/v1/health/service/${options.serviceName}`).query({index: secondRequestIndex, wait: '60s'})
            .delay(60000)
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders);

        const monitor = new ServiceInstancesMonitor(options, consulClient);
        const initialInstances = await monitor.startService();
        const instancesFromGetter = monitor.getInstances();
        monitor.stopService();

        assert.strictEqual(initialInstances, instancesFromGetter);
    });

    it('initial list of nodes with serfHealth checks in critical status, one service with OK, another ' +
        'with MAINTENANCE', async function () {
        const firstResponseBody = _.cloneDeep(nockTestParams.serfHealthCriticalResponseBody);

        const firstExpectedErrorType = InvalidDataError;
        const firstExpectedErrorMessage = 'serfHealth check is in critical state, node will be skipped';
        const firstExpectedErrorExtra = {node: firstResponseBody[0]};

        const secondExpectedErrorType = InvalidDataError;
        const secondExpectedErrorMessage = 'serfHealth check is in critical state, node will be skipped';
        const secondExpectedErrorExtra = {node: firstResponseBody[1]};

        const firstRequestIndex = 0;
        // blocking queries read X-Consul-Index header and make next request using that value as index
        const secondRequestIndex = nockTestParams.serfHealthCriticalResponseHeaders['X-Consul-Index'];

        nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(
                200,
                nockTestParams.serfHealthCriticalResponseBody,
                nockTestParams.serfHealthCriticalResponseHeaders
            )
            .get(`/v1/health/service/${options.serviceName}`).query({index: secondRequestIndex, wait: '60s'})
            .delay(60000)
            .reply(
                200,
                nockTestParams.serfHealthCriticalResponseBody,
                nockTestParams.serfHealthCriticalResponseHeaders
            );

        const waitFn = () => {
            return new Promise(resolve => {
                setTimeout(resolve, 10);
            });
        };

        const errors = [];
        const monitor = new ServiceInstancesMonitor(options, consulClient);
        monitor.on('error', (error) => {
            errors.push(error);
        });

        const initialInstances = await monitor.startService();

        // need to wait for emitting of errors
        await waitFn();


        assert.isTrue(monitor.isInitialized());
        assert.isTrue(monitor.isWatchHealthy());

        assert.lengthOf(errors, 2);
        assert.instanceOf(errors[0], firstExpectedErrorType);
        assert.strictEqual(errors[0].message, firstExpectedErrorMessage);
        assert.deepEqual(errors[0].extra, firstExpectedErrorExtra);
        assert.instanceOf(errors[1], secondExpectedErrorType);
        assert.strictEqual(errors[1].message, secondExpectedErrorMessage);
        assert.deepEqual(errors[1].extra, secondExpectedErrorExtra);

        assert.instanceOf(initialInstances, ServiceInstances);
        assert.isEmpty(initialInstances.getHealthy());
        assert.isEmpty(initialInstances.getUnhealthy());

        monitor.stopService();
    });

    it('reaction on a request timeout during startService', async function () {
        this.slow(options.timeoutMsec * 5);
        this.timeout(options.timeoutMsec * 5);

        const firstRequestIndex = 0;

        const nockInstance = nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .delay(options.timeoutMsec * 2)
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders);

        let changeFired = false;
        const monitor = new ServiceInstancesMonitor(options, consulClient);

        monitor.on('changed', () => {
            changeFired = true;
        });

        await assertThrowsAsync(
            () => monitor.startService(),
            WatchError,
            /request timed out/ig
        );

        assert.isFalse(nockInstance.isDone());
        assert.isFalse(changeFired);
        assert.isFalse(monitor.isInitialized());
        assert.isFalse(monitor.isWatchHealthy());
        assert.isEmpty(monitor.getInstances().getHealthy());
        assert.isEmpty(monitor.getInstances().getUnhealthy());
        assert.isFalse(monitor._isWatcherRegistered());
        monitor.stopService();
    });

    it('reaction on 500 error from consul during startService', async function () {
        this.slow(options.timeoutMsec * 5);
        this.timeout(options.timeoutMsec * 5);

        const firstRequestIndex = 0;

        const nockInstance = nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(500, 'Internal error')
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders);

        let changeFired = false;
        const monitor = new ServiceInstancesMonitor(options, consulClient);

        monitor.on('changed', () => {
            changeFired = true;
        });

        await assertThrowsAsync(() => monitor.startService(), WatchError, 'internal server error');


        const waitFn = () => {
            return new Promise(resolve => {
                setTimeout(resolve, options.timeoutMsec * 2);
            });
        };

        await waitFn();

        assert.isFalse(nockInstance.isDone());
        assert.isFalse(changeFired);
        assert.isFalse(monitor.isInitialized());
        assert.isFalse(monitor.isWatchHealthy());
        assert.isEmpty(monitor.getInstances().getHealthy());
        assert.isEmpty(monitor.getInstances().getUnhealthy());
        assert.isFalse(monitor._isWatcherRegistered());
    });

    it('reaction on 400 error from consul during startService', async function () {
        this.slow(options.timeoutMsec * 15);
        this.timeout(options.timeoutMsec * 5);

        const firstRequestIndex = 0;

        const nockInstance = nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(400, 'Internal error')
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders);

        let changeFired = false;
        const monitor = new ServiceInstancesMonitor(options, consulClient);

        monitor.on('changed', () => {
            changeFired = true;
        });

        await assertThrowsAsync(() => monitor.startService(), WatchError, 'bad request');


        const waitFn = () => {
            return new Promise(resolve => {
                setTimeout(resolve, options.timeoutMsec * 2);
            });
        };

        await waitFn();

        assert.isFalse(nockInstance.isDone());
        assert.isFalse(changeFired);
        assert.isFalse(monitor.isInitialized());
        assert.isFalse(monitor.isWatchHealthy());
        assert.isEmpty(monitor.getInstances().getHealthy());
        assert.isEmpty(monitor.getInstances().getUnhealthy());
        assert.isFalse(monitor._isWatcherRegistered());
    });

    it('emission of error on initial data', async function () {
        const firstResponseBody = _.cloneDeep(nockTestParams.firstResponseBody);
        firstResponseBody[0].Checks[1].Name = 'Name of check that will not match checkNameWithStatus';

        const expectedErrorType = InvalidDataError;
        const expectedErrorMessage = 'Check with `checkNameWithStatus` was not found among all checks on the ' +
            'node, node will be skipped';
        const expectedErrorExtra = {node: firstResponseBody[0]};

        const firstRequestIndex = 0;
        // blocking queries read X-Consul-Index header and make next request using that value as index
        const secondRequestIndex = nockTestParams.firstResponseHeaders['X-Consul-Index'];

        nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(200, firstResponseBody, nockTestParams.firstResponseHeaders)
            .get(`/v1/health/service/${options.serviceName}`).query({index: secondRequestIndex, wait: '60s'})
            .delay(60000)
            .reply(200, firstResponseBody, nockTestParams.firstResponseHeaders);

        const waitFn = () => {
            return new Promise(resolve => {
                setTimeout(resolve, 100);
            });
        };

        const errors = [];
        const monitor = new ServiceInstancesMonitor(options, consulClient);
        monitor.on('error', (error) => {
            errors.push(error);
        });

        const initialInstances = await monitor.startService();

        assert.lengthOf(errors, 0);
        assert.instanceOf(initialInstances, ServiceInstances);
        assert.lengthOf(initialInstances.getHealthy(), 1);
        assert.isEmpty(initialInstances.getUnhealthy());

        await waitFn();

        assert.lengthOf(errors, 1);
        assert.instanceOf(errors[0], expectedErrorType);
        assert.strictEqual(errors[0].message, expectedErrorMessage);
        assert.deepEqual(errors[0].extra, expectedErrorExtra);
        monitor.stopService();
    });

    it('auto retry service restart on watcher "end"', async function () {
        const firstRequestIndex = 0;
        const secondRequestIndex = nockTestParams.firstResponseHeaders['X-Consul-Index'];

        const nockInstance = nock(consulHostAndPort)
            .get(`/v1/health/service/${options.serviceName}`).query({index: firstRequestIndex, wait: '60s'})
            .reply(200, nockTestParams.firstResponseBody, nockTestParams.firstResponseHeaders)
            .get(`/v1/health/service/${options.serviceName}`).query({index: secondRequestIndex, wait: '60s'})
            .reply(400, 'Not available');

        let changeFired = false;
        let unhealthyFired = false;
        const errors = [];
        const monitor = new ServiceInstancesMonitor(options, consulClient);

        sinon.stub(monitor, '_retryStartService');

        monitor.on('changed', () => {
            changeFired = true;
        });

        monitor.on('error', err => {
            errors.push(err);
        });

        monitor.on('unhealthy', () => {
            unhealthyFired = true;
        });

        await monitor.startService();

        const waitFn = () => {
            return new Promise(resolve => {
                setTimeout(resolve, options.timeoutMsec * 2);
            });
        };

        await waitFn();

        assert.isTrue(nockInstance.isDone());
        assert.isFalse(changeFired);
        assert.isTrue(unhealthyFired);
        assert.isFalse(monitor.isInitialized());
        assert.isFalse(monitor.isWatchHealthy());
        assert.lengthOf(monitor.getInstances().getHealthy(), nockTestParams.firstResponseBody.length);
        assert.isEmpty(monitor.getInstances().getUnhealthy());
        assert.lengthOf(errors, 1);
        assert.instanceOf(errors[0], WatchError);
        assert.isFalse(monitor._isWatcherRegistered());
        assert.isTrue(monitor._retryStartService.calledOnce);
        assert.isTrue(monitor._retryStartService.calledWithExactly());
    });
});
