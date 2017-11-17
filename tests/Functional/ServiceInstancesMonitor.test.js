'use strict';

const _ = require('lodash');
const async_ = require('asyncawait/async');
const await_ = require('asyncawait/await');
const consul = require('consul');
const nock = require('nock');
const assert = require('chai').assert;
const deepFreeze = require('deep-freeze');
const getPort = require('get-port');
const ServiceInstance = require('src/ServiceInstance');
const ServiceInstanceStatus = require('src/ServiceInstanceStatus');
const ServiceInstances = require('src/ServiceInstances');
const ServiceInstancesMonitor = require('src/ServiceInstancesMonitor');
const {WatchError, WatchTimeoutError, InvalidDataError} = require('src/Error');

const nockTestParams = require('./nock.data');

describe('ServiceInstancesMonitor::constructor', function () {

    const consulHost = '127.0.0.1';
    let consulPort;
    let consulHostAndPort;
    let consulClient;

    const options = deepFreeze({
        serviceName: 'transcoder',
        timeoutMsec: 500,
        checkNameWithStatus: 'Transcoder health status'
    });

    before(async_(() => {
        consulPort = await_(getPort());
        consulHostAndPort = `http://${consulHost}:${consulPort}`;
    }));

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
        assert.isEmpty(monitor.getInstances().getOnMaintenance());
        assert.isEmpty(monitor.getInstances().getOverloaded());
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
        assert.isEmpty(monitor.getInstances().getOnMaintenance());
        assert.isEmpty(monitor.getInstances().getOverloaded());
        assert.isEmpty(monitor.getInstances().getUnhealthy());
        assert.strictEqual(returnedValue, monitor);
    });

    it('start monitor fails if port is closed', (done) => {
        async_(() => {
            const monitor = new ServiceInstancesMonitor(options, consulClient);
            assert.throws(() => {
                await_(monitor.startService());
            }, WatchError, /connect ECONNREFUSED/);
        })().then(done).catch(done);
    });

    it('start monitor fails due to consul response timeout - no requests after timeout', function (done) {
        // in this test monitor must response with WatchTimeoutError after options.timeoutMsec
        // then after extra options.timeoutMsec time response from nock must be returned
        // and monitor must ignore that update

        this.timeout(options.timeoutMsec * 4);

        async_(() => {
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

            assert.throws(() => {
                await_(monitor.startService());
            }, WatchTimeoutError, 'Initial consul watch request was timed out');

            const waitFn = () => {
                return new Promise(resolve => {
                    setTimeout(resolve, options.timeoutMsec * 2);
                });
            };

            await_(waitFn());

            assert.isFalse(nockInstance.isDone());
            assert.isFalse(changeFired);
            assert.isFalse(monitor.isInitialized());
            assert.isFalse(monitor.isWatchHealthy());
            assert.isEmpty(monitor.getInstances().getHealthy());
            assert.isEmpty(monitor.getInstances().getOnMaintenance());
            assert.isEmpty(monitor.getInstances().getOverloaded());
            assert.isEmpty(monitor.getInstances().getUnhealthy());
        })().then(done).catch(done);
    });

    it('monitor becomes initialized and watch becomes healthy after start of monitor', function (done) {
        async_(() => {
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
            await_(monitor.startService());

            assert.isTrue(monitor.isInitialized());
            assert.isTrue(monitor.isWatchHealthy());
        })().then(done).catch(done);
    });

    it('check of initial list of nodes received from startService', function (done) {
        async_(() => {
            const expectedNode1 = new ServiceInstance(
                nockTestParams.firstResponseBody[0].Node.TaggedAddresses.lan,
                nockTestParams.firstResponseBody[0].Node.TaggedAddresses.wan,
                nockTestParams.firstResponseBody[0].Service.Port,
                nockTestParams.firstResponseBody[0].Node.Address,
                nockTestParams.firstResponseBody[0].Node.Node,
                nockTestParams.firstResponseBody[0].Service.Tags,
                new ServiceInstanceStatus(
                    nockTestParams.loadData1.pid,
                    nockTestParams.loadData1.status,
                    nockTestParams.loadData1.mem.total,
                    nockTestParams.loadData1.mem.free,
                    nockTestParams.loadData1.cpu.usage,
                    nockTestParams.loadData1.cpu.count
                )
            );

            const expectedNode2 = new ServiceInstance(
                nockTestParams.firstResponseBody[1].Node.TaggedAddresses.lan,
                nockTestParams.firstResponseBody[1].Node.TaggedAddresses.wan,
                nockTestParams.firstResponseBody[1].Service.Port,
                nockTestParams.firstResponseBody[1].Node.Address,
                nockTestParams.firstResponseBody[1].Node.Node,
                nockTestParams.firstResponseBody[1].Service.Tags,
                new ServiceInstanceStatus(
                    nockTestParams.loadData1.pid,
                    nockTestParams.loadData1.status,
                    nockTestParams.loadData1.mem.total,
                    nockTestParams.loadData1.mem.free,
                    nockTestParams.loadData1.cpu.usage,
                    nockTestParams.loadData1.cpu.count
                )
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
            const initialInstances = await_(monitor.startService());

            assert.instanceOf(initialInstances, ServiceInstances);
            assert.lengthOf(initialInstances.getHealthy(), 2);
            assert.isEmpty(initialInstances.getOnMaintenance());
            assert.isEmpty(initialInstances.getOverloaded());
            assert.isEmpty(initialInstances.getUnhealthy());

            const [node1, node2] = initialInstances.getHealthy();

            assert.instanceOf(node1, ServiceInstance);
            assert.instanceOf(node2, ServiceInstance);
            assert.deepEqual(node1, expectedNode1);
            assert.deepEqual(node2, expectedNode2);
        })().then(done).catch(done);
    });

    it('initial list of nodes is the same as received from getter', function (done) {
        async_(() => {
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
            const initialInstances = await_(monitor.startService());
            const instancesFromGetter = monitor.getInstances();

            assert.strictEqual(initialInstances, instancesFromGetter);
        })().then(done).catch(done);
    });

    it('reaction on 500 error from consul during startService', function (done) {
        this.timeout(options.timeoutMsec * 5);

        async_(() => {
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

            assert.throws(() => {
                await_(monitor.startService());
            }, WatchError, 'internal server error');


            const waitFn = () => {
                return new Promise(resolve => {
                    setTimeout(resolve, options.timeoutMsec * 2);
                });
            };

            await_(waitFn());

            assert.isFalse(nockInstance.isDone());
            assert.isFalse(changeFired);
            assert.isFalse(monitor.isInitialized());
            assert.isFalse(monitor.isWatchHealthy());
            assert.isEmpty(monitor.getInstances().getHealthy());
            assert.isEmpty(monitor.getInstances().getOnMaintenance());
            assert.isEmpty(monitor.getInstances().getOverloaded());
            assert.isEmpty(monitor.getInstances().getUnhealthy());
        })().then(done).catch(done);
    });

    it('reaction on 400 error from consul during startService', function (done) {
        this.timeout(options.timeoutMsec * 5);

        async_(() => {
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

            assert.throws(() => {
                await_(monitor.startService());
            }, WatchError, 'bad request');


            const waitFn = () => {
                return new Promise(resolve => {
                    setTimeout(resolve, options.timeoutMsec * 2);
                });
            };

            await_(waitFn());

            assert.isFalse(nockInstance.isDone());
            assert.isFalse(changeFired);
            assert.isFalse(monitor.isInitialized());
            assert.isFalse(monitor.isWatchHealthy());
            assert.isEmpty(monitor.getInstances().getHealthy());
            assert.isEmpty(monitor.getInstances().getOnMaintenance());
            assert.isEmpty(monitor.getInstances().getOverloaded());
            assert.isEmpty(monitor.getInstances().getUnhealthy());
        })().then(done).catch(done);
    });

    it('emission of error on initial data', function (done) {
        async_(() => {
            const expectedNode2 = new ServiceInstance(
                nockTestParams.firstResponseBody[1].Node.TaggedAddresses.lan,
                nockTestParams.firstResponseBody[1].Node.TaggedAddresses.wan,
                nockTestParams.firstResponseBody[1].Service.Port,
                nockTestParams.firstResponseBody[1].Node.Address,
                nockTestParams.firstResponseBody[1].Node.Node,
                nockTestParams.firstResponseBody[1].Service.Tags,
                new ServiceInstanceStatus(
                    nockTestParams.loadData1.pid,
                    nockTestParams.loadData1.status,
                    nockTestParams.loadData1.mem.total,
                    nockTestParams.loadData1.mem.free,
                    nockTestParams.loadData1.cpu.usage,
                    nockTestParams.loadData1.cpu.count
                )
            );

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
                    setTimeout(resolve, 0);
                });
            };

            const errors = [];
            const monitor = new ServiceInstancesMonitor(options, consulClient);
            monitor.on('error', (error) => {
                errors.push(error);
            });

            const initialInstances = await_(monitor.startService());

            assert.lengthOf(errors, 0);

            assert.instanceOf(initialInstances, ServiceInstances);
            assert.lengthOf(initialInstances.getHealthy(), 1);
            assert.isEmpty(initialInstances.getOnMaintenance());
            assert.isEmpty(initialInstances.getOverloaded());
            assert.isEmpty(initialInstances.getUnhealthy());

            const [node2] = initialInstances.getHealthy();

            assert.instanceOf(node2, ServiceInstance);
            assert.deepEqual(node2, expectedNode2);

            await_(waitFn());

            assert.lengthOf(errors, 1);
            assert.instanceOf(errors[0], expectedErrorType);
            assert.strictEqual(errors[0].message, expectedErrorMessage);
            assert.deepEqual(errors[0].extra, expectedErrorExtra);
        })().then(done).catch(done);
    });
});
