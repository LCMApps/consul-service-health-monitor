'use strict';

const assert = require('chai').assert;
const dataDriven = require('data-driven');
const deepFreeze = require('deep-freeze');
const ServiceInstance = require('src/ServiceInstance');
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
    // all types except an object
    notAnObject: [
        vt('8080'), vt(123), vt(true), vt(undefined), vt(Symbol()), vt(setTimeout), vt(null)
    ],
};

describe('ServiceInstance::constructor', function () {

    let serviceInstanceStatus;

    beforeEach(() => {
        const pid = 87;
        const statusOk = ServiceInstanceStatus.STATE_OK;
        const memTotal = 2047;
        const memFree = 1337;
        const cpuUsage = 34.91;
        const cpuCount = 16;
        serviceInstanceStatus = deepFreeze(
            new ServiceInstanceStatus(pid, statusOk, memTotal, memFree, cpuUsage, cpuCount)
        );
    });

    dataDriven(testParams.notAnEmptyStringAndNull, function () {
        it('incorrect type of lanIp, type = {type}', function (arg) {
            const lanIp = arg.value;
            const wanIp = '8.8.8.8';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const serviceId = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceId, serviceTags, serviceInstanceStatus
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
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.isNull(serviceInstance.getLanIp());
    });

    it('no errors on lanIp with non empty string', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.strictEqual(serviceInstance.getLanIp(), lanIp);
    });

    dataDriven(testParams.notAnEmptyStringAndNull, function () {
        it('incorrect type of wanIp, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = arg.value;
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const serviceID = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
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
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.isNull(serviceInstance.getWanIp());
    });

    it('no errors on wanIp with non empty string', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.strictEqual(serviceInstance.getWanIp(), wanIp);
    });

    dataDriven(testParams.notANumber, function () {
        it('incorrect type of port, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const port = arg.value;
            const nodeAddress = '192.168.1.10';
            const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const serviceID = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
                    );
                },
                TypeError,
                'port must be a number'
            );
        });
    });

    it('no errors on port with number value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.equal(serviceInstance.getPort(), port);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of nodeAddress, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const port = 8080;
            const nodeAddress = arg.value;
            const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const serviceID = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
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
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.equal(serviceInstance.getNodeAddress(), nodeAddress);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of nodeId, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeId = arg.value;
            const serviceID = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
                    );
                },
                TypeError,
                'nodeId must be a string'
            );
        });
    });

    it('no errors on nodeId with string value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.equal(serviceInstance.getNodeId(), nodeId);
    });
    dataDriven(testParams.notAString, function () {
        it('incorrect type of nodeId, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeId = arg.value;
            const serviceID = 'service_192.168.1.10_8080';
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
                    );
                },
                TypeError,
                'nodeId must be a string'
            );
        });
    });

    it('no errors on nodeId with string value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.equal(serviceInstance.getNodeId(), nodeId);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of serviceID, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const serviceID = arg.value;
            const serviceTags = [];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
                    );
                },
                TypeError,
                'serviceID must be a string'
            );
        });
    });

    it('no errors on serviceID with string value', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.equal(serviceInstance.getServiceID(), serviceID);
    });

    dataDriven(testParams.notAString, function () {
        it('incorrect type of serviceTags, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const serviceID = 'service_192.168.1.10_8080';
            const serviceTags = arg.value;

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
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
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const serviceID = 'service_192.168.1.10_8080';
            const serviceTags = [arg.value];

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
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
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = deepFreeze([]);

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.equal(serviceInstance.getServiceTags(), serviceTags);
    });

    dataDriven(testParams.notAnObject, function () {
        it('incorrect type of serviceInstanceStatus elements, type = {type}', function (arg) {
            const lanIp = '192.168.1.1';
            const wanIp = '8.8.8.8';
            const port = 8080;
            const nodeAddress = '192.168.1.10';
            const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
            const serviceID = 'service_192.168.1.10_8080';
            const serviceTags = [];
            const serviceInstanceStatus = arg.value;

            assert.throws(
                function () {
                    new ServiceInstance(
                        lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
                    );
                },
                TypeError,
                'serviceInstanceStatus must be an instance of ServiceInstanceStatus'
            );
        });
    });

    it('no errors on serviceTags with array of strings', function () {
        const lanIp = '192.168.1.1';
        const wanIp = '8.8.8.8';
        const port = 8080;
        const nodeAddress = '192.168.1.10';
        const nodeId = '9187535f-d190-4f62-8625-3f3f0ce66f02';
        const serviceID = 'service_192.168.1.10_8080';
        const serviceTags = [];

        const serviceInstance = new ServiceInstance(
            lanIp, wanIp, port, nodeAddress, nodeId, serviceID, serviceTags, serviceInstanceStatus
        );

        assert.deepEqual(serviceInstance.getStatus(), serviceInstanceStatus);
    });
});
