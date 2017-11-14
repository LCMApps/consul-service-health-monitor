'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('chai').assert;
const dataDriven = require('data-driven');
const deepFreeze = require('deep-freeze');
const ServiceInstance = require('src/ServiceInstance');
const ServiceInstanceStatus = require('src/ServiceInstanceStatus');
const ServiceInstances = require('src/ServiceInstances');
const InvalidDataError = require('src/Error').InvalidDataError;


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
        builderStub.returns({ validNodes: [], errors: [] });

        const { instances, errors } = Factory.buildServiceInstances(nodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(nodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.isEmpty(instances.getOverloaded());
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
                Port: 12345
            },
            Checks: [],
        }]);

        builderStub.returns({ validNodes: inputNodes, errors: [] });
        const expectedErr = new InvalidDataError(
            'node received from consul has not registered health checks, node will be skipped',
            { address: inputNodes[0].Node.Address, nodeId: inputNodes[0].Node.Node }
        );

        const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.isEmpty(instances.getOverloaded());
        assert.lengthOf(errors, 1);
        assert.deepEqual(errors[0].toString(), expectedErr.toString());
    });


    const invalidOutput = [
        { info: 'empty output', value: '' },
        { info: 'not json', value: '[not json' },
        { info: 'invalid status data format', value: JSON.stringify({ status: 'OK', pid: 100 }) },
    ];
    dataDriven(invalidOutput, function () {
        it('skipped - node with {info} of instance-status check', function (arg) {
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
                    Port: 12345
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

            builderStub.returns({ validNodes: inputNodes, errors: [] });
            const expectedErr = new InvalidDataError(
                'Invalid format of output field of check received from consul, node will be skipped',
                { address: inputNodes[0].Node.Address, check: inputNodes[0].Checks[1] }
            );

            const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

            assert.isTrue(builderStub.calledOnce);
            assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
            assert.instanceOf(instances, ServiceInstances);
            assert.isArray(errors);
            assert.isEmpty(instances.getHealthy());
            assert.isEmpty(instances.getUnhealthy());
            assert.isEmpty(instances.getOverloaded());
            assert.lengthOf(errors, 1);
            assert.deepEqual(errors[0].toString(), expectedErr.toString());
        });
    });

    it('unhealthy - node with non-instance-status check in critical state', function () {
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
                Port: 12345
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'critical',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'passing',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 200 OK ' +
                        'Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expTranscoder = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputTranscoderStatus.data.pid,
                inputTranscoderStatus.data.status,
                inputTranscoderStatus.data.mem.total,
                inputTranscoderStatus.data.mem.free,
                inputTranscoderStatus.data.cpu.usage,
                inputTranscoderStatus.data.cpu.count
            )
        );
        builderStub.returns({ validNodes: inputNodes, errors: [] });

        const {instances, errors} = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.isEmpty(instances.getHealthy());
        assert.lengthOf(instances.getUnhealthy(), 1);
        /** @var {ServiceInstance} */
        const unhealthyTranscoder = instances.getUnhealthy()[0];
        assert.deepEqual(unhealthyTranscoder, expTranscoder);
        assert.isEmpty(instances.getOverloaded());
    });

    it('unhealthy - node with OK status field in instance-status check but with consul critical state', function () {
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
                Port: 12345
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
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputTranscoderStatus.data.pid,
                inputTranscoderStatus.data.status,
                inputTranscoderStatus.data.mem.total,
                inputTranscoderStatus.data.mem.free,
                inputTranscoderStatus.data.cpu.usage,
                inputTranscoderStatus.data.cpu.count
            )
        );

        const expectedErr = new InvalidDataError(
            'ServiceInstance status check is OK but status in consul is not passing, node will be skipped',
            { address: inputNodes[0].Node.Address, check: inputNodes[0].Checks[1] }
        );

        builderStub.returns({ validNodes: inputNodes, errors: [] });

        const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.lengthOf(errors, 1);
        assert.equal(errors[0].toString(), expectedErr.toString());
        assert.isEmpty(instances.getHealthy());
        assert.lengthOf(instances.getUnhealthy(), 1);
        /** @var {ServiceInstance} */
        const unhealthyTranscoder = instances.getUnhealthy()[0];
        assert.deepEqual(unhealthyTranscoder, expTranscoder);
        assert.isEmpty(instances.getOverloaded());
    });

    it('unhealthy - node with one check in critical state and critical instance-status check + ' +
        'OVERLOADED status', function () {
        const inputInstanceStatus = deepFreeze({
            data: {
                status: 'OVERLOADED',
                pid: 100,
                mem: { total: 13121352, free: 4256144 },
                cpu: { usage: 1.2295908130391557, count: 16}
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
                Port: 12345
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'maintenance',
                    Status: 'critical',
                    Name: 'Service Maintenance Mode',
                    Output: 'Any output',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'critical',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 503 ' +
                        'Service Unavailable Output: ' + JSON.stringify(inputInstanceStatus),
                }
            ],
        }]);

        const expInstances = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputInstanceStatus.data.pid,
                inputInstanceStatus.data.status,
                inputInstanceStatus.data.mem.total,
                inputInstanceStatus.data.mem.free,
                inputInstanceStatus.data.cpu.usage,
                inputInstanceStatus.data.cpu.count
            )
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
        /** @var {ServiceInstance} */
        const unhealthyInstances = instances.getUnhealthy()[0];
        assert.deepEqual(unhealthyInstances, expInstances);
        assert.isEmpty(instances.getOverloaded());
    });

    it('unhealthy - node with only instance check in critical state and MAINTENANCE status', function () {
        // MAINTENANCE status must be set up with 200 OK code only,
        // situation described in test is abnormal and instance muse be marked as unhealthy
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'MAINTENANCE',
                pid: 100,
                mem: { total: 13121352, free: 4256144 },
                cpu: { usage: 1.2295908130391557, count: 16}
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
                Port: 12345
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
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 503 Service ' +
                    'Unavailable Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expectedErr = new InvalidDataError(
            'ServiceInstance status check is MAINTENANCE but status in consul is not passing, node will be skipped',
            { address: inputNodes[0].Node.Address, check: inputNodes[0].Checks[1] }
        );

        const expTranscoder = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputTranscoderStatus.data.pid,
                inputTranscoderStatus.data.status,
                inputTranscoderStatus.data.mem.total,
                inputTranscoderStatus.data.mem.free,
                inputTranscoderStatus.data.cpu.usage,
                inputTranscoderStatus.data.cpu.count
            )
        );
        builderStub.returns({validNodes: inputNodes, errors: []});

        const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.lengthOf(errors, 1);
        assert.deepEqual(errors[0].toString(), expectedErr.toString());
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getOnMaintenance());
        assert.isEmpty(instances.getOverloaded());
        assert.lengthOf(instances.getUnhealthy(), 1);
        /** @var {ServiceInstance} */
        const unhealthyTranscoder = instances.getUnhealthy()[0];
        assert.deepEqual(unhealthyTranscoder, expTranscoder);
    });

    it('unhealthy - node with one check in critical state and passing instance-status check + ' +
        'MAINTENANCE status', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'MAINTENANCE',
                pid: 100,
                mem: { total: 13121352, free: 4256144 },
                cpu: { usage: 1.2295908130391557, count: 16}
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
                Port: 12345
            },
            Checks: [
                {
                    CheckID: 'serfHealth',
                    Status: 'passing',
                    Name: 'Serf Health Status',
                    Output: 'Agent alive and reachable',
                },
                {
                    CheckID: 'maintenance',
                    Status: 'critical',
                    Name: 'Service Maintenance Mode',
                    Output: 'Any output',
                },
                {
                    CheckID: 'service:transcoder',
                    Status: 'passing',
                    Name: checkNameWithStatus,
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 200 OK ' +
                    'Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expTranscoder = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputTranscoderStatus.data.pid,
                inputTranscoderStatus.data.status,
                inputTranscoderStatus.data.mem.total,
                inputTranscoderStatus.data.mem.free,
                inputTranscoderStatus.data.cpu.usage,
                inputTranscoderStatus.data.cpu.count
            )
        );
        builderStub.returns({validNodes: inputNodes, errors: []});

        const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getOnMaintenance());
        assert.isEmpty(instances.getOverloaded());
        assert.lengthOf(instances.getUnhealthy(), 1);
        /** @var {ServiceInstance} */
        const unhealthyTranscoder = instances.getUnhealthy()[0];
        assert.deepEqual(unhealthyTranscoder, expTranscoder);
    });

    it('overloaded - node with only instance check in critical state and OVERLOADED status', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'OVERLOADED',
                pid: 100,
                mem: { total: 13121352, free: 4256144 },
                cpu: { usage: 1.2295908130391557, count: 16}
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
                Port: 12345
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
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 503 Service ' +
                        'Unavailable Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expTranscoder = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputTranscoderStatus.data.pid,
                inputTranscoderStatus.data.status,
                inputTranscoderStatus.data.mem.total,
                inputTranscoderStatus.data.mem.free,
                inputTranscoderStatus.data.cpu.usage,
                inputTranscoderStatus.data.cpu.count
            )
        );
        builderStub.returns({validNodes: inputNodes, errors: []});

        const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.lengthOf(instances.getOverloaded(), 1);
        /** @var {ServiceInstances} */
        const overloadedTranscoder = instances.getOverloaded()[0];
        assert.deepEqual(overloadedTranscoder, expTranscoder);
    });

    it('overloaded - node with only instance check in passing state and OVERLOADED status', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'OVERLOADED',
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
                Port: 12345
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
                    Output: 'HTTP GET http://localhost:9090/videoStreamingService/v1/transcoder/status: 503 Service ' +
                        'Unavailable Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expTranscoder = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputTranscoderStatus.data.pid,
                inputTranscoderStatus.data.status,
                inputTranscoderStatus.data.mem.total,
                inputTranscoderStatus.data.mem.free,
                inputTranscoderStatus.data.cpu.usage,
                inputTranscoderStatus.data.cpu.count
            )
        );
        builderStub.returns({ validNodes: inputNodes, errors: [] });

        const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.lengthOf(instances.getOverloaded(), 1);
        /** @var {ServiceInstances} */
        const overloadedTranscoder = instances.getOverloaded()[0];
        assert.deepEqual(overloadedTranscoder, expTranscoder);
    });

    it('maintenance - node with only instance check in passing state and MAINTENANCE status', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'MAINTENANCE',
                pid: 100,
                mem: { total: 13121352, free: 4256144 },
                cpu: { usage: 1.2295908130391557, count: 16}
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
                Port: 12345
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
                        'Output: ' + JSON.stringify(inputTranscoderStatus),
                }
            ],
        }]);

        const expTranscoder = new ServiceInstance(
            inputNodes[0].Node.TaggedAddresses.lan,
            inputNodes[0].Node.TaggedAddresses.wan,
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputTranscoderStatus.data.pid,
                inputTranscoderStatus.data.status,
                inputTranscoderStatus.data.mem.total,
                inputTranscoderStatus.data.mem.free,
                inputTranscoderStatus.data.cpu.usage,
                inputTranscoderStatus.data.cpu.count
            )
        );
        builderStub.returns({validNodes: inputNodes, errors: []});

        const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

        assert.isTrue(builderStub.calledOnce);
        assert.isTrue(builderStub.firstCall.calledWithExactly(inputNodes));
        assert.instanceOf(instances, ServiceInstances);
        assert.isArray(errors);
        assert.isEmpty(errors);
        assert.isEmpty(instances.getHealthy());
        assert.isEmpty(instances.getUnhealthy());
        assert.isEmpty(instances.getOverloaded());
        assert.lengthOf(instances.getOnMaintenance(), 1);
        /** @var {ServiceInstance} */
        const onMaintenanceTranscoder = instances.getOnMaintenance()[0];
        assert.deepEqual(onMaintenanceTranscoder, expTranscoder);
    });

    it('healthy - node with all checks in passing state, not OVERLOADED', function () {
        const inputTranscoderStatus = deepFreeze({
            data: {
                status: 'OK',
                pid: 100,
                mem: { total: 13121352, free: 4256144 },
                cpu: { usage: 1.2295908130391557, count: 16}
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
                Port: 12345
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
            inputNodes[0].Service.Port,
            inputNodes[0].Node.Address,
            inputNodes[0].Node.Node,
            inputNodes[0].Service.Tags,
            new ServiceInstanceStatus(
                inputTranscoderStatus.data.pid,
                inputTranscoderStatus.data.status,
                inputTranscoderStatus.data.mem.total,
                inputTranscoderStatus.data.mem.free,
                inputTranscoderStatus.data.cpu.usage,
                inputTranscoderStatus.data.cpu.count
            )
        );

        builderStub.returns({ validNodes: inputNodes, errors: [] });

        const { instances, errors } = Factory.buildServiceInstances(inputNodes, checkNameWithStatus);

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
        assert.isEmpty(instances.getOverloaded());
    });
});
