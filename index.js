'use strict';

const ServiceInstancesMonitor = require('./src/ServiceInstancesMonitor');
const ServiceInstance         = require('./src/ServiceInstance');
const ServiceInstances        = require('./src/ServiceInstances');
const ServiceInstanceInfo   = require('./src/ServiceInstanceInfo');

const Errors = require('./src/Error');

module.exports = {
    ServiceInstancesMonitor,
    ServiceInstance,
    ServiceInstances,
    ServiceInstanceInfo,
    Errors
};
