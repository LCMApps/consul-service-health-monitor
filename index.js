'use strict';

const ServiceInstancesMonitor = require('./src/ServiceInstancesMonitor');
const ServiceInstance         = require('./src/ServiceInstance');
const ServiceInstances        = require('./src/ServiceInstances');
const ServiceInstanceStatus   = require('./src/ServiceInstanceStatus');

const Errors = require('./src/Error');

module.exports = {
    ServiceInstancesMonitor,
    ServiceInstance,
    ServiceInstances,
    ServiceInstanceStatus,
    Errors
};
