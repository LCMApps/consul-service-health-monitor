# Upgrade guide

## To 2.0.0

In this release we have implemented functionality of an auto-reconnect to Consul. Mechanism of access to HealthCheck data
was fully changed.

- Removed methods `addOnMaintenance`, `addOverloaded`, `getOverloaded` and `getOnMaintenance` from `ServiceInstances` class.
    Now available only 2 sets of instances:
     - Healthy instance is one with all checks in `passing` state (method `getHealthy`)
     - Unhealthy instance is one that has at least one check, except serfHealth check, not in `passing` state (method `getUnhealthy`)
- Added the third argument `extractors` to `ServiceInstancesMonitor::constructor`. 
This argument must be `undefined` or object that consists of objects with required `extract` method.
If none extractors setted then `ServiceInstance::getInfo` method returns `null`.
- All information from HealthCheck output is available only via extractors.
- Removed method `getStatus` from `ServiceInstance` and added `getInfo`
- Added `ServiceInstancesMonitor::getUpdateTime` as an additional feature, this method returns a timestamp of the 
last response from Consul.
- Added events `healthy` on a successful reconnect to Consul and `unhealthy` on watching "end" after a successful service start.
- Error `WatchTimeoutError` and event `emergencyStop` from `ServiceInstancesMonitor` is not supported already.

### Example :

```javascript
    const consul = require('consul');
    const ServiceInstancesMonitor = require('consul-service-health-monitor').ServiceInstancesMonitor;
    const CpuInfoExtractor = require('./CpuInfoExtractor');
    
    const options = {
        serviceName: 'my-service',
        timeoutMsec: 500,
        checkNameWithStatus: 'My-service health status'
    };
    
    const CPU_EXTRACTOR_NAME = 'cpu';
    const extractors = {
        CPU_EXTRACTOR_NAME: new CpuInfoExtractor(),
    };
   
    const monitor = new ServiceInstancesMonitor(options, consulClient, extractors);
    
    monitor.on('error', err => {
        console.error(err);
        // ...
    });
    
    monitor.on('changed', instances => {
        // ...
    });
    
    monitor.on('healthy', () => {
        // ...
    }); 
    
    monitor.on('unhealthy', () => {
        // ...
    });
    
    monitor.startService()
        .then(instances => {
            const healthyInstances = instances.getHealthy();
            // OR const healthyInstances = monitor.getInstances().getHealthy();
            
            const instanceInfo = healthyInstances[0].getInfo(); // instanceInfo is instance of ServiceInstanceInfo
            const cpuData = instanceInfo.get(CPU_EXTRACTOR_NAME);
            const cpuUsage = cpuData.getCpuUsage();
            
            console.log(`CPU usage of ${healthyInstances[0].getNodeName()}: ${cpuUsage}`);
        })
        .catch(err => {
            // ...
        });
```

```javascript
    class CpuInfo {
        constructor(cpuUsage, cpuCount) {
            this._cpuUsage = cpuUsage;
            this._cpuCount = cpuCount;
        }

        getCpuCount() {
            return this._cpuCount;
        }

        getCpuUsage() {
            return this._cpuUsage;
        }
    }
````

```javascript
    const CpuInfo = require('./CpuInfo');

    class CpuInfoExtractor {
        constructor(isMandatory = true) {
            this._isMandatory = isMandatory;
        }

        extract(outputObject) {
            if (outputObject.data === undefined) {
                if (this._isMandatory) {
                    throw new TypeError('"data" field was not found in output');
                } else {
                    return undefined;
                }
            }
    
            if (typeof outputObject.data !== 'object') {
                throw new TypeError('"data" field must be an object');
            }
    
            if (outputObject.data.cpu === undefined) {
                if (this._isMandatory) {
                    throw new TypeError('"data.cpu" field was not found in output');
                } else {
                    return undefined;
                }
            }
    
            const cpuObject = outputObject.data.cpu;
    
            if (typeof cpuObject !== 'object') {
                throw new TypeError('"data.cpu" field in output is not an object');
            }
    
            if (!Number.isInteger(cpuObject.cpuCount)) {
                throw new TypeError('"data.cpu.cpuCount" field must be an integer');
            }
    
            if (!(typeof cpuObject.cpuUsage === 'number') || cpuObject.cpuUsage < 0 || cpuObject.cpuUsage > 100) {
                throw new TypeError('"data.cpu.cpuUsage" field must be a number between [0, 100]');
            }
    
            return new CpuInfo(cpuObject.cpuUsage, cpuObject.cpuCount);
        }
    }
````