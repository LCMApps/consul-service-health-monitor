'use strict';

const _ = require('lodash');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('chai').assert;
const dataDriven = require('data-driven');
const deepFreeze = require('deep-freeze');
const ServiceInstanceStatus = require('src/ServiceInstanceStatus');


describe('Factory::buildInstanceStatusFromOutput', function () {
    const ServiceInstanceStatusStub = sinon.stub();
    const Factory = proxyquire('src/Factory', {
        './ServiceInstanceStatus': ServiceInstanceStatusStub
    });

    beforeEach(function () {
        ServiceInstanceStatusStub.reset();
    });

    const validObj = deepFreeze({
        data: {
            pid: 1,
            status: ServiceInstanceStatus.STATE_OK,
            mem: {free: 4, total: 8},
            cpu: {usage: 2.4, count: 2},
        }
    });

    const testParams = {
        invalidOutput: [
            { info: 'invalid json - empty string', value: '' },
            { info: 'not an object', value: 'false' },
            { info: 'invalid json 1', value: '"' },
            { info: 'invalid json 2', value: 'sss' },
            { info: 'array', value: '[]' },
            { info: 'empty object', value: '{}' },
        ],
        badOutput: [
            { missed: 'data', value: _.omit(validObj, ['data']) },
            { missed: 'pid', value: _.omit(validObj, ['data.pid']) },
            { missed: 'status', value: _.omit(validObj, ['data.status']) },
            { missed: 'mem', value: _.omit(validObj, ['data.mem']) },
            { missed: 'cpu', value: _.omit(validObj, ['data.cpu']) },
            { missed: 'mem.free', value: _.set(_.cloneDeep(validObj), 'data.mem', { total: 1 }) },
            { missed: 'mem.total', value: _.set(_.cloneDeep(validObj), 'data.mem', { free: 1 }) },
            { missed: 'cpu.count', value: _.set(_.cloneDeep(validObj), 'data.cpu', { usage: 1 }) },
            { missed: 'cpu.usage', value: _.set(_.cloneDeep(validObj), 'data.cpu', { count: 1 }) },
        ],
    };

    dataDriven(testParams.invalidOutput, function () {
        it('output with invalid data - {info}', function (arg) {
            const outputStr = arg.value;
            const serviceInstance = Factory.buildInstanceStatusFromOutput(outputStr);

            assert.isNull(serviceInstance);
            assert.isFalse(ServiceInstanceStatusStub.called);
        });
    });

    dataDriven(testParams.badOutput, function () {
        it('output with missed properties - no {missed}', function (arg) {
            const outputStr = JSON.stringify(arg.value);
            const serviceInstance = Factory.buildInstanceStatusFromOutput(outputStr);

            assert.isNull(serviceInstance);
            assert.isFalse(ServiceInstanceStatusStub.called);
        });
    });

    it('instance of ServiceInstanceStatus was created and returned', function () {
        const returnedByStub = {};
        ServiceInstanceStatusStub.returns(returnedByStub);

        const serviceInstance = Factory.buildInstanceStatusFromOutput(validObj);

        assert.isTrue(ServiceInstanceStatusStub.calledOnce);
        assert.isTrue(ServiceInstanceStatusStub.calledWithNew());

        assert.isTrue(
            ServiceInstanceStatusStub.firstCall.calledWithExactly(
                validObj.data.pid, validObj.data.status, validObj.data.mem.total, validObj.data.mem.free,
                validObj.data.cpu.usage, validObj.data.cpu.count
            )
        );
        assert.strictEqual(serviceInstance, returnedByStub);
    });
});
