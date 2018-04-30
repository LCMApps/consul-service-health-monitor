# Upgrade guide

## To 2.0.0

In this release we have implemented functionality of an auto-reconnect to Consul. Mechanism of access to HealthCheck data
was fully changed.

- Removed methods `addOnMaintenance`, `addOverloaded`, `getOverloaded` and `getOnMaintenance` from `ServiceInstances` class.
    Now available only 2 sets of instances:
     - Healthy instance is one with all checks in `passing` state (method `getHealthy`)
     - Unhealthy instance is one that has at least one check, except serfHealth check, not in `passing` state (method `getUnhealthy`)
- Added the third argument `extractors` to `ServiceInstancesMonitor::constructor`. 
This argument must be `undefined` or object where keys are names of extractors and values must be objects with required `extract` method.
```javascript
    const CPU_EXTRACTOR_NAME = 'cpu';
    const extractors = {
        CPU_EXTRACTOR_NAME: {
            extract() {
                //...
            }
        },
    };
```
If none extractors set then `ServiceInstance::getInfo` method returns `null` otherwise `ServiceInstanceInfo` will be returned.
- All information from HealthCheck output is available only via extractors. For receive extractor data use method 
`ServiceInstanceInfo::get` with extractor name as argument.
- Removed method `getStatus` from `ServiceInstance` and added `getInfo`
- Added new events `healthy` and `unhealthy`. Event `unhealthy` is emitted on a connectivity issues (like a request timeout to Consul
or an unsuccessful response). This event mean that module has a not consistent data with Consul. When information will be 
synchronized again than event `healthy` will be emitted.
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
```

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
```