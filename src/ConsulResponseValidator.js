'use strict';

const _ = require('lodash');
const InvalidDataError = require('./Error').InvalidDataError;


/**
 * @param {array} checks - array of check elements to validate
 * @return {boolean} true if every element of array is valid
 */
function isValidChecks(checks) {
    return checks.every(
        check => _.isObject(check) && _.has(check, 'CheckID') && _.has(check, 'Status') &&
            _.has(check, 'Name') && _.has(check, 'Output')
    );
}

/**
 * Filters nodes that have valid format of data. Nodes that have invalid format will be not be
 * returned back to caller and `errors` array will contain information about format mismatch.
 *
 * Function checks presence of following properties:
 *   - `nodes[n].Node.Node`
 *   - `nodes[n].Node.Address`
 *   - `nodes[n].Node.TaggedAddresses.lan`
 *   - `nodes[n].Node.TaggedAddresses.wan
 *   - `nodes[n].Service.Tags` and checks that prop is array
 *   - `nodes[n].Checks` and checks that prop is array with at least one element
 *   - `nodes[n].Checks[m].CheckID`
 *   - `nodes[n].Checks[m].Status`
 *   - `nodes[n].Checks[m].Name`
 *   - `nodes[n].Checks[m].Output`
 *
 * @param {*} nodes - data received from `consul.health.service`
 * @returns {{validNodes: Object[], errors: InvalidDataError[]}}
 */
function filterValidHealthyServices(nodes) {
    const data = {validNodes: [], errors: []};

    if (!_.isArray(nodes)) {
        data.errors.push(new InvalidDataError('Invalid format of data received from consul', { nodes }));

        return data;
    }

    if (_.isEmpty(nodes)) {
        return data;
    }

    nodes.forEach(node => {
        const isTaggedAddressesValid = _.has(node, ['Node', 'TaggedAddresses']) &&
            (node.Node.TaggedAddresses === null ||
                (_.has(node, ['Node', 'TaggedAddresses', 'lan']) && _.has(node, ['Node', 'TaggedAddresses', 'wan']))
            );

        if (
            !_.isObject(node) || !_.has(node, ['Node', 'Node']) || !_.has(node, ['Node', 'Address']) ||
            !_.has(node, ['Service', 'ID']) || !_.has(node, ['Service', 'Tags']) || !_.has(node, 'Checks') ||
            !_.isArray(node.Service.Tags) || !isTaggedAddressesValid || !_.isArray(node.Checks) ||
            _.isEmpty(node.Checks)
        ) {
            data.errors.push(new InvalidDataError('Invalid format of node data received from consul', { node }));

            return;
        }

        if (!isValidChecks(node.Checks)) {
            data.errors.push(new InvalidDataError(
                'Invalid format of check in node.Checks received from consul',
                { node: node.Node.Node, address: node.Node.Address, checks: node.Checks }
            ));

            return;
        }

        data.validNodes.push(node);
    });

    return data;
}


module.exports = {
    filterValidHealthyServices
};
