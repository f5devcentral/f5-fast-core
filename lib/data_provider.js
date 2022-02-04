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

'use strict';

const fs = require('fs');

const ResourceCache = require('./resource_cache').ResourceCache;

/**
 * Abstract base class for DataProvider classes
 */
class BaseDataProvider {
    constructor() {
        if (new.target === BaseDataProvider) {
            throw new TypeError('Cannot instantiate Abstract BaseDataProvider');
        }

        const abstractMethods = [
            '_loadData',
            'list'
        ];
        abstractMethods.forEach((method) => {
            if (this[method] === undefined) {
                throw new TypeError(`Expected ${method} to be defined`);
            }
        });

        this.cache = new ResourceCache(dataName => this._loadData(dataName));
    }

    /**
     * Get the data file contents associated with the supplied key
     *
     * @param {string} key
     * @returns {object}
     */
    fetch(key) {
        return this.cache.fetch(key);
    }
}

/**
 * DataProvider that fetches data from the file system
 */
class FsDataProvider extends BaseDataProvider {
    /**
     * @param {string} dataRootPath - a path to a directory containing data files
     */
    constructor(dataRootPath) {
        super();

        this.data_path = dataRootPath;
    }

    _loadData(dataName) {
        return new Promise((resolve, reject) => {
            fs.readFile(`${this.data_path}/${dataName}.data`, (err, data) => {
                if (err) return reject(err);
                return resolve(data.toString('utf8'));
            });
        });
    }

    /**
     * List all data files known to the provider
     *
     * @returns {string[]}
     */
    list() {
        return new Promise((resolve, reject) => {
            fs.readdir(this.data_path, (err, data) => {
                if (err) return reject(err);

                const list = data.filter(x => x.endsWith('.data'))
                    .map(x => x.replace(/.data$/, ''));
                return resolve(list);
            });
        });
    }
}

/**
 * DataProvider that fetches data from an atg-storage DataStore
 */
class DataStoreDataProvider extends BaseDataProvider {
    /**
     * @param {object} datastore - an atg-storage DataStore
     * @param {string} tsName - the key to use to access the data file contents in the provided DataStore
     */
    constructor(datastore, tsName) {
        super();

        this.storage = datastore;
        this.tsName = tsName;
    }

    _loadData(dataName) {
        return this.storage.hasItem(this.tsName)
            .then((result) => {
                if (result) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error(`Could not find template set "${this.tsName}" in data store`));
            })
            .then(() => this.storage.getItem(this.tsName))
            .then(ts => ts.dataFiles[dataName])
            .then((data) => {
                if (typeof data === 'undefined') {
                    return Promise.reject(new Error(`Failed to find data file named "${dataName}"`));
                }
                return Promise.resolve(data);
            });
    }

    /**
     * List all data files known to the provider
     *
     * @returns {string[]}
     */
    list() {
        return this.storage.hasItem(this.tsName)
            .then((result) => {
                if (result) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error(`Could not find template set "${this.tsName}" in data store`));
            })
            .then(() => this.storage.getItem(this.tsName))
            .then(ts => Object.keys(ts.dataFiles));
    }
}

module.exports = {
    BaseDataProvider,
    FsDataProvider,
    DataStoreDataProvider
};
