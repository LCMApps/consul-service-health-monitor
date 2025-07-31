# consul-service-health-monitor

`consul-service-health-monitor` is a utility designed to connect to Consul and run (until explicitly stopped)
`/v1/health/service/:serviceId` requests as blocking queries to track changes in the health status of registered
services (both healthy and unhealthy).

This module is designed to work as a standalone component but can be significantly more powerful
*when used in combination with [consul-service-registrator](https://github.com/LCMApps/consul-service-registrator)*.

## Installation
Install the package itself and `consul` module:

```shell
$ npm install consul-service-health-monitor consul
```

## Initialization
Assume you have a service that
[registers with Consul](https://developer.hashicorp.com/consul/api-docs/agent/service#register-service) using the
following payload:

* `Name: "example_http_service"` - defines the logical name of the service. Multiple instances can share the same name.

* `ID: "example_http_service_3000"` - provides a unique identifier for this specific service instance. This ID must
be unique per agent. It's recommended to explicitly set it to a meaningful value, such as the service `Name` plus a
hash or port, to help distinguish changes across restarts.


After registration, the service also
[adds a health check](https://developer.hashicorp.com/consul/api-docs/agent/check#register-check) with a payload
such as:

* `ID: "example_http_service_3000_status"` - a unique identifier for the check on the node.

* `Name: "example_http_service health status"` - the human-readable name of the check.

* Other fields may be present but are not essential for this context.


To monitor this service, initialize the module in your code along with the consul client:

```js
const Consul = require('consul');
const { ServiceInstancesMonitor } = require('consul-service-health-monitor');

const consulClient = new Consul({
    host: "127.0.0.1",
    port: 8500,
});

const monitorConfig = {
    serviceName: "example_http_service",
    checkNameWithStatus: "example_http_service health status",
    dc: "dc1",
    timeoutMsec: 1000,
};

const extractors = undefined;

const monitor = new ServiceInstancesMonitor(monitorConfig, consulClient, extractors);
```

> Note: For more configuration options related to consulClient, refer to the
> [`consul` module documentation](https://github.com/silas/node-consul).

### `monitorConfig` object

The monitorConfig object must be a plain JSON object with the following fields:

* `serviceName` - the (non-unique) logical name of the service. If the service was registered with
"example_http_service", the same name must be used here. Multiple instances across nodes may share this name.

* `checkNameWithStatus` – the exact name of the health check as given during registration. It does not have to be
unique. In fact, it's recommended that all instances use the same check name so the monitor can reliably locate the
correct check. Consul also returns other checks (e.g., serfHealth), so this name helps filter for the intended one
with a known output format (e.g., JSON).

* `dc` – (optional) the datacenter to search in. If the specified datacenter does not exist or is unreachable,
an exception will be thrown when `ServiceInstancesMonitor.start()` is called. You may pass `undefined` or don't set
the value at all and `ServiceInstancesMonitor` will return all possible instances it can find according default
`consul agent` logic.

* `timeoutMsec` – (optional) a positive integer indicating the timeout (in milliseconds) for retrieving initial data
from Consul's `/health/checks/:service` endpoint. This timeout applies only to the initial fetch; subsequent updates
use Consul's blocking query mechanism. The default value is `5000` milliseconds.

### `extractors` object

You may pass `undefined` or omit the `extractors` object entirely. In that case, the initial list of service
instances, as well as instances delivered via the `changed` event, will have `instance.getInfo() === null`.

If `extractors` are provided, they will be applied to the `Output` field of the relevant health check in order to
parse the value into a structured DTO object. You can define your own extractors, or use those provided in the
`examples/extractors` directory.

Let’s look at an example.

A service is registered, and a health check is added. Consul receives the following response from the
`/v1/health/service/:name` endpoint:

```json
[
  {
    "Node": { ... },
    "Service": {
      "ID": "example_http_service_3000",
      "Service": "example_http_service"
    },
    "Checks": [
      {
        "Node": "example-consul",
        "CheckID": "serfHealth",
        "Name": "Serf Health Status",
        "Status": "passing"
      },
      {
        "Node": "example-consul",
        "CheckID": "example_http_service_3000_status",
        "Name": "example_http_service health status",
        "Status": "passing",
        "Notes": "",
        "Output": "HTTP GET http://172.16.3.3:3000/service/status: 200 OK Output: {\"data\":{\"status\":\"OK\",\"pid\":29,\"mem\":{\"total\":12452,\"free\":11078},\"cpu\":{\"usage\":0.53,\"count\":10}}}",
        "ServiceID": "example_http_service_3000",
        "ServiceName": "example_http_service"
      }
    ]
  }
]
```

If `extractors` are configured, `ServiceInstancesMonitor` will parse the `Output` field, expecting it to contain a
valid JSON object.

The relevant parsed JSON object in this example would look like:

```json
{
  "data": {
    "status": "OK",
    "pid": 29,
    "mem": {
      "total": 12452,
      "free": 11054
    },
    "cpu": {
      "usage": 0.64,
      "count": 10
    }
  }
}
```

To extract the "cpu" and "status" fields from this structure, you can define your extractors as follows:

```js
const CpuInfoExtractor = require('./src/extractors/CpuInfoExtractor');
const StatusInfoExtractor = require('./src/extractors/StatusInfoExtractor');

const extractors = {
  cpu: new CpuInfoExtractor(),
  status: new StatusInfoExtractor(),
};
```

The `ServiceInstancesMonitor` will pass the parsed object (specifically the value of the `data` field) to each
extractor's `extract()` method. Your extractor should then parse and structure the relevant fields as desired.

> Note. Refer to the provided examples and documentation in the `examples/extractors` folder for further
> implementation details.

## Usage

Monitor must be started by calling `ServiceInstancesMonitor::startService()` method.

On success, this method returns the list of nodes, represented as an object of `ServiceInstances` class.

`ServiceInstancesMonitor::startService()` may throw an error of the following type and reason:
* `AlreadyInitializedError` if the `ServiceInstancesMonitor` is already started;
* `WatchTimeoutError` if neither initial data nor error is received for defined `timeoutMsec` or default interval;
* `WatchError` if an error occurs from the `consul` module's underlying method.

*No `error` events are emitted during the execution of `startService()`! Any error will be thrown for explicit
transparency.*

If an error is thrown, the monitor is not active and you may try to start it again.

```js
const monitor = new ServiceInstancesMonitor(monitorConfig, consulClient, extractors);
try {
    const initialNodes = await monitor.startService();
} catch (err) {
    console.log(err);
}
```

### Events

`ServiceInstancesMonitor` may emmt the following events:
* `changed` with an object of `ServiceInstances` class. *It doesn't compare the list of instances seen before! You
need to do it on your side according to your logic!*
* `unhealthy` - reflects that `ServiceInstancesMonitor` can't connect to Consul or some Consul-related issue has
happened. If you set custom `consul` package options like `backoff`, `ServiceInstancesMonitor` will be in an unhealthy
state and you will not get any `changed` events, the state is not consistent and you can't rely on it, probably.
But it depends on your business logic.
* `healthy` when `ServiceInstancesMonitor` has recovered connection to Consul or etc. You may rely on
`ServiceInstancesMonitor` data as it's accurate after this event. On recovery, you will immediately receive a
`changed` event with the current set of instances.
* `error` for all errors, starting from parsing output by extractors, to Consul connection, timeout, or etc issues. You
don't need to react proactively to this event and try to restart the `ServiceInstancesMonitor`. It will retry
infinitely until `ServiceInstancesMonitor:stop()` is called.

### ServiceInstances

`ServiceInstances` class is distributed with the package too. You may import it and all encapsulated classes:

```js
const { ServiceInstances, ServiceInstance, ServiceInstanceInfo } = require('consul-service-health-monitor');
```

There is a list of methods provided by `ServiceInstances`:
* `getHealthy()` returns an array of healthy instances;
* `getUnhealthy()` returns an array of unhealthy instances;
* `getAll()` returns an array of all instances.

Every element of any array returned will be a class of `ServiceInstance`.

### `ServiceInstance`

Objects of `ServiceInstance` class have the following methods:

* `getLanIp()`: Returns lanIp. May be null if the Consul agent (or the whole server) on the node goes down. In such a
situation, the Consul leader remembers the service and node for some time and marks serfHealth as critical.
While the node exists, the health api returns null for `Node.TaggedAddresses`.

* `getWanIp()`: Returns wanIp. May be null if the Consul agent (or the whole server) on the node goes down. In such a
situation consul leader remembers the service and node for some time and marks serfHealth as critical. While node exists,
health api returns null for `Node.TaggedAddresses`.

* `getServiceAddress()`: Returns the `Service.Address` value from the Consul. May be null if the service explicitly
ignores the setting of address.

* `getPort()`: Returns the port on which the service is listening for requests.

* `getNodeName()`: Returns the nodeName of the node where the service is running. In most cases, it is the hostname
of the node where the service instance is running. On the other hand, it may be a uuid of the node. May be an empty
string if the Consul agent (or the whole server) on the node goes down. In such a situation consul leader remembers
service and node for some time but returns empty string as `nodeName`.

* `getNodeAddress()`: Returns the address (ip or host) of the node where the service is running.

* `getNodeDatacenter()`: Returns the Consul datacenter of the node where the service is running.

* `getServiceId()`: Returns the ID of the service instance.

* `getServiceTags()`: Returns an array of serviceTags.

* `getInfo()`: Returns an object that represents the status of the instance. May be `null` if there are no
extractors applied or if the extractor failed to parse the valid data format expected. Any underlying objects or
arrays are subject to your extractor logic. Check `examples/extractors` for more details. 

## Examples

Check `examples/` folder. There are two applications:
* `example-http-service` - application based in express, with CPU and memory monitoring based on
[system-health-monitor](https://github.com/LCMApps/system-health-monitor/) package, that registers in consul.
* `example-monitor` - application that monitors health status and availability of the service `example-http-service`
(not the single instance, but any number of instances of the service).

Both of applications use the real consul service for the demo.

To run examples use the following commands.

```shell
$ cd examples
$ docker-compose up --build
```

By default, examples use package `consul-service-health-monitor` from npm. You may launch docker containers easily.
If you want to play with the codebase of the repository just change the line with import of the package from
```
const {ServiceInstancesMonitor} = require('consul-service-health-monitor');
```
to
```
const {ServiceInstancesMonitor} = require('../../index');
```

Also, you will not be able to launch it in docker, only from the host machine. The command for launch must be

```
$ CONSUL_SERVICE_NAME_TO_MONITOR=example_http_service CONSUL_SERVICE_CHECK_NAME_WITH_STATUS="example_http_service health status" yarn run start
```

You may run containers separately. To launch only consul run `docker-compose up consul`.

To launch `example-http-service` container run `docker-compose up --build example-http-service`.

Also, there is `RUN_MODE` env variable that defines how to launch the container and the application inside
(works for both `example-http-service` and `example-monitor`):
* `RUN_MODE=debug` to open port 9229 in the container (`node --inspect=0.0.0.0:9229`).
* `RUN_MODE=debug-brk` to open port 9229 in the container and wait for the connection before the launch of the
application (`node --inspect-brk=0.0.0.0:9229`).
* `RUN_MODE=no-process` to start the container only, but not start the application. Application must be launched
manually.

Example. Launch consul, example-http-service container only. Launch example-monitor locally (not in container) 

```
$ RUN_MODE=no-process docker-compose up --build consul example-http-service

# In one terminal
$ docker-compose exec example-http-service sh -c "yarn run start"

# In second terminal
$ CONSUL_SERVICE_NAME_TO_MONITOR=example_http_service CONSUL_SERVICE_CHECK_NAME_WITH_STATUS="example_http_service health status" yarn run start
```
## Local development

```shell
$ npm link ../../
```

## Implementation notes

```
# curl -i http://example-consul:8500/v1/health/service/example_http_service
HTTP/1.1 200 OK
Content-Type: application/json
Vary: Accept-Encoding
X-Consul-Default-Acl-Policy: allow
X-Consul-Effective-Consistency: leader
X-Consul-Index: 240
X-Consul-Knownleader: true
X-Consul-Lastcontact: 0
X-Consul-Query-Backend: blocking-query
Date: Tue, 29 Jul 2025 13:24:43 GMT
Transfer-Encoding: chunked

[
    {
        "Node": {
            "ID": "e2905f94-53d1-510f-48f3-1f5853a89ff9",
            "Node": "example-consul",
            "Address": "172.16.3.2",
            "Datacenter": "dc1",
            "TaggedAddresses": {
                "lan": "172.16.3.2",
                "lan_ipv4": "172.16.3.2",
                "wan": "172.16.3.2",
                "wan_ipv4": "172.16.3.2"
            },
            "Meta": {
                "consul-network-segment": "",
                "consul-version": "1.21.3"
            },
            "CreateIndex": 13,
            "ModifyIndex": 14
        },
        "Service": {
            "ID": "example_http_service_3000",
            "Service": "example_http_service",
            "Tags": [
                "node-example_http_service",
                "example"
            ],
            "Address": "172.16.3.3",
            "TaggedAddresses": {
                "lan_ipv4": {
                    "Address": "172.16.3.3",
                    "Port": 3000
                },
                "wan_ipv4": {
                    "Address": "172.16.3.3",
                    "Port": 3000
                }
            },
            "Meta": null,
            "Port": 3000,
            "Weights": {
                "Passing": 1,
                "Warning": 1
            },
            "EnableTagOverride": false,
            "Proxy": {
                "Mode": "",
                "MeshGateway": {},
                "Expose": {}
            },
            "Connect": {},
            "PeerName": "",
            "CreateIndex": 20,
            "ModifyIndex": 20
        },
        "Checks": [
            {
                "Node": "example-consul",
                "CheckID": "serfHealth",
                "Name": "Serf Health Status",
                "Status": "passing",
                "Notes": "",
                "Output": "Agent alive and reachable",
                "ServiceID": "",
                "ServiceName": "",
                "ServiceTags": [],
                "Type": "",
                "Interval": "",
                "Timeout": "",
                "ExposedPort": 0,
                "Definition": {},
                "CreateIndex": 13,
                "ModifyIndex": 13
            },
            {
                "Node": "example-consul",
                "CheckID": "example_http_service_3000_status",
                "Name": "example_http_service health status",
                "Status": "passing",
                "Notes": "",
                "Output": "HTTP GET http://172.16.3.3:3000/service/status: 200 OK Output: {\"data\":{\"status\":\"OK\",\"pid\":29,\"mem\":{\"total\":12452,\"free\":11089},\"cpu\":{\"usage\":0.53,\"count\":10}}}",
                "ServiceID": "example_http_service_3000",
                "ServiceName": "example_http_service",
                "ServiceTags": [
                    "node-example_http_service",
                    "example"
                ],
                "Type": "http",
                "Interval": "1s",
                "Timeout": "0s",
                "ExposedPort": 0,
                "Definition": {},
                "CreateIndex": 21,
                "ModifyIndex": 240
            }
        ]
    }
]
```

If the service goes down the consecutive response will be

```
# curl -i http://example-consul:8500/v1/health/service/example_http_service
HTTP/1.1 200 OK
Content-Type: application/json
Vary: Accept-Encoding
X-Consul-Default-Acl-Policy: allow
X-Consul-Effective-Consistency: leader
X-Consul-Index: 264
X-Consul-Knownleader: true
X-Consul-Lastcontact: 0
X-Consul-Query-Backend: blocking-query
Date: Tue, 29 Jul 2025 13:27:08 GMT
Transfer-Encoding: chunked

[
    {
        "Node": {
            "ID": "e2905f94-53d1-510f-48f3-1f5853a89ff9",
            "Node": "example-consul",
            "Address": "172.16.3.2",
            "Datacenter": "dc1",
            "TaggedAddresses": {
                "lan": "172.16.3.2",
                "lan_ipv4": "172.16.3.2",
                "wan": "172.16.3.2",
                "wan_ipv4": "172.16.3.2"
            },
            "Meta": {
                "consul-network-segment": "",
                "consul-version": "1.21.3"
            },
            "CreateIndex": 13,
            "ModifyIndex": 14
        },
        "Service": {
            "ID": "example_http_service_3000",
            "Service": "example_http_service",
            "Tags": [
                "node-example_http_service",
                "example"
            ],
            "Address": "172.16.3.3",
            "TaggedAddresses": {
                "lan_ipv4": {
                    "Address": "172.16.3.3",
                    "Port": 3000
                },
                "wan_ipv4": {
                    "Address": "172.16.3.3",
                    "Port": 3000
                }
            },
            "Meta": null,
            "Port": 3000,
            "Weights": {
                "Passing": 1,
                "Warning": 1
            },
            "EnableTagOverride": false,
            "Proxy": {
                "Mode": "",
                "MeshGateway": {},
                "Expose": {}
            },
            "Connect": {},
            "PeerName": "",
            "CreateIndex": 20,
            "ModifyIndex": 20
        },
        "Checks": [
            {
                "Node": "example-consul",
                "CheckID": "serfHealth",
                "Name": "Serf Health Status",
                "Status": "passing",
                "Notes": "",
                "Output": "Agent alive and reachable",
                "ServiceID": "",
                "ServiceName": "",
                "ServiceTags": [],
                "Type": "",
                "Interval": "",
                "Timeout": "",
                "ExposedPort": 0,
                "Definition": {},
                "CreateIndex": 13,
                "ModifyIndex": 13
            },
            {
                "Node": "example-consul",
                "CheckID": "example_http_service_3000_status",
                "Name": "example_http_service health status",
                "Status": "critical",
                "Notes": "",
                "Output": "Get \"http://172.16.3.3:3000/service/status\": context deadline exceeded (Client.Timeout exceeded while awaiting headers)",
                "ServiceID": "example_http_service_3000",
                "ServiceName": "example_http_service",
                "ServiceTags": [
                    "node-example_http_service",
                    "example"
                ],
                "Type": "http",
                "Interval": "1s",
                "Timeout": "0s",
                "ExposedPort": 0,
                "Definition": {},
                "CreateIndex": 21,
                "ModifyIndex": 264
            }
        ]
    }
]
```