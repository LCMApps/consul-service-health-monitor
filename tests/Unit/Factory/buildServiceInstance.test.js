'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('chai').assert;
const deepFreeze = require('deep-freeze');
const ServiceInstance = require('src/ServiceInstance');
const ServiceInstanceStatus = require('src/ServiceInstanceStatus');


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
        const inputStatus = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

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
                Port: 12345
            }
        });

        const instanceStatus = new ServiceInstanceStatus(
            inputStatus.data.pid,
            inputStatus.data.status,
            inputStatus.data.mem.total,
            inputStatus.data.mem.free,
            inputStatus.data.cpu.usage,
            inputStatus.data.cpu.count
        );

        stub.throws('TypeError');

        const instance = Factory.buildServiceInstance(node, instanceStatus);

        assert.isTrue(stub.calledOnce);
        assert.isNull(instance);
    });

    it('check of passed arguments from factory to inner class constructor', function () {

        const inputStatus = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

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
                Port: 12345
            }
        });

        const instanceStatus = new ServiceInstanceStatus(
            inputStatus.data.pid,
            inputStatus.data.status,
            inputStatus.data.mem.total,
            inputStatus.data.mem.free,
            inputStatus.data.cpu.usage,
            inputStatus.data.cpu.count
        );

        const expectedInstance = new ServiceInstance(
            node.Node.TaggedAddresses.lan,
            node.Node.TaggedAddresses.wan,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Service.Tags,
            instanceStatus
        );

        stub.returns(expectedInstance);

        const instance = Factory.buildServiceInstance(node, instanceStatus);

        assert.isTrue(stub.calledOnce);
        assert.isTrue(stub.firstCall.calledWithExactly(
            node.Node.TaggedAddresses.lan,
            node.Node.TaggedAddresses.wan,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Service.Tags,
            instanceStatus
        ));

        assert.instanceOf(instance, ServiceInstance);
        assert.strictEqual(instance, expectedInstance);
    });
});
