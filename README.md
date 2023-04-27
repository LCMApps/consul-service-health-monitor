# consul-service-health-monitor

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

