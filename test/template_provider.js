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

const nock = require('nock');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const StorageMemory = require('@f5devcentral/atg-storage').StorageMemory;
const {
    FsTemplateProvider,
    FsSingleTemplateProvider,
    DataStoreTemplateProvider,
    CompositeTemplateProvider
} = require('../lib/template_provider');

const { GitHubTemplateProvider } = require('../lib/github_provider');
const { nockGitHubAPI } = require('./githubMock');

const templatesPath = './test/templatesets';

function runSharedTests(createProvider) {
    it('construct', function () {
        const provider = createProvider();
        assert.ok(provider);
    });
    it('load_list', function () {
        const provider = createProvider();
        return provider.list()
            .then((tmplList) => {
                assert.deepStrictEqual(tmplList.sort(), [
                    'test/base',
                    'test/combine',
                    'test/complex',
                    'test/extended',
                    'test/simple',
                    'test/simple_udp'
                ]);
            });
    });
    it('load_list_filter', function () {
        const provider = createProvider(['foo']);
        return provider.list()
            .then((templates) => {
                assert.ok(templates);
                assert.strictEqual(templates.length, 0);
            });
    });
    it('list_sets', function () {
        const provider = createProvider();
        return assert.becomes(provider.listSets(), ['test']);
    });
    it('load_single_complex', function () {
        const provider = createProvider();
        return provider.fetch('test/complex')
            .then((tmpl) => {
                assert.ok(tmpl);
                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));
                assert.strictEqual(schema.title, 'chat window');
                assert.strictEqual(schema.description, '');
                assert.strictEqual(tmpl.target, 'as3');
                assert.ok(tmpl._partials.chatlog);
                assert.strictEqual(schema.properties.fromFile.default, 'Lorem ipsum\n');
            });
    });
    it('load_single_with_schema', function () {
        const provider = createProvider();
        return provider.fetch('test/simple')
            .then((tmpl) => {
                assert.ok(tmpl);
                console.log(JSON.stringify(tmpl, null, 2));
                assert.strictEqual(tmpl.title, 'Simple YAML file');
                assert.strictEqual(tmpl.target, 'as3');
            });
    });
    it('load_sub_template', function () {
        const provider = createProvider();
        return provider.fetch('test/extended')
            .then((tmpl) => {
                assert.ok(tmpl);
                console.log(JSON.stringify(tmpl, null, 2));
                assert.strictEqual(tmpl.title, 'Main template');
                assert.strictEqual(tmpl._allOf[0].title, 'Base Template');
            });
    });
    it('load_single_bad', function () {
        const provider = createProvider();
        return assert.isRejected(provider.fetch('does_not_exist'));
    });
    it('load_multiple', function () {
        const provider = createProvider();
        return assert.isFulfilled(provider.fetch('test/simple'))
            .then(() => assert.isFulfilled(provider.fetch('test/complex')))
            .then(() => assert.isFulfilled(provider.fetch('test/simple')));
    });
    it('get_schemas', function () {
        const provider = createProvider();
        return provider.getSchemas()
            .then((schemas) => {
                const schemaNames = Object.keys(schemas);
                console.log(JSON.stringify(schemas, null, 2));
                assert(schemaNames.includes('test/types'), 'expected test/types to be in the schema list');
            });
    });
    it('list_tmpl_sources', function () {
        const provider = createProvider();
        return assert.becomes(provider.getNumTemplateSourceTypes('test'), {
            MST: 1,
            YAML: 5
        })
            .then(() => assert.becomes(provider.getNumTemplateSourceTypes(), {
                MST: 1,
                YAML: 5
            }));
    });
    it('num_schemas', function () {
        const provider = createProvider();
        return assert.becomes(provider.getNumSchema('test'), 1)
            .then(() => assert.becomes(provider.getNumSchema(), 1));
    });
    it('fetch_set', function () {
        const provider = createProvider();
        return provider.fetchSet('test')
            .then((templates) => {
                console.log(JSON.stringify(templates, null, 2));
                assert.ok(templates['test/simple']);
                assert.ok(templates['test/complex']);
            });
    });
    it('get_set_data', function () {
        const provider = createProvider();
        return provider.getSetData('test')
            .then((setData) => {
                console.log(JSON.stringify(setData, null, 2));
                assert.ok(setData);

                assert.strictEqual(setData.name, 'test');
                assert.strictEqual(setData.supported, false);

                const tmplNames = setData.templates.map(x => x.name).sort();
                assert.deepStrictEqual(tmplNames, [
                    'test/base',
                    'test/combine',
                    'test/complex',
                    'test/extended',
                    'test/simple',
                    'test/simple_udp'
                ]);
                const tmplDesc = setData.templates.map(x => x.description).sort();
                assert.deepStrictEqual(tmplDesc, [
                    '',
                    '',
                    '',
                    'A simple template to test we can handle the .yaml file extension',
                    'An example of how to combine templates',
                    'Simple UDP load balancer using the same port on client and server side.\nUses AS3 template: udp.'
                ]);
                const schemaNames = setData.schemas.map(x => x.name).sort();
                assert.deepStrictEqual(schemaNames, [
                    'test/types'
                ]);
            });
    });
}

describe('template provider tests', function () {
    describe('FsTemplateProvider', function () {
        runSharedTests(
            filtered => new FsTemplateProvider(templatesPath, filtered)
        );
        it('load_single_mst', function () {
            const provider = new FsTemplateProvider(templatesPath);
            return provider.fetch('test/simple_udp')
                .then((tmpl) => {
                    assert.ok(tmpl);
                });
        });
        it('load_single_yml', function () {
            const provider = new FsTemplateProvider(templatesPath);
            return provider.fetch('test/complex')
                .then((tmpl) => {
                    assert.ok(tmpl);
                });
        });
        it('bad_tmpl_path', function () {
            const provider = new FsTemplateProvider('bad/path');
            return Promise.all([
                assert.isRejected(provider.list()),
                assert.isRejected(provider.fetch('simple_udp'))
            ]);
        });
        it('remove_tmpl_set', function () {
            const provider = new FsTemplateProvider(templatesPath);
            return assert.isRejected(provider.removeSet('example'), /not implemented/);
        });
    });
    describe('FsSingleTemplateProvider', function () {
        it('load_single_mst', function () {
            const provider = new FsSingleTemplateProvider(`${templatesPath}/test`);
            return provider.fetch('test/simple_udp')
                .then((tmpl) => {
                    assert.ok(tmpl);
                });
        });
    });
    describe('DataStoreTemplateProvider', function () {
        const testStorage = new StorageMemory();
        before(function () {
            testStorage.data = {};
            return DataStoreTemplateProvider.fromFs(testStorage, templatesPath);
        });
        const createProvider = filtered => new DataStoreTemplateProvider(testStorage, filtered);

        runSharedTests(createProvider);

        it('load_single_bad_tmpl_path', function () {
            const provider = createProvider();
            return assert.isRejected(provider.fetch('test/badpath'));
        });
        it('remove_tmpl_set', function () {
            const provider = createProvider();
            return assert.isFulfilled(provider.removeSet('test'))
                .then(() => assert.becomes(provider.listSets(), []));
        });
        it('remove_tmpl_set_missing', function () {
            const provider = createProvider();
            return assert.isRejected(provider.removeSet('does_not_exist'), /failed to find template set/);
        });
    });
    describe('GitHubTemplateProvider', function () {
        const repo = 'f5-test/f5-fast-test-templatesets';
        before(() => nockGitHubAPI(repo, './test/templatesets'));
        after(() => nock.cleanAll());

        runSharedTests(
            filtered => new GitHubTemplateProvider(
                repo,
                {
                    filteredSets: filtered,
                    apiToken: 'secret'
                }
            )
        );
    });
    describe('CompositeTemplateProvider', function () {
        const testStorage = new StorageMemory();
        before(function () {
            testStorage.data = {};
            return DataStoreTemplateProvider.fromFs(testStorage, templatesPath);
        });

        runSharedTests(
            filtered => new CompositeTemplateProvider([
                new FsTemplateProvider(templatesPath, filtered),
                new DataStoreTemplateProvider(testStorage, filtered)
            ])
        );
    });
});
