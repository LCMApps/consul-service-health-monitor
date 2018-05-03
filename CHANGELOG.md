## Changelog

### 2.0.0

UPDATES:

- [#20553](https://redmine.hwtool.net/issues/20553) Add forwarding headers X-Consul-*
- [#20559](https://redmine.hwtool.net/issues/20559) Add method "getAll()" to ServiceInstances class
- [#20521](https://redmine.hwtool.net/issues/20521) Fix bug with default timeout for Consul Watch
- [#20123](https://redmine.hwtool.net/issues/20123) Add to "consul-service-health-monitor" module functionality of an auto-reconnect to Сonsul
- [#19681](https://redmine.hwtool.net/issues/19681) Extending consul-service-health-monitor to extract custom data from output
- support auto-reconnect to Consul 
- removed `emergencyStop` event from `ServiceInstancesMonitor`
- removed `ServiceInstanceStatus` class and added `ServiceInstanceInfo`
- removed methods `addOnMaintenance`, `addOverloaded`, `getOverloaded` and `getOnMaintenance` from `ServiceInstances` class.
- removed method `getStatus` from `ServiceInstance` and added `getInfo`
- added `extractors` argument to `ServiceInstancesMonitor::constructor`
- added `healthy` and `unhealthy` events to `ServiceInstancesMonitor`

### 1.4.0

- [#20405](https://redmine.hwtool.net/issues/20405) Implement fallback to healthy state after watch error.

### 1.3.0

- [#19653](https://redmine.hwtool.net/issues/19653) `ServiceInstance::getNodeId()` method was refactored to
`ServiceInstance::getNodeName()`
- removing asyncawait and support of node6

### 1.2.0

- [#19311](https://redmine.hwtool.net/issues/19311) Розширення функціональності модуля "consul-service-health-monitor"

### 1.1.0

BUG FIXES:

- [#19119](https://redmine.hwtool.net/issues/19119) Fix nonuniqueness keys in map for service instances
- Added new method ServiceInstance#getServiceId that returns Service.ID parameter of check

### 1.0.3

BUG FIXES:
* `ServiceInstancesMonitor` doesn't throw error anymore when Node.TaggedAddresses === null. This situation may appear
if agent on node or whole node fails or there is no connection to consul master. `ServiceInstancesMonitor` will skip
service on such node at all. You may find the real output from consul in such situation below.

```json
[
    {
        "Checks": [
            {
                "CheckID": "serfHealth",
                "CreateIndex": 3267953,
                "ModifyIndex": 5121052,
                "Name": "Serf Health Status",
                "Node": "pimp_app",
                "Notes": "",
                "Output": "Agent not live or unreachable",
                "ServiceID": "",
                "ServiceName": "",
                "Status": "critical"
            },
            {
                "CheckID": "pimp_192.168.101.12_8080.pimp_192.168.101.12_8080_status",
                "CreateIndex": 3267965,
                "ModifyIndex": 5121014,
                "Name": "Pimp health status",
                "Node": "pimp_app",
                "Notes": "",
                "Output": "HTTP GET http://192.168.101.12:8080/pimp/v1.0/service/status: 200 OK Output: {\"data\":{\"status\":\"OK\",\"pid\":113,\"mem\":{\"total\":12813,\"free\":7595},\"cpu\":{\"usage\":1.46,\"count\":16}}}",
                "ServiceID": "pimp_192.168.101.12_8080",
                "ServiceName": "pimp",
                "Status": "passing"
            }
        ],
        "Node": {
            "Address": "192.168.101.12",
            "CreateIndex": 3267953,
            "ID": "",
            "Meta": null,
            "ModifyIndex": 5121052,
            "Node": "pimp_app",
            "TaggedAddresses": null
        },
        "Service": {
            "Address": "192.168.101.12",
            "CreateIndex": 3267964,
            "EnableTagOverride": false,
            "ID": "pimp_192.168.101.12_8080",
            "ModifyIndex": 3267964,
            "Port": 8080,
            "Service": "pimp",
            "Tags": [
                "node-pimp"
            ]
        }
    }
]
```

### 1.0.2

BUG FIXES:
* `ServiceInstancesMonitor` assumed that service in maintenance mode must return 200 OK to
consul check and status must be `passing`. This logic was incorrect because services return
`503 Service Unavailable` while they are on maintenance. You may find example of consul data
while service is on maintenance. 

```json
[
    {
        "Checks": [
            {
                "CheckID": "serfHealth",
                "CreateIndex": 6718632,
                "ModifyIndex": 6718632,
                "Name": "Serf Health Status",
                "Node": "pimp_app",
                "Notes": "",
                "Output": "Agent alive and reachable",
                "ServiceID": "",
                "ServiceName": "",
                "Status": "passing"
            },
            {
                "CheckID": "pimp_192.168.101.12_8080.pimp_192.168.101.12_8080_status",
                "CreateIndex": 6718644,
                "ModifyIndex": 6722134,
                "Name": "Pimp health status",
                "Node": "pimp_app",
                "Notes": "",
                "Output": "HTTP GET http://192.168.101.12:8080/pimp/v1.0/service/status: 503 Service Unavailable Output: {\"data\":{\"status\":\"MAINTENANCE\",\"pid\":111,\"mem\":{\"total\":12813,\"free\":7504},\"cpu\":{\"usage\":1.26,\"count\":16}}}",
                "ServiceID": "pimp_192.168.101.12_8080",
                "ServiceName": "pimp",
                "Status": "critical"
            }
        ],
        "Node": {
            "Address": "192.168.101.12",
            "CreateIndex": 6718632,
            "ID": "9187535f-d190-4f62-8625-3f3f0ce66f02",
            "Meta": {},
            "ModifyIndex": 6718636,
            "Node": "pimp_app",
            "TaggedAddresses": {
                "lan": "192.168.101.12",
                "wan": "192.168.101.12"
            }
        },
        "Service": {
            "Address": "192.168.101.12",
            "CreateIndex": 6718643,
            "EnableTagOverride": false,
            "ID": "pimp_192.168.101.12_8080",
            "ModifyIndex": 6718643,
            "Port": 8080,
            "Service": "pimp",
            "Tags": [
                "node-pimp"
            ]
        }
    }
]
```
