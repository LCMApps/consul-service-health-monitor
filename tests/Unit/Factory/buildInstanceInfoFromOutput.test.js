'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('chai').assert;
const ServiceInstanceInfo = require('src/ServiceInstanceInfo');

describe('Factory::buildInstanceInfoFromOutput', function () {
    const ServiceInstanceInfoStub = sinon.stub();
    const Factory = proxyquire('src/Factory', {
        './ServiceInstanceInfo': ServiceInstanceInfoStub
    });

    beforeEach(function () {
        ServiceInstanceInfoStub.reset();
        ServiceInstanceInfoStub.callsFake((arg) => new ServiceInstanceInfo(arg));
    });

    const extractorName = 'mem';
    const extractors = {
        [extractorName]: {
            extract(data) {
                if (
                    !data || !data.data || !data.data.mem || !Number.isFinite(data.data.mem.total)
                    || !Number.isFinite(data.data.mem.free)
                ) {
                    throw new Error('Some msg');
                }

                return {
                    total: data.data.mem.total,
                    free: data.data.mem.free
                };
            }
        }
    };
    const validDataForExtractor = {
        data: {
            mem: {free: 4, total: 8}
        }
    };
    const invalidDataForExtractor = JSON.stringify({
        mem: {free: 4, total: 8}
    });
    const invalidOutputForParse = JSON.stringify({mem: {free: 4, total: 8}}).substr(0, 2);
    const validOutput = JSON.stringify(validDataForExtractor);

    it('success build ServiceInstanceInfo instance', function () {
        const expectedDto = {
            [extractorName]: extractors[extractorName].extract(validDataForExtractor)
        };

        const result = Factory.buildInstanceInfoFromOutput(validOutput, extractors);

        assert.isTrue(ServiceInstanceInfoStub.calledOnce);
        assert.isTrue(ServiceInstanceInfoStub.calledWithExactly(expectedDto));
        assert.instanceOf(result, ServiceInstanceInfo);
    });

    it('throws error on output with invalid data for JSON::parse', function () {
        assert.throws(
            function () {
                Factory.buildInstanceInfoFromOutput(invalidOutputForParse, extractors);
            },
            SyntaxError
        );
    });

    it('throws error on error from one of an extractors', function () {
        assert.throws(
            function () {
                Factory.buildInstanceInfoFromOutput(invalidDataForExtractor, extractors);
            },
            Error
        );
    });
});
