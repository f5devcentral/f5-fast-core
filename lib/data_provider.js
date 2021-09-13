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
 * DataProvider that fetches data from the file system
 */
class FsDataProvider {
    /**
     * @param {string} dataRootPath - a path to a directory containing data files
     */
    constructor(dataRootPath) {
        this.data_path = dataRootPath;
        this.cache = new ResourceCache(dataName => new Promise((resolve, reject) => {
            fs.readFile(`${dataRootPath}/${dataName}.data`, (err, data) => {
                if (err) return reject(err);
                return resolve(data.toString('utf8'));
            });
        }));
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
class DataStoreDataProvider {
    /**
     * @param {object} datastore - an atg-storage DataStore
     * @param {string} tsName - the key to use to access the data file contents in the provided DataStore
     */
    constructor(datastore, tsName) {
        this.storage = datastore;
        this.tsName = tsName;
        this.cache = new ResourceCache(
            dataName => this.storage.hasItem(this.tsName)
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
                })
        );
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
    FsDataProvider,
    DataStoreDataProvider
};
