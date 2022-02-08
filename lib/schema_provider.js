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
 * Abstract base class for SchemaProvider classes
 */
class BaseSchemaProvider {
    constructor() {
        if (new.target === BaseSchemaProvider) {
            throw new TypeError('Cannot instantiate Abstract BaseSchemaProvider');
        }

        const abstractMethods = [
            '_loadSchema',
            'list'
        ];
        abstractMethods.forEach((method) => {
            if (this[method] === undefined) {
                throw new TypeError(`Expected ${method} to be defined`);
            }
        });

        this.cache = new ResourceCache(schemaName => this._loadSchema(schemaName));
    }

    /**
     * Get the schema associated with the supplied key
     *
     * @param {string} key
     * @returns {object}
     */
    fetch(key) {
        return this.cache.fetch(key);
    }
}

/**
 * SchemaProvider that fetches data from the file system
 */
class FsSchemaProvider extends BaseSchemaProvider {
    /**
     * @param {string} schemaRootPath - a path to a directory containing schema files
     */
    constructor(schemaRootPath) {
        super();

        this.schemaPath = schemaRootPath;
    }

    get schema_path() {
        return this.schemaPath;
    }

    set schema_path(value) {
        this.schemaPath = value;
    }

    _loadSchema(schemaName) {
        return new Promise((resolve, reject) => {
            fs.readFile(`${this.schemaPath}/${schemaName}.json`, (err, data) => {
                if (err) return reject(err);
                return resolve(data.toString('utf8'));
            });
        });
    }

    /**
     * List all schema known to the provider
     *
     * @returns {string[]}
     */
    list() {
        return new Promise((resolve, reject) => {
            fs.readdir(this.schemaPath, (err, data) => {
                if (err) return reject(err);

                const list = data.filter(x => x.endsWith('.json'))
                    .map(x => x.replace(/.json$/, ''));
                return resolve(list);
            });
        });
    }
}

/**
 * SchemaProvider that fetches data from an atg-storage DataStore
 */
class DataStoreSchemaProvider extends BaseSchemaProvider {
    /**
     * @param {object} datastore - an atg-storage DataStore
     * @param {string} tsName - the key to use to access the schema in the provided DataStore
     */
    constructor(datastore, tsName) {
        super();

        this.storage = datastore;
        this.tsName = tsName;
    }

    _loadSchema(schemaName) {
        return this.storage.hasItem(this.tsName)
            .then((result) => {
                if (result) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error(`Could not find template set "${this.tsName}" in data store`));
            })
            .then(() => this.storage.getItem(this.tsName))
            .then(ts => ts.schemas[schemaName])
            .then((schema) => {
                if (typeof schema === 'undefined') {
                    return Promise.reject(new Error(`Failed to find schema named "${schemaName}"`));
                }
                return Promise.resolve(schema);
            });
    }

    /**
     * List all schema known to the provider
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
            .then(ts => Object.keys(ts.schemas));
    }
}

module.exports = {
    BaseSchemaProvider,
    FsSchemaProvider,
    DataStoreSchemaProvider
};
