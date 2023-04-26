'use strict';

const os = require('os');
const express = require('express');
const SystemHealthMonitor = require('system-health-monitor');
const {Registrator: ServiceRegistrator} = require('consul-service-registrator');
const getAddressForChecks = require('./src/getAddressForChecks');

const systemHealthMonitorConfig = {
    checkIntervalMsec: 1000,
    mem: {
        thresholdType: 'fixed',
        minFree: 512
    },
    cpu: {
        calculationAlgo: 'sma',
        thresholdType: 'rate',
        periodPoints: 15,
        highWatermark: 0.8
    }
};

const systemHealthMonitor = new SystemHealthMonitor(systemHealthMonitorConfig);

const consulConfig = {
    host: process.env.CONSUL_HOST,
    port: parseInt(process.env.CONSUL_PORT)
};

const serviceName = process.env.CONSUL_SERVICE_NAME;
const statusCheckName = `${serviceName} health status`;

let isMaintenanceEnabled = false;

const app = express();
let appServer = null;
let serviceRegistrator = null;
const port = 3000;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/service/status', (req, res) => {
    let status = 'OK';

    try {
        if (systemHealthMonitor.isOverloaded()) {
            status = 'OVERLOADED';
        }

        if (isMaintenanceEnabled) {
            status = 'MAINTENANCE';
        }

        const data = {
            status: status,
            pid: process.pid,
            mem: {
                total: systemHealthMonitor.getMemTotal(),
                free: systemHealthMonitor.getMemFree()
            },
            cpu: {
                usage: systemHealthMonitor.getCpuUsage(),
                count: systemHealthMonitor.getCpuCount()
            }
        };

        const statusCode = status === 'OK' ? 200 : 503;

        return res.status(statusCode).json({data});
    } catch (err) {
        console.error('Error', err);
        res.status(500).json({error: {code: 1000, message: 'Unknown error'}});
    }
});

Promise.resolve().then(async () => {
    console.log('Network interfaces and addresses on the server');
    console.log(os.networkInterfaces());

    const addressForChecks = await getAddressForChecks(consulConfig, 'CONSUL_CHECK_HOST', 'CONSUL_CHECK_INTERFACE');

    await systemHealthMonitor.start();
    console.log('System health monitor has started.');

    appServer = await new Promise((resolve) => {
        const server = app.listen(port, () => {
            console.log(`Example service listening on port ${port}`);
            console.log('Health status is available via the path /service/status');
            return resolve(server);
        });
    });

    serviceRegistrator = await registerServiceInConsul(
        consulConfig, serviceName, addressForChecks, statusCheckName
    );
}).catch(err => {
    console.error('Service error', err);
    process.exit(1);
});

async function stopSignal() {
    console.log('Stop signal received');
    if (appServer !== null) {
        await appServer.close();
    }
    console.log('Example service has stopped');
    await systemHealthMonitor.stop();
    console.log('Example service has deregistered in consul');
    if (serviceRegistrator !== null) {
        await serviceRegistrator.deregister();
    }
}

process.on('SIGINT', stopSignal);
process.on('SIGTERM', stopSignal);


async function registerServiceInConsul(consulConfig, serviceName, addressForChecks, statusCheckName) {
    const serviceId = `${serviceName}_${port}`;
    const checkId = serviceId + '_status';
    const consulCheckInterval = '1s';
    const statusEndpoint = `http://${addressForChecks}:${port}/service/status`;

    const s = new ServiceRegistrator(consulConfig, serviceName, serviceId);

    s.setAddress(addressForChecks);
    s.setPort(port);
    s.setTags([`node-${serviceName}`, 'example']);
    await s.addHttpCheck(checkId, statusCheckName, statusEndpoint, consulCheckInterval);

    await s.register(true);
    console.log(`Service registered on consul. Address for checks: "${addressForChecks}"` +
        `, check name: "${statusCheckName}"`);

    return s;
}
