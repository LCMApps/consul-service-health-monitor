'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('chai').assert;
const deepFreeze = require('deep-freeze');
const ServiceInstance = require('src/ServiceInstance');
const ServiceInstanceInfo = require('src/ServiceInstanceInfo');


describe('Factory::buildServiceInstance', function () {

    const stub = sinon.stub();

    class FakeServiceInstance {
        constructor(...args) {
            return stub(...args);
        }
    }

    const Factory = proxyquire('src/Factory', {
        './ServiceInstance': FakeServiceInstance
    });

    afterEach(() => {
        stub.reset();
    });

    it('return null on incorrect arguments of builder', function () {
        const instance = Factory.buildServiceInstance({}, {});
        assert.isNull(instance);
    });

    it('return null on throwing of error', function () {
        const node = deepFreeze({
            Node: {
                Node: 'transcoder_app',
                Address: '192.168.101.4',
                TaggedAddresses: {
                    lan: '192.168.101.4',
                    wan: '1.2.3.4'
                },
            },
            Service: {
                Tags: ['transcoder_app'],
                Port: 12345,
                ID: 'service_192.168.1.10_8080'
            }
        });

        const instanceStatus = new ServiceInstanceInfo({});

        stub.throws('TypeError');

        const instance = Factory.buildServiceInstance(node, instanceStatus);

        assert.isTrue(stub.calledOnce);
        assert.isNull(instance);
    });

    it('check of passed arguments from factory to inner class constructor', function () {
        const node = deepFreeze({
            Node: {
                Node: 'transcoder_app',
                Address: '192.168.101.4',
                Datacenter: 'dc1',
                TaggedAddresses: {
                    lan: '192.168.101.4',
                    wan: '1.2.3.4'
                },
            },
            Service: {
                Address: '172.0.10.10',
                Tags: ['transcoder_app'],
                Port: 12345,
                ID: 'service_192.168.1.10_8080'
            }
        });

        const instanceStatus = new ServiceInstanceInfo({});

        const expectedInstance = new ServiceInstance(
            node.Node.TaggedAddresses.lan,
            node.Node.TaggedAddresses.wan,
            node.Service.Address,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceStatus
        );

        stub.returns(expectedInstance);

        const instance = Factory.buildServiceInstance(node, instanceStatus);

        assert.isTrue(stub.calledOnce);
        assert.isTrue(stub.firstCall.calledWithExactly(
            node.Node.TaggedAddresses.lan,
            node.Node.TaggedAddresses.wan,
            node.Service.Address,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceStatus
        ));

        assert.instanceOf(instance, ServiceInstance);
        assert.strictEqual(instance, expectedInstance);
    });

    it('check of passed arguments from factory to inner class constructor, without TaggedAddresses.lan', function () {
        const node = deepFreeze({
            Node: {
                Node: 'transcoder_app',
                Address: '192.168.101.4',
                Datacenter: 'dc1',
                TaggedAddresses: {
                    wan: '1.2.3.4'
                },
            },
            Service: {
                Address: '172.0.10.10',
                Tags: ['transcoder_app'],
                Port: 12345,
                ID: 'service_192.168.1.10_8080'
            }
        });

        const instanceStatus = new ServiceInstanceInfo({});

        const expectedInstance = new ServiceInstance(
            null,
            node.Node.TaggedAddresses.wan,
            node.Service.Address,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceStatus
        );

        stub.returns(expectedInstance);

        const instance = Factory.buildServiceInstance(node, instanceStatus);

        assert.isTrue(stub.calledOnce);
        assert.isTrue(stub.firstCall.calledWithExactly(
            null,
            node.Node.TaggedAddresses.wan,
            node.Service.Address,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceStatus
        ));

        assert.instanceOf(instance, ServiceInstance);
        assert.strictEqual(instance, expectedInstance);
    });

    it('check of passed arguments from factory to inner class constructor, without TaggedAddresses.wan', function () {
        const node = deepFreeze({
            Node: {
                Node: 'transcoder_app',
                Address: '192.168.101.4',
                Datacenter: 'dc1',
                TaggedAddresses: {
                    lan: '192.168.101.4'
                },
            },
            Service: {
                Address: '172.0.10.10',
                Tags: ['transcoder_app'],
                Port: 12345,
                ID: 'service_192.168.1.10_8080'
            }
        });

        const instanceStatus = new ServiceInstanceInfo({});

        const expectedInstance = new ServiceInstance(
            node.Node.TaggedAddresses.lan,
            null,
            node.Service.Address,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceStatus
        );

        stub.returns(expectedInstance);

        const instance = Factory.buildServiceInstance(node, instanceStatus);

        assert.isTrue(stub.calledOnce);
        assert.isTrue(stub.firstCall.calledWithExactly(
            node.Node.TaggedAddresses.lan,
            null,
            node.Service.Address,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceStatus
        ));

        assert.instanceOf(instance, ServiceInstance);
        assert.strictEqual(instance, expectedInstance);
    });

    it('check of passed arguments from factory to inner class constructor, with TaggedAddresses === null', function () {
        const node = deepFreeze({
            Node: {
                Node: 'transcoder_app',
                Address: '192.168.101.4',
                Datacenter: 'dc1',
                TaggedAddresses: null,
            },
            Service: {
                Address: '172.0.10.10',
                Tags: ['transcoder_app'],
                Port: 12345,
                ID: 'service_192.168.1.10_8080'
            }
        });

        const instanceStatus = new ServiceInstanceInfo({});

        const expectedInstance = new ServiceInstance(
            null,
            null,
            node.Service.Address,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceStatus
        );

        stub.returns(expectedInstance);

        const instance = Factory.buildServiceInstance(node, instanceStatus);

        assert.isTrue(stub.calledOnce);
        assert.isTrue(stub.firstCall.calledWithExactly(
            null,
            null,
            node.Service.Address,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceStatus
        ));

        assert.instanceOf(instance, ServiceInstance);
        assert.strictEqual(instance, expectedInstance);
    });
});
