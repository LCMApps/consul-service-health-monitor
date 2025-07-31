'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('chai').assert;
const dataDriven = require('data-driven');
const deepFreeze = require('deep-freeze');
const ServiceInstance = require('src/ServiceInstance');
const ServiceInstances = require('src/ServiceInstances');
const InvalidDataError = require('src/Error').InvalidDataError;

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

describe('Factory::buildServiceInstances', function () {

    const checkNameWithStatus = "Service 'transcoder' health info";
    const builderStub = sinon.stub();
    const Factory = proxyquire('src/Factory', {
        './ConsulResponseValidator': {
            'filterValidHealthyServices': builderStub
        }
    });

    afterEach(function () {
        builderStub.reset();
    });

    it('tests consulHelper.filterValidHealthyServices was called', function () {
        const nodes = [];
        builderStub.returns({validNodes: [], errors: []});

        const {instances, errors} = Factory.buildServiceInstances(nodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(nodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.isEmpty(instances.getAll());
        assert.isEmpty(errors);
    });

    it('skipped - node with empty array as an Check prop', function () {
        const inputNodes = deepFreeze([{
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
            },
            Checks: [],
        }]);

        builderStub.returns({validNodes: inputNodes, errors: []});
        const expectedErr = new InvalidDataError(
            'node received from consul has not registered health checks, node will be skipped',
            {address: inputNodes[0].Node.Address, nodeName: inputNodes[0].Node.Node}
        );

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.isEmpty(instances.getAll());
        assert.lengthOf(errors, 1);
        assert.deepEqual(errors[0].toString(), expectedErr.toString());
    });


    it('skipped - instance-status check output is not exist', function () {
        const inputNodes = deepFreeze([{
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
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'passing',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 200 OK'
                }
            ],
        }]);

        builderStub.returns({validNodes: inputNodes, errors: []});
        const expectedErr = new InvalidDataError(
            'Invalid format of output field of check received from consul, node will be skipped',
            {address: inputNodes[0].Node.Address, check: inputNodes[0].Checks[1]}
        );

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.isEmpty(instances.getAll());
        assert.lengthOf(errors, 1);
        assert.deepEqual(errors[0].toString(), expectedErr.toString());
    });

    it('skipped - node without check that matches instance-status check name', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

        const inputNodes = deepFreeze([{
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
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'passing',
                    Name: 'Name that does not match checkNameWithStatus',
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 200 OK ' +
                    'Output: ' + JSON.stringify(inputTranscoderStatus)
                }
            ],
        }]);

        builderStub.returns({validNodes: inputNodes, errors: []});
        const expectedErr = new InvalidDataError(
            'Check with `checkNameWithStatus` was not found among all checks on the node, node will be skipped',
            {node: inputNodes[0]}
        );

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.isEmpty(instances.getAll());
        assert.lengthOf(errors, 1);
        assert.deepEqual(errors[0].toString(), expectedErr.toString());
    });

    it('skipped - node with serfHealth check in critical state', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

        const inputNodes = deepFreeze([{
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
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'critical',
                    Name: 'Serf Health Status',
                    Output: 'Agent not live or unreachable',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'passing',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 200 OK ' +
                    'Output: ' + JSON.stringify(inputTranscoderStatus)
                }
            ],
        }]);

        builderStub.returns({validNodes: inputNodes, errors: []});
        const expectedErr = new InvalidDataError(
            'serfHealth check is in critical state, node will be skipped',
            {node: inputNodes[0]}
        );

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.isEmpty(instances.getAll());
        assert.lengthOf(errors, 1);
        assert.deepEqual(errors[0].toString(), expectedErr.toString());
    });

    it('unhealthy - node with check not in passing state', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

        const inputNodes = deepFreeze([{
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
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'critical',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 200 OK ' +
                    'Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expTranscoder = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Address,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Node.Datacenter,
            inputNodes[0].Service.ID,
            inputNodes[0].Service.Tags,
            null
        );

        builderStub.returns({validNodes: inputNodes, errors: []});

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.isEmpty(instances.getHealthy());
        assert.lengthOf(instances.getUnhealthy(), 1);
        assert.lengthOf(instances.getAll(), 1);
        /** @var {ServiceInstance} */
        const unhealthyTranscoder = instances.getUnhealthy()[0];
        assert.deepEqual(unhealthyTranscoder, expTranscoder);
    });

    it('healthy - node with all checks in passing state', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

        const inputNodes = deepFreeze([{
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
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'passing',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: ' +
                    '200 OK Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expTranscoder = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Address,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Node.Datacenter,
            inputNodes[0].Service.ID,
            inputNodes[0].Service.Tags,
            null
        );

        builderStub.returns({validNodes: inputNodes, errors: []});

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.lengthOf(instances.getHealthy(), 1);
        /** @var {ServiceInstances} */
        const healthyTranscoder = instances.getHealthy()[0];
        assert.deepEqual(healthyTranscoder, expTranscoder);
        assert.isEmpty(instances.getUnhealthy());
        assert.lengthOf(instances.getAll(), 1);
    });

    it('healthy - node with serfHealth in passing state and TaggedAddresses === null', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

        const inputNodes = deepFreeze([{
            Node: {
                Node: 'transcoder_app',
                Address: '192.168.101.4',
                Datacenter: 'dc1',
                TaggedAddresses: null,
            },
            Service: {
                Tags: ['transcoder_app'],
                Address: '172.0.10.10',
                Port: 12345,
                ID: 'service_192.168.1.10_8080'
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'passing',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: ' +
                    '200 OK Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expTranscoder = new ServiceInstance(
            null,
            null,
            inputNodes[0].Service.Address,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Node.Datacenter,
            inputNodes[0].Service.ID,
            inputNodes[0].Service.Tags,
            null
        );
        builderStub.returns({validNodes: inputNodes, errors: []});

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.lengthOf(instances.getHealthy(), 1);
        assert.isEmpty(instances.getUnhealthy());
        assert.lengthOf(instances.getAll(), 1);
        /** @var {ServiceInstance} */
        const healthyTranscoder = instances.getHealthy()[0];
        assert.deepEqual(healthyTranscoder, expTranscoder);
    });

    it('different instances of the same service on the same node with different ports, both healthy', function () {
        const inputService1Status = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

        const inputService2Status = deepFreeze({
            data: {
                status: 'OK',
                pid: 101,
                mem: {total: 13121352, free: 4256144},
                cpu: {usage: 1.2295908130391557, count: 16}
            }
        });

        const inputNodes = deepFreeze([{
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
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'transcoder_192.168.1.10_8080_status',
                    Status: 'passing',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:8080/videoStreamingService/v1/transcoder/status: ' +
                    '200 OK Output: ' + JSON.stringify(inputService1Status),
                }
            ],
        }, {
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
                ID: 'service_192.168.1.10_8081'
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'transcoder_192.168.1.10_8081_status',
                    Status: 'passing',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:8081/videoStreamingService/v1/transcoder/status: ' +
                    '200 OK Output: ' + JSON.stringify(inputService2Status),
                }
            ],
        }]);

        const expTranscoder1 = new ServiceInstance(
            null,
            null,
            inputNodes[0].Service.Address,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Node.Datacenter,
            inputNodes[0].Service.ID,
            inputNodes[0].Service.Tags,
            null
        );
        const expTranscoder2 = new ServiceInstance(
            null,
            null,
            inputNodes[1].Service.Address,
            inputNodes[1].Service.Port,
            inputNodes[1].Node.Address,
            inputNodes[1].Node.Node,
            inputNodes[1].Node.Datacenter,
            inputNodes[1].Service.ID,
            inputNodes[1].Service.Tags,
            null
        );
        builderStub.returns({validNodes: inputNodes, errors: []});

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.lengthOf(instances.getHealthy(), 2);
        assert.isEmpty(instances.getUnhealthy());
        assert.lengthOf(instances.getAll(), 2);
        /** @var {ServiceInstance} */
        const healthyTranscoder1 = instances.getHealthy()[0];
        assert.deepEqual(healthyTranscoder1, expTranscoder1);
        const healthyTranscoder2 = instances.getHealthy()[1];
        assert.deepEqual(healthyTranscoder2, expTranscoder2);
    });

    const invalidOutput = [
        {info: 'empty output', value: ''},
        {info: 'not json', value: '[not json'},
        {info: 'invalid data format', value: JSON.stringify({status: 'OK', pid: 100})},
    ];
    dataDriven(invalidOutput, function () {
        it('success build when extractors = undefined and {info} of instance-status check', function (arg) {
            const inputNodes = deepFreeze([{
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
                    Tags: ['transcoder_app'],
                    Port: 12345,
                    ID: 'service_192.168.1.10_8080'
                },
                Checks: [
                    {
                        CheckID: 'serfHealth',
                        Status: 'passing',
                        Name: 'Serf Health Status',
                        Output: 'Agent alive and reachable',
                    },
                    {
                        CheckID: 'service:transcoder',
                        Status: 'passing',
                        Name: checkNameWithStatus,
                        Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 200 OK ' +
                        'Output: ' + arg.value
                    }
                ],
            }]);

            builderStub.returns({validNodes: inputNodes, errors: []});

            const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus, undefined);

            assert.isTrue(builderStub.calledOnce);
            assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
            assert.instanceOf(instances, ServiceInstances);
            assert.isArray(errors);
            assert.lengthOf(instances.getHealthy(), 1);
            assert.isEmpty(instances.getUnhealthy());
            assert.lengthOf(instances.getAll(), 1);
            assert.lengthOf(errors, 0);
        });
    });

    dataDriven(invalidOutput, function () {
        it('success build with undefined instanceInfo when {info} of instance-status check', function (arg) {
            const inputNodes = deepFreeze([{
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
                    Tags: ['transcoder_app'],
                    Port: 12345,
                    ID: 'service_192.168.1.10_8080'
                },
                Checks: [
                    {
                        CheckID: 'serfHealth',
                        Status: 'passing',
                        Name: 'Serf Health Status',
                        Output: 'Agent alive and reachable',
                    },
                    {
                        CheckID: 'service:transcoder',
                        Status: 'passing',
                        Name: checkNameWithStatus,
                        Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 200 OK ' +
                        'Output: ' + arg.value
                    }
                ],
            }]);

            builderStub.returns({validNodes: inputNodes, errors: []});

            const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus, extractors);

            assert.isTrue(builderStub.calledOnce);
            assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
            assert.instanceOf(instances, ServiceInstances);
            assert.isArray(errors);
            assert.lengthOf(instances.getHealthy(), 1);
            assert.isEmpty(instances.getUnhealthy());
            assert.lengthOf(instances.getAll(), 1);
            assert.lengthOf(errors, 1);
            assert.instanceOf(errors[0], InvalidDataError);
        });
    });
});
