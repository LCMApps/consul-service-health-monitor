'use strict';

const os = require('os');
const _ = require('lodash');
const {IpAddressDetector} = require('consul-service-registrator');

async function getAddressForChecks(
    consulConfig,
    consulCheckHostEnvVarName = 'CONSUL_CHECK_HOST',
    consulCheckInterfaceEnvVarName = 'CONSUL_CHECK_INTERFACE',
    envVarObject = process.env,
) {

    const consulCheckHost = envVarObject[consulCheckHostEnvVarName];
    const consulCheckInterface = envVarObject[consulCheckInterfaceEnvVarName];

    const isConsulCheckHostPresentAndValid = !_.isUndefined(consulCheckHost) && !_.isEmpty(consulCheckHost);

    const isConsulCheckInterfacePresentAndValid = !_.isUndefined(consulCheckInterface) &&
        !_.isEmpty(consulCheckInterface);

    if (isConsulCheckHostPresentAndValid) {
        console.log('Consul checks will be registered for host ' +
            `"${consulCheckHost}" (${consulCheckHostEnvVarName}=${consulCheckHost}).`);

        if (isConsulCheckInterfacePresentAndValid) {
            console.log('Consul checks for the IP address of the interface setting is present ' +
                `(${consulCheckInterfaceEnvVarName}=${consulCheckInterface}), but will be ` +
                `ignored, because ${consulCheckHostEnvVarName} setting is present too and has a higher priority.`);
        }

        return consulCheckHost;
    } else {
        if (isConsulCheckInterfacePresentAndValid) {
            const interfaces = os.networkInterfaces();

            if (!_.has(interfaces, consulCheckInterface)) {
                throw new Error(`Interface isn't found (${consulCheckInterfaceEnvVarName}=${consulCheckInterface})`);
            }

            if (interfaces[consulCheckInterface].length > 1) {
                console.log(`Multiple addresses for the interface "${consulCheckInterface}" were found. "` +
                    'Only the first will be used');
            }

            const ip = interfaces[consulCheckInterface][0].address;

            console.log(`Consul checks will be registered for the IP address "${ip}" of the interface "` +
                consulCheckInterface + `" (${consulCheckInterfaceEnvVarName}=${consulCheckInterface}).`);
            return ip;
        } else {
            console.log('Consul checks will be registered for consul Node LAN IP');

            const consulNodeIpDetector = new IpAddressDetector(consulConfig);
            const addresses = await consulNodeIpDetector.getLanAndWanFromConsul();
            return addresses.lanIp;
        }
    }
}

module.exports = getAddressForChecks;
