# Upgrade guide

## To 2.0.0

In this release we have implemented functionality of an auto-reconnect to Consul. 
`ServiceInstancesMonitor::getUpdateTime` was added as an additional feature, this method returns a timestamp of the 
last response from consul.

Migration guide:

The first argument of `ServiceInstancesMonitor::constructor` was expanded by an additional boolean parameter 
`autoReconnect`. If this parameter is not set explicitly or equal to `true` than the auto-reconnect will be enable.

If you want to use a custom logic of a processing Consul Watch stop (how it was in version 1.x.x) then you must set 
the listener on `emergencyStop` event and set `autoReconnect` parameter to `false`.

Example of `ServiceInstancesMonitor` with an auto-reconnect to Consul:

    const consul = require('consul');
    const ServiceInstancesMonitor = require('consul-service-health-monitor').ServiceInstancesMonitor;
    
    const options = {
        serviceName: 'my-service',
        timeoutMsec: 500,
        checkNameWithStatus: 'My-service health status',
        autoReconnect: true
    }
    const monitor = new ServiceInstancesMonitor(options, consulClient);
