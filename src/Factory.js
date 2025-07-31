'use strict';

const _ = require('lodash');
const ServiceInstance = require('./ServiceInstance');
const ServiceInstanceInfo = require('./ServiceInstanceInfo');
const ServiceInstances = require('./ServiceInstances');
const ConsulResponseValidator = require('./ConsulResponseValidator');
const InvalidDataError = require('./Error').InvalidDataError;

const CHECK_ID_SERF_HEALTH = 'serfHealth';
const CHECK_STATUS_PASSING = 'passing';
const CHECK_OUTPUT_PATTERN = 'Output: ';

/**
 * Tries to build `ServiceInstanceInfo` from output received from output of check with corresponding data.
 *
 * Service responds to consul healthcheck with JSON using the following format (example):
 *   `{"data":{"status":"OK","pid":1687,"mem":{"total":13121352,"free":3405508},
 *      "cpu":{"usage":1.2079917706585719,"count":16}}}"`
 *
 * After stringification of JSON it becomes:
 *   `{\"data\":{\"status\":\"OK\",\"pid\":1687,\"mem\":{\"total\":13121352,\"free\":3405508},
 *      \"cpu\":{\"usage\":1.2079917706585719,\"count\":16}}}"`
 *
 * This method parses stringified JSON and run extractors and tries to build `ServiceInstanceInfo` object.
 *
 * @param {string} output
 * @param {Object} extractors
 *
 * @returns {ServiceInstanceInfo}
 */
function buildInstanceInfoFromOutput(output, extractors) {
    const parsedOutput = JSON.parse(output);
    const instanceInfo = Object.create(null);

    for (const extractorName in extractors) {
        instanceInfo[extractorName] = extractors[extractorName].extract(parsedOutput);
    }

    return new ServiceInstanceInfo(instanceInfo);
}

/**
 * Tries to build `ServiceInstance` object and in case of fail returns null
 *
 * @param {Object} node - data that returns `consul.health.service` call
 * @param {ServiceInstanceInfo|null} instanceInfo
 * @return {ServiceInstance|null}
 */
function buildServiceInstance(node, instanceInfo) {
    try {
        let lanIp = null;
        let wanIp = null;
        let serviceAddress = null;

        if (_.has(node.Node.TaggedAddresses, 'lan')) {
            lanIp = node.Node.TaggedAddresses.lan;
        }

        if (_.has(node.Node.TaggedAddresses, 'wan')) {
            wanIp = node.Node.TaggedAddresses.wan;
        }

        if (_.has(node.Service, 'Address') && _.isString(node.Service.Address) && !_.isEmpty(node.Service.Address)) {
            serviceAddress = node.Service.Address;
        }

        return new ServiceInstance(
            lanIp,
            wanIp,
            serviceAddress,
            node.Service.Port,
            node.Node.Address,
            node.Node.Node,
            node.Node.Datacenter,
            node.Service.ID,
            node.Service.Tags,
            instanceInfo
        );
    } catch (err) {
        return null;
    }
}

/**
 * Function receives an array of nodes, and classify it as `healthy` or `unhealthy`
 *
 * It validates `registeredNodes` using `ConsulResponseValidator.filterValidHealthyServices`, so
 * check documentation of `consulHelper.filterValidHealthyServices` to understand which
 * fields are checked and required.
 *
 * Node will be marked `unhealthy` if at least one case occurs:
 *   - at least one check, except serfHealth check, not in `passing` state
 *
 * Node will be `skipped` in case:
 *   - it doesn't contain registered checks at all
 *   - it doesn't contain instance-status check
 *   - invalid format of node data
 *   - serfHealth check is in critical state
 *
 * In all other cases node will be `healthy`.
 *
 * @param {Array} registeredNodes - an array of nodes received from consul
 * @param {string} checkNameWithStatus - the name of check that contains output with status of instance
 * @param {Object|undefined} extractors - an object that contains extractors of service info  from output
 * @return {{instances: ServiceInstances, errors: InvalidDataError[]}}
 */
function buildServiceInstances(registeredNodes, checkNameWithStatus, extractors) {
    const instances = new ServiceInstances();
    const {validNodes, errors} = ConsulResponseValidator.filterValidHealthyServices(registeredNodes);

    if (validNodes.length === 0) {
        return {instances, errors};
    }

    validNodes.forEach(node => {
        const ip = node.Node.Address;
        let passing = true;
        let instanceInfo = null;
        let checkWithStatusFound = false;
        let serfHealthCritical = false;
        let checkWithStatusOutputExist = true;

        if (node.Checks.length === 0) {
            errors.push(new InvalidDataError(
                'node received from consul has not registered health checks, node will be skipped',
                { address: node.Node.Address, nodeName: node.Node.Node }
            ));

            return;
        }

        node.Checks.forEach(check => {
            if (check.CheckID === CHECK_ID_SERF_HEALTH && check.Status !== CHECK_STATUS_PASSING) {
                serfHealthCritical = true;
            }

            if (serfHealthCritical) {
                // skip this check and jump to the next one
                // will skip all checks once serfHealth was found
                return;
            }

            if (check.Status !== CHECK_STATUS_PASSING) {
                passing = false;
            }

            if (check.Name !== checkNameWithStatus) {
                // skip this check and jump to the next one
                return;
            }

            checkWithStatusFound = true;

            // if we are here the check is check with instance status
            const pos = check.Output.indexOf(CHECK_OUTPUT_PATTERN);
            if (pos <= 0) {
                errors.push(new InvalidDataError(
                    'Invalid format of output field of check received from consul, node will be skipped',
                    {address: ip, check: check}
                ));

                checkWithStatusOutputExist = false;

                // skip this check and jump to the next one
                return;
            }

            if (extractors !== undefined) {
                const outputData = check.Output.substring(pos + CHECK_OUTPUT_PATTERN.length);

                try {
                    instanceInfo = buildInstanceInfoFromOutput(outputData, extractors);
                } catch (err) {
                    errors.push(new InvalidDataError(err.message, {outputData}));
                }
            }
        });

        if (serfHealthCritical) {
            errors.push(new InvalidDataError(
                'serfHealth check is in critical state, node will be skipped',
                {node}
            ));

            return;
        }

        if (!checkWithStatusFound) {
            errors.push(new InvalidDataError(
                'Check with `checkNameWithStatus` was not found among all checks on the node, node will be skipped',
                {node}
            ));

            return;
        }

        if (!checkWithStatusOutputExist) {
            return;
        }

        const instance = buildServiceInstance(node, instanceInfo);
        if (instance === null) {
            errors.push(new InvalidDataError('Invalid format of node data, node will be skipped', {node}));

            return;
        }

        // if some another check is in failing mode, except check with instance status or
        // if check with instance status has invalid format - service is unhealthy
        if (passing) {
            instances.addHealthy(instance);
        } else {
            instances.addUnhealthy(instance);
        }
    });

    return {instances, errors};
}

module.exports = {
    buildServiceInstance,
    buildServiceInstances,
    buildInstanceInfoFromOutput
};
