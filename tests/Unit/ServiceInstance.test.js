'use strict';

const assert = require('chai').assert;
const dataDriven = require('data-driven');
const deepFreeze = require('deep-freeze');
const ServiceInstance = require('src/ServiceInstance');
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
    return { value, type: (value === null ? 'null' : typeof value) };
}

const testParams = {
    // all type except number
    notANumber: [
        vt('8080'), vt(true), vt(undefined), vt(Symbol()), vt({ }), vt(setTimeout), vt(null)
    ],
    // all types except string
    notAString: [
        vt(true), vt(123), vt(undefined), vt(Symbol()), vt({ }), vt(setTimeout), vt(null)
    ],
    // all types except string and null
    notAnEmptyStringAndNull: [
        vt(true), vt(123), vt(undefined), vt(Symbol()), vt({ }), vt(setTimeout), vt('')
    ],
    // all types except array
    notAnArray: [
        vt('8080'), vt(123), vt(true), vt(undefined), vt(Symbol()), vt({ }), vt(setTimeout), vt(null)
    ],
    // all types except an object and null
    notAnObjectExceptNull: [
        vt('8080'), vt(123), vt(true), vt(undefined), vt(Symbol()), vt(setTimeout)
    ],
};

describe('ServiceInstance::constructor', function () {

    let serviceInstanceInfo;

    beforeEach(() => {
        serviceInstanceInfo = deepFreeze(
            new ServiceInstanceInfo({})
        );
    });

    dataDriven(testParams.notAnEmptyStringAndNull, function () {
        it('incorrect type of lanIp, type = {type}', function (arg) {
            const lanIp = arg.value;
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'lanIp must be a non-empty string or null'
            );
        });
    });

    it('no errors on lanIp with null value', function () {
        const lanIp = null;
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.isNull(serviceInstance.getLanIp());
    });

    it('no errors on lanIp with non empty string', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.strictEqual(serviceInstance.getLanIp(), lanIp);
    });

    it('no errors on serviceAddress with null value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = null;
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.isNull(serviceInstance.getServiceAddress());
    });

    it('error on serviceAddress with empty string', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        assert.throws(
            function () {
                new ServiceInstance(
                    lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                    serviceInstanceInfo
                );
            },
            TypeError,
            'serviceAddress must be a non-empty string or null'
        );
    });

    it('no errors on serviceAddress with non empty string', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.strictEqual(serviceInstance.getLanIp(), lanIp);
    });

    dataDriven(testParams.notAnEmptyStringAndNull, function () {
        it('incorrect type of wanIp, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = arg.value;
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'wanIp must be a non-empty string or null'
            );
        });
    });

    it('no errors on wanIp with null value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = null;
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.isNull(serviceInstance.getWanIp());
    });

    it('no errors on wanIp with non empty string', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.strictEqual(serviceInstance.getWanIp(), wanIp);
    });

    dataDriven(testParams.notANumber, function () {
        it('incorrect type of port, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = arg.value;
            const nodeAddress = '192.168.1.10';
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'servicePort must be a number'
            );
        });
    });

    it('no errors on port with number value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.equal(serviceInstance.getPort(), port);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of nodeAddress, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = arg.value;
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'nodeAddress must be a string'
            );
        });
    });

    it('no errors on nodeAddress with string value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.equal(serviceInstance.getNodeAddress(), nodeAddress);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of nodeName, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = arg.value;
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'nodeName must be a string'
            );
        });
    });

    it('no errors on nodeName with string value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.equal(serviceInstance.getNodeName(), nodeName);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of nodeName, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = arg.value;
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'nodeName must be a string'
            );
        });
    });

    it('no errors on nodeName with string value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.equal(serviceInstance.getNodeName(), nodeName);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of nodeDc, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = arg.value;
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'nodeDc must be a string'
            );
        });
    });

    it('no errors on nodeDc with string value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.equal(serviceInstance.getNodeName(), nodeName);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of serviceId, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = 'dc1';
            const serviceId = arg.value;
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'serviceId must be a string'
            );
        });
    });

    it('no errors on serviceId with string value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.equal(serviceInstance.getServiceId(), serviceId);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of serviceTags, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = arg.value;

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'serviceTags must be an array'
            );
        });
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of serviceTags elements, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [arg.value];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'serviceTag item must be a string'
            );
        });
    });

    it('no errors on serviceTags with array of strings', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = deepFreeze([]);

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.equal(serviceInstance.getServiceTags(), serviceTags);
    });

    dataDriven(testParams.notAnObjectExceptNull, function () {
        it('incorrect type of serviceInstanceInfo elements, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const serviceAddress = '172.0.10.10';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const nodeDc = 'dc1';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];
            const serviceInstanceInfo = arg.value;

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
                        serviceInstanceInfo
                    );
                },
                TypeError,
                'serviceInstanceInfo must be an instance of ServiceInstanceInfo'
            );
        });
    });

    it('"getInfo" method returns valid value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags,
            serviceInstanceInfo
        );

        assert.deepEqual(serviceInstance.getInfo(), serviceInstanceInfo);
    });

    it('no errors on serviceInstanceInfo with null value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const serviceAddress = '172.0.10.10';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeName = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const nodeDc = 'dc1';
        const serviceId = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, serviceAddress, port, nodeAddress, nodeName, nodeDc, serviceId, serviceTags, null
        );

        assert.deepEqual(serviceInstance.getInfo(), null);
    });
});
