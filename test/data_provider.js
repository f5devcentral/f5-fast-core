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
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const StorageMemory = require('@f5devcentral/atg-storage').StorageMemory;
const { FsDataProvider, DataStoreDataProvider } = require('../lib/data_provider');

const datasPath = './test/templatesets/test/';

function runSharedTests(createProvider) {
    it('construct', function () {
        const provider = createProvider();
        assert.ok(provider);
    });
    it('load_single', function () {
        const provider = createProvider();
        return provider.fetch('textData.txt')
            .then((data) => {
                assert.strictEqual(data, 'Lorem ipsum\n');
            });
    });
    it('load_single_bad', function () {
        const provider = createProvider();
        return assert.isRejected(provider.fetch('does_not_exist'));
    });
    it('load_list', function () {
        const provider = createProvider();
        return assert.becomes(provider.list(), [
            'textData.txt'
        ]);
    });
}

describe('data provider tests', function () {
    describe('FsDataProvider', function () {
        runSharedTests(() => new FsDataProvider(datasPath));
        it('bad_data_path', function () {
            const provider = new FsDataProvider('bad/path');
            return Promise.all([
                assert.isRejected(provider.list()),
                assert.isRejected(provider.fetch('f5'))
            ]);
        });
    });

    describe('DataStoreDataProvider', function () {
        const createDataStore = () => new StorageMemory({
            test: {
                templates: {},
                dataFiles: fs.readdirSync(`${datasPath}`).filter(x => x.endsWith('.data')).reduce(
                    (acc, fname) => {
                        acc[fname.replace(/.data$/, '')] = fs.readFileSync(`${datasPath}/${fname}`, { encoding: 'utf8' });
                        return acc;
                    }, {}
                )
            }
        });
        runSharedTests(() => new DataStoreDataProvider(createDataStore(), 'test'));
        it('bad_ts_name', function () {
            const provider = new DataStoreDataProvider(createDataStore(), 'does_not_exist');
            return Promise.all([
                assert.isRejected(provider.list()),
                assert.isRejected(provider.fetch('textData'))
            ]);
        });
    });
});
