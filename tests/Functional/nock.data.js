const loadData1 = {
    status: 'OK',
    pid: 100,
    mem: {
        total: 12813,
        free: 11786
    },
    cpu: {
        usage: 0.72,
        count: 16
    }
};

module.exports = {
    loadData1: loadData1,
    firstResponseHeaders: {
        'X-Consul-Index': '313984',
        'X-Consul-Knownleader': 'true',
        'X-Consul-Lastcontact': '0'
    },
    firstResponseBody: [
        {
            'Checks': [
                {
                    'CheckID': 'serfHealth',
                    'CreateIndex': 142154652,
                    'ModifyIndex': 142154652,
                    'Name': 'Serf Health Status',
                    'Node': 'transcoder-1.priv',
                    'Notes': '',
                    'Output': 'Agent alive and reachable',
                    'ServiceID': '',
                    'ServiceName': '',
                    'Status': 'passing'
                },
                {
                    'CheckID': 'transcoder_192.168.101.10_8080.transcoder_192.168.101.10_8080_status',
                    'CreateIndex': 142154657,
                    'ModifyIndex': 166069112,
                    'Name': 'Transcoder health status',
                    'Node': 'transcoder-1.priv',
                    'Notes': '',
                    'Output': 'HTTP GET http://192.168.101.10:8080/transcoder/v1/service/status: 200 OK Output: ' +
                        `{"data":${JSON.stringify(loadData1)}}`,
                    'ServiceID': 'transcoder_192.168.101.10_8080',
                    'ServiceName': 'transcoder',
                    'Status': 'passing'
                }
            ],
            'Node': {
                'Address': '192.168.101.10',
                'CreateIndex': 142154652,
                'ID': 'b3894b74-7627-4545-a303-5a28806a5ff2',
                'Meta': {},
                'ModifyIndex': 142154657,
                'Node': 'transcoder-1.priv',
                'TaggedAddresses': {
                    'lan': '192.168.101.10',
                    'wan': '100.100.100.10'
                }
            },
            'Service': {
                'Address': '192.168.101.11',
                'CreateIndex': 142154657,
                'EnableTagOverride': false,
                'ID': 'transcoder',
                'ModifyIndex': 142154657,
                'Port': 8080,
                'Service': 'transcoder_192.168.101.11_8080',
                'Tags': [
                    'node-transcoder'
                ]
            }
        },
        {
            'Checks': [
                {
                    'CheckID': 'serfHealth',
                    'CreateIndex': 142155255,
                    'ModifyIndex': 142155255,
                    'Name': 'Serf Health Status',
                    'Node': 'transcoder-2.priv',
                    'Notes': '',
                    'Output': 'Agent alive and reachable',
                    'ServiceID': '',
                    'ServiceName': '',
                    'Status': 'passing'
                },
                {
                    'CheckID': 'transcoder_192.168.101.11_8080.transcoder_192.168.101.11_8080_status',
                    'CreateIndex': 142155273,
                    'ModifyIndex': 166069118,
                    'Name': 'Transcoder health status',
                    'Node': 'transcoder-2.priv',
                    'Notes': '',
                    'Output': 'HTTP GET http://192.168.101.11:8080/transcoder/v1/service/status: 200 OK Output: ' +
                        `{'data':${JSON.stringify(loadData1)}}`,
                    'ServiceID': 'transcoder_192.168.101.11_8080',
                    'ServiceName': 'transcoder',
                    'Status': 'passing'
                }
            ],
            'Node': {
                'Address': '192.168.101.11',
                'CreateIndex': 142155255,
                'ID': '242878a4-b66a-48de-9094-e58ee2156ca5',
                'Meta': {},
                'ModifyIndex': 142155273,
                'Node': 'transcoder-2.priv',
                'TaggedAddresses': {
                    'lan': '192.168.101.11',
                    'wan': '100.100.100.11'
                }
            },
            'Service': {
                'Address': '192.168.101.11',
                'CreateIndex': 142155273,
                'EnableTagOverride': false,
                'ID': 'transcoder',
                'ModifyIndex': 142155273,
                'Port': 8080,
                'Service': 'transcoder_192.168.101.11_8080',
                'Tags': [
                    'node-transcoder'
                ]
            }
        }
    ]
};

