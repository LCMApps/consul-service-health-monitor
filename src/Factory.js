'use strict';

const _ = require('lodash');
const ServiceInstance = require('./ServiceInstance');
const ServiceInstanceStatus = require('./ServiceInstanceStatus');
const ServiceInstances = require('./ServiceInstances');
const ConsulResponseValidator = require('./ConsulResponseValidator');
const InvalidDataError = require('./Error').InvalidDataError;

const CHECK_STATUS_PASSING = 'passing';
const CHECK_OUTPUT_PATTERN = 'Output: ';

/**
 * Tries to build `ServiceInstanceStatus` from output received from output of check with corresponding data.
 *
 * Service responds to consul healthcheck with JSON using the following format:
 *   `{"data":{"status":"OK","pid":1687,"mem":{"total":13121352,"free":3405508},
 *      "cpu":{"usage":1.2079917706585719,"count":16}}}"`
 *
 * After stringification of JSON it becomes:
 *   `{\"data\":{\"status\":\"OK\",\"pid\":1687,\"mem\":{\"total\":13121352,\"free\":3405508},
 *      \"cpu\":{\"usage\":1.2079917706585719,\"count\":16}}}"`
 *
 * This method parses stringified JSON and tries to build `ServiceInstanceStatus` object.
 *
 * @param {string} output
 * @returns {ServiceInstanceStatus|null} returns null if data in the output is missed or has an invalid format
 */
function buildInstanceStatusFromOutput(output) {
    try {
        const parsedOutput = JSON.parse(output);

        if (!_.has(parsedOutput, 'data') || !_.isObject(parsedOutput.data)) {
            return null;
        }

        const statusData = parsedOutput.data;

        if (
            !_.has(statusData, 'status') || !_.has(statusData, 'pid') ||
            !_.has(statusData, ['mem', 'total']) || !_.has(statusData, ['mem', 'free']) ||
            !_.has(statusData, ['cpu', 'usage']) || !_.has(statusData, ['cpu', 'count'])
        ) {
            return null;
        }

        return new ServiceInstanceStatus(
            statusData.pid,
            statusData.status,
            statusData.mem.total,
            statusData.mem.free,
            statusData.cpu.usage,
            statusData.cpu.count
        );
    } catch (err) {
        return null;
    }
}

/**
 * Tries to build `ServiceInstance` object and in case of fail returns null
 *
 * @param {Object} node - data that returns `consul.health.service` call
 * @param {ServiceInstanceStatus} instanceStatus
 * @return {ServiceInstance|null}
 */
function buildServiceInstance(node, instanceStatus) {
    try {
        return new ServiceInstance(
            node.Node.TaggedAddresses.lan,
            node.Node.TaggedAddresses.wan,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Service.Tags,
            instanceStatus
        );
    } catch (err) {
        return null;
    }
}

/**
 * Function receives an array of nodes, and classify it as `healthy`, `unhealthy`, `overloaded` or `on-maintenance`
 *
 * It validates `registeredNodes` using `ConsulResponseValidator.filterValidHealthyServices`, so
 * check documentation of `consulHelper.filterValidHealthyServices` to understand which
 * fields are checked and required.
 *
 * Node will be marked `unhealthy` if at least one case occurs:
 *   - at least one check, except check with instance-status, not in `passing` state
 *   - instance-status check isn't in passing state while instance returns "OK" to health check
 *
 * Node will be marked `overloaded` if all cases occurs:
 *   - all checks except instance-status check are in `passing` state
 *   - only instance-status check is not in passing state and instance returns "OVERLOADED" to health check
 *
 * Node will be marked 'on-maintenance' if all cases occurs:
 *   - all checks are in `passing` state and instance returns "MAINTENANCE" to health check
 *
 * Node will be `skipped` in case:
 *   - it doesn't contain registered checks at all
 *   - it doesn't contain instance-status check
 *   - instance-status check has invalid format
 *
 * In all other cases node will be `healthy`.
 *
 * @param {Array} registeredNodes - an array of nodes received from consul
 * @param {string} checkNameWithStatus - the name of check that contains output with status of instance
 * @return {{instances: ServiceInstances, errors: InvalidDataError[]}}
 */
function buildServiceInstances(registeredNodes, checkNameWithStatus) {
    const instances = new ServiceInstances();
    const {validNodes, errors} = ConsulResponseValidator.filterValidHealthyServices(registeredNodes);

    if (validNodes.length === 0) {
        return {instances, errors};
    }

    validNodes.forEach(node => {
        const ip = node.Node.Address;
        let passing = true;
        let instanceStatus = null;

        if (node.Checks.length === 0) {
            errors.push(new InvalidDataError(
                'node received from consul has not registered health checks, node will be skipped',
                { address: node.Node.Address, nodeId: node.Node.Node }
            ));

            return;
        }

        node.Checks.forEach(check => {
            if (check.Name !== checkNameWithStatus) {
                if (check.Status !== CHECK_STATUS_PASSING) {
                    passing = false;
                }

                // skip this check and jump to the next one
                return;
            }

            // if we are here the check is check with instance status
            const pos = check.Output.indexOf(CHECK_OUTPUT_PATTERN);
            if (pos <= 0) {
                errors.push(new InvalidDataError(
                    'Invalid format of output field of check received from consul, node will be skipped',
                    { address: ip, check: check }
                ));

                passing = false;

                // skip this check and jump to the next one
                return;
            }

            instanceStatus = buildInstanceStatusFromOutput(
                check.Output.substring(pos + CHECK_OUTPUT_PATTERN.length)
            );

            if (instanceStatus === null) {
                if (check.Status === CHECK_STATUS_PASSING) {
                    errors.push(new InvalidDataError(
                        'Invalid format of output field of check received from consul, node will be skipped',
                        { address: ip, check: check }
                    ));

                    passing = false;
                }
            } else {
                if (instanceStatus.isOk() && check.Status !== CHECK_STATUS_PASSING) {
                    errors.push(new InvalidDataError(
                        'ServiceInstance status check is OK but status in consul is not passing, node will be skipped',
                        { address: ip, check: check }
                    ));

                    passing = false;
                } else if (instanceStatus.isOnMaintenance() && check.Status !== CHECK_STATUS_PASSING) {
                    errors.push(new InvalidDataError(
                        'ServiceInstance status check is MAINTENANCE but status in consul is not passing, ' +
                            'node will be skipped',
                        { address: ip, check: check }
                    ));

                    passing = false;
                }
            }

        });

        if (instanceStatus === null) {
            return;
        }

        const instance = buildServiceInstance(node, instanceStatus);
        if (instance === null) {
            errors.push(new InvalidDataError('Invalid format of node data, node will be skipped', { node }));

            return;
        }

        // if some another check is in failing mode, except check with instance status or
        // if check with instance status has invalid format
        if (!passing) {
            instances.addUnhealthy(instance);
            return;
        }

        if (instance.getStatus().isOk()) {
            instances.addHealthy(instance);
        } else if (instance.getStatus().isOverloaded()) {
            instances.addOverloaded(instance);
        } else if (instance.getStatus().isOnMaintenance()) {
            instances.addOnMaintenance(instance);
        }
    });

    return {instances, errors};
}

module.exports = {
    buildServiceInstance,
    buildServiceInstances,
    buildInstanceStatusFromOutput
};
