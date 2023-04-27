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
