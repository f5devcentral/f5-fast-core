/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const util = require('./util');

const template = 'bigip-fast-templates/http.yml';

const view = {
    tenant_name: 't1',
    app_name: 'app1',

    // virtual server
    virtual_address: '10.1.1.1',
    virtual_port: 4430,
    hostnames: ['www.example.com'],

    // http redirect
    redirect: true,

    // pool spec
    existing_pool: false,
    pool_name: undefined,
    pool_members: ['10.2.1.1', '10.2.1.2'],
    pool_port: 4433,
    load_balancing_mode: 'round-robin',

    // snat
    do_snat: true,
    snat_pool_name: undefined,
    snat_pool_members: ['10.3.1.1', '10.3.1.2'],

    // tls encryption profile spec
    existing_tls_server: false,
    tls_server_profile_name: undefined,
    tls_server_certificate: '/Common/default.crt',
    tls_server_key: '/Common/default.key',
    existing_tls_client: false,
    tls_client_profile_name: undefined,

    // http, xff, caching, compression, and oneconnect
    x_forwarded_for: true,
    existing_http_profile: false,
    http_profile_name: undefined,
    existing_acceleration_profile: false,
    accelertion_profile_name: undefined,
    existing_compression_profile: false,
    compression_profile_name: undefined,
    existing_multiplex_profile: false,
    multiplex_profile_name: undefined,

    // irules
    irules: [],

    // traffic policies
    endpoint_policies: [],

    // security policy
    do_security: false,
    security_policy_name: undefined,

    // request logging
    request_logging_profile_name: undefined
};

const expected = {
    class: 'ADC',
    schemaVersion: '3.0.0',
    id: 'urn:uuid:a858e55e-bbe6-42ce-a9b9-0f4ab33e3bf7',
    t1: {
        class: 'Tenant',
        app1: {
            class: 'Application',
            template: 'https',
            serviceMain: {
                class: 'Service_HTTPS',
                virtualAddresses: [view.virtual_address],
                virtualPort: view.virtual_port,
                redirect80: true,
                pool: 'app1_pool',
                snat: 'auto',
                serverTLS: 'app1_tls_server',
                clientTLS: 'app1_tls_client',
                profileHTTP: 'basic',
                profileHTTPAcceleration: 'basic',
                profileHTTPCompression: 'basic',
                profileMultiplex: 'basic'
            },
            app1_pool: {
                class: 'Pool',
                members: [{
                    servicePort: view.pool_port,
                    serverAddresses: ['10.2.1.1', '10.2.1.2'],
                    shareNodes: true
                }],
                loadBalancingMode: view.load_balancing_mode,
                monitors: ['https']
            },
            app1_tls_server: {
                class: 'TLS_Server',
                certificates: [{
                    certificate: 'app1_certificate'
                }]
            },
            app1_certificate: {
                class: 'Certificate',
                certificate: { bigip: view.tls_server_certificate },
                privateKey: { bigip: view.tls_server_key }
            },
            app1_tls_client: {
                class: 'TLS_Client'
            }
        }
    }
};

describe(template, function () {
    describe('tls bridging with new pool, snatpool, and profiles', function () {
        util.assertRendering(template, view, expected);
    });

    describe('tls bridging with default pool port, existing monitor, snatpool, and profiles', function () {
        before(() => {
            // default https pool port
            delete view.pool_port;
            expected.t1.app1.app1_pool.members[0].servicePort = 80;

            // existing TLS profiles
            view.existing_tls_server = true;
            view.tls_server_profile_name = '/Common/clientssl';
            delete expected.t1.app1.app1_tls_server;
            delete expected.t1.app1.app1_certificate;
            expected.t1.app1.serviceMain.serverTLS = { bigip: '/Common/clientssl' };
            view.existing_tls_client = true;
            view.tls_client_profile_name = '/Common/serverssl';
            delete expected.t1.app1.app1_tls_client;
            expected.t1.app1.serviceMain.clientTLS = { bigip: '/Common/serverssl' };

            // existing caching, compression, and multiplex profiles
            view.existing_http_profile = true;
            view.http_profile_name = '/Common/http1';
            expected.t1.app1.serviceMain.profileHTTP = { bigip: '/Common/http1' };
            view.existing_acceleration_profile = true;
            view.acceleration_profile_name = '/Common/caching1';
            expected.t1.app1.serviceMain.profileHTTPAcceleration = { bigip: '/Common/caching1' };
            view.existing_compression_profile = true;
            view.compression_profile_name = '/Common/compression1';
            expected.t1.app1.serviceMain.profileHTTPCompression = { bigip: '/Common/compression1' };
            view.existing_multiplex_profile = true;
            view.multiplex_profile_name = '/Common/oneconnect1';
            expected.t1.app1.serviceMain.profileMultiplex = { bigip: '/Common/oneconnect1' };
        });
        util.assertRendering(template, view, expected);
    });

    describe('tls bridging with existing pool, snat automap and default profiles', function () {
        before(() => {
            // existing pool
            delete view.pool_members;
            view.existing_pool = true;
            view.pool_name = '/Common/pool1';
            delete expected.t1.app1.app1_pool;
            expected.t1.app1.serviceMain.pool = { bigip: '/Common/pool1' };

            // default https virtual port
            delete view.virtual_port;
            expected.t1.app1.serviceMain.virtualPort = 443;

            // default caching, compression, and multiplex profiles
            delete view.http_profile_name;
            view.existing_http_profile = false;
            expected.t1.app1.serviceMain.profileHTTP = 'basic';
            delete view.acceleration_profile_name;
            view.existing_acceleration_profile = false;
            expected.t1.app1.serviceMain.profileHTTPAcceleration = 'basic';
            delete view.compression_profile_name;
            view.existing_compression_profile = false;
            expected.t1.app1.serviceMain.profileHTTPCompression = 'basic';
            delete view.multiplex_profile_name;
            view.existing_multiplex_profile = false;
            expected.t1.app1.serviceMain.profileMultiplex = 'basic';
        });
        util.assertRendering(template, view, expected);
    });

    describe('clean up', function () {
        util.cleanUp();
    });
});