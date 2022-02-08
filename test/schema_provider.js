/* Copyright 2021 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const nock = require('nock');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const StorageMemory = require('@f5devcentral/atg-storage').StorageMemory;
const { FsSchemaProvider, DataStoreSchemaProvider } = require('../lib/schema_provider');
const { GitHubSchemaProvider } = require('../lib/github_provider');
const { nockGitHubAPI } = require('./githubMock');

const schemasPath = './test/templatesets/test/';

function runSharedTests(createProvider) {
    it('construct', function () {
        const provider = createProvider();
        assert.ok(provider);
    });
    it('load_single', function () {
        const provider = createProvider();
        return provider.fetch('types')
            .then(schema => JSON.parse(schema))
            .then((schema) => {
                assert.ok(schema);
                console.log(JSON.stringify(schema, null, 2));
                assert.ok(schema.definitions.port);
            });
    });
    it('load_single_bad', function () {
        const provider = createProvider();
        return assert.isRejected(provider.fetch('does_not_exist'));
    });
    it('load_list', function () {
        const provider = createProvider();
        return assert.becomes(provider.list(), [
            'types'
        ]);
    });
}

describe('schema provider tests', function () {
    describe('FsSchemaProvider', function () {
        runSharedTests(() => new FsSchemaProvider(schemasPath));
        it('bad_schema_path', function () {
            const provider = new FsSchemaProvider('bad/path');
            return Promise.all([
                assert.isRejected(provider.list()),
                assert.isRejected(provider.fetch('f5'))
            ]);
        });

        it('schema_path_alias', function () {
            const provider = new FsSchemaProvider(schemasPath);

            provider.schema_path = 'foo';
            assert.strictEqual(provider.schemaPath, provider.schema_path);
        });
    });

    describe('DataStoreSchemaProvider', function () {
        const createDataStore = () => new StorageMemory({
            test: {
                templates: {},
                schemas: fs.readdirSync(`${schemasPath}`).filter(x => x.endsWith('.json')).reduce((acc, fname) => {
                    acc[fname.slice(0, -5)] = fs.readFileSync(`${schemasPath}/${fname}`, { encoding: 'utf8' });
                    return acc;
                }, {})
            }
        });
        runSharedTests(() => new DataStoreSchemaProvider(createDataStore(), 'test'));
        it('bad_ts_name', function () {
            const provider = new DataStoreSchemaProvider(createDataStore(), 'does_not_exist');
            return Promise.all([
                assert.isRejected(provider.list()),
                assert.isRejected(provider.fetch('f5'))
            ]);
        });
    });

    describe('GitHubSchemaProvider', function () {
        const repo = 'f5-test/f5-fast-test-templatesets';
        before(() => nockGitHubAPI(repo, './test/templatesets'));
        after(() => nock.cleanAll());

        runSharedTests(() => new GitHubSchemaProvider(
            repo,
            'test',
            {
                apiToken: 'secret'
            }
        ));
    });
});
