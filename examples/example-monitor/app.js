'use strict';

const util = require('util');
const Consul = require('consul');

// replace it with the package if you use it outside the repo
//const {ServiceInstancesMonitor} = require('../../index');
const {ServiceInstancesMonitor} = require('consul-service-health-monitor');

const CpuInfoExtractor = require('./src/extractors/CpuInfoExtractor');
const StatusInfoExtractor = require('./src/extractors/StatusInfoExtractor');

const consulConfig = {
    host: process.env.CONSUL_HOST,
    port: parseInt(process.env.CONSUL_PORT)
};

const consulClient = new Consul(consulConfig);

const serviceName = process.env.CONSUL_SERVICE_NAME_TO_MONITOR;
const checkNameWithStatus = process.env.CONSUL_SERVICE_CHECK_NAME_WITH_STATUS;

const monitorConfig = {
    serviceName,
    checkNameWithStatus
};

const extractors = {
    cpu: new CpuInfoExtractor(),
    status: new StatusInfoExtractor(),
};

const monitor = new ServiceInstancesMonitor(monitorConfig, consulClient, extractors);

function logInstance(instance) {
    console.log('  ServiceId: ', instance.getServiceId());
    console.log('  Node name: ', instance.getNodeName());
    console.log('  Node address: ', instance.getNodeAddress());
    console.log('  LanIP: ', instance.getLanIp());
    console.log('  WanIP: ', instance.getWanIp());
    console.log('  Service Address: ', instance.getServiceAddress());
    console.log('  Service Port: ', instance.getPort());
    console.log('  Service tags: ', instance.getServiceTags());

    if (instance.getInfo() === null) {
        console.log('  Info: ', instance.getInfo());
    } else {
        Object.keys(extractors).forEach(extractorName => {
            console.log('  Info. ' + extractorName + ': ', instance.getInfo().get(extractorName));
        });
    }
}

function logInstances(instances) {
    const healthy = instances.getHealthy();
    const unhealthy = instances.getUnhealthy();
    const all = instances.getAll();

    console.log('Healthy amount:', healthy.length);
    if (healthy.length > 0) {
        healthy.forEach(instance => {
            logInstance(instance);
        });
    }

    console.log('Unhealthy amount:', unhealthy.length);
    if (unhealthy.length > 0) {
        unhealthy.forEach(instance => {
            logInstance(instance);
        });
    }

    console.log('All amount:', all.length);
    if (all.length > 0) {
        all.forEach(instance => {
            logInstance(instance);
        });
    }
}


Promise.resolve().then(async () => {
    console.log(`Starting monitor for the service "${serviceName}"`);

    monitor.on('error', error => {
        console.log(`ServiceInstanceMonitor error: ${error.message}`, util.inspect(error, true, 5));
    });

    monitor.on('healthy', () => {
        console.log('Service monitor become healthy');
    });

    monitor.on('unhealthy', () => {
        console.log('Service monitor become unhealthy. Data may be outdated, you can not rely on ' +
            'monitor till it becomes healthy again');
    });

    monitor.on('changed', instances => {
        console.log('Changed event happened');
        logInstances(instances);
    });

    const initialNodes = await monitor.startService();
    console.log('Monitor started');

    logInstances(initialNodes);

    setInterval(() => {
        logInstances(monitor.getInstances());
    }, 5000);

}).catch(err => {
    console.error('Service error', err);
    process.exit(1);
});


async function stop() {
    console.log('Stop signal received');
    await monitor.stopService();
    process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

