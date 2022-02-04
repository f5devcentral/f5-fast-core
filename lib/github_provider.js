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

const crypto = require('crypto');

const axios = require('axios');

const ResourceCache = require('./resource_cache').ResourceCache;
const Template = require('./template').Template;
const { BaseTemplateProvider } = require('./template_provider');
const { BaseDataProvider } = require('./data_provider');
const { stripExtension } = require('./utils');

class GitHubContentsApi {
    constructor(repo, options) {
        const axiosConfig = {
            baseURL: `https://api.github.com/repos/${repo}/contents/`
        };
        if (options.apiToken) {
            axiosConfig.headers = {
                Authorization: `Token ${options.apiToken}`
            };
        }
        this.endpoint = axios.create(axiosConfig);
    }

    _handleResponseError(err, task) {
        if (err.response) {
            const resp = err.response;
            const errStr = `${resp.status}: ${resp.data.message}`;
            return Promise.reject(new Error(
                `failed to ${task}: ${errStr}`
            ));
        }
        return Promise.reject(err);
    }

    getContentsByType(dir, type) {
        return Promise.resolve()
            .then(() => this.endpoint.get(dir))
            .catch(e => this._handleResponseError(e, `get items for ${dir}`))
            .then(resp => resp.data)
            .then(data => data
                .filter(x => x.type === type)
                .map(x => x.name));
    }

    getContentsData(contentPath) {
        return Promise.resolve()
            .then(() => this.endpoint(contentPath, {
                responseType: 'text',
                headers: {
                    Accept: 'application/vnd.github.v3+raw'
                }
            }))
            .catch(e => this._handleResponseError(e, `get contents for ${contentPath}`))
            .then(resp => resp.data.content)
            .then(data => Buffer.from(data, 'base64').toString('utf8'));
    }
}

/**
 * SchemaProvider that fetches data from a GitHub repository
 */
class GitHubSchemaProvider {
    constructor(repo, schemaRootPath, options) {
        options = options || {};

        this._rootDir = `/${schemaRootPath}`;
        this._contentsApi = new GitHubContentsApi(repo, {
            apiToken: options.apiToken
        });

        this.cache = new ResourceCache(schemaName => Promise.resolve()
            .then(() => this._contentsApi.getContentsData(`${this._rootDir}/${schemaName}.json`)));
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

    /**
     * List all schema known to the provider
     *
     * @returns {string[]}
     */
    list() {
        return Promise.resolve()
            .then(() => this._contentsApi.getContentsByType(this._rootDir, 'file'))
            .then(files => files
                .filter(x => x.endsWith('.json'))
                .map(x => stripExtension(x)));
    }
}

/**
 * DataProvider that fetches data from a GitHub repository
 */
class GitHubDataProvider extends BaseDataProvider {
    /**
     * @param {string} dataRootPath - a path to a directory containing data files
     */
    constructor(repo, dataRootPath, options) {
        super();
        options = options || {};

        this._rootDir = `/${dataRootPath}`;
        this._contentsApi = new GitHubContentsApi(repo, {
            apiToken: options.apiToken
        });
    }

    _loadData(dataName) {
        return Promise.resolve()
            .then(() => this._contentsApi.getContentsData(`${this._rootDir}/${dataName}.data`));
    }

    /**
     * List all data files known to the provider
     *
     * @returns {string[]}
     */
    list() {
        return Promise.resolve()
            .then(() => this._contentsApi.getContentsByType(this._rootDir, 'file'))
            .then(files => files
                .filter(x => x.endsWith('.data'))
                .map(x => stripExtension(x)));
    }
}

/**
 * TemplateProvider that fetches data from a GitHub repository
 */
class GitHubTemplateProvider extends BaseTemplateProvider {
    constructor(repo, options) {
        options = options || {};

        super(options.supportedHashes);

        this.filteredSets = new Set(options.filteredSets || []);

        this.repo = repo;
        this._apiToken = options.apiToken;

        this._schemaProviders = {};
        this._dataProviders = {};

        this._contentsApi = new GitHubContentsApi(this.repo, {
            apiToken: this._apiToken
        });
    }

    _loadTemplate(templatePath) {
        const tmplParts = templatePath.split('/');
        const tmplDir = tmplParts.slice(0, -1).join('/');
        const tmplName = tmplParts[tmplParts.length - 1];

        const schemaProvider = this._getSchemaProvider(tmplDir);
        const dataProvider = this._getDataProvider(tmplDir);
        return Promise.resolve()
            .then(() => this._contentsApi.getContentsByType(tmplDir, 'file'))
            .then((files) => {
                let useMst = 0;
                let fname;

                if (files.includes(`${tmplName}.yml`)) {
                    fname = `${tmplName}.yml`;
                } else if (files.includes(`${tmplName}.yaml`)) {
                    fname = `${tmplName}.yaml`;
                } else if (files.includes(`${tmplName}.mst`)) {
                    useMst = 1;
                    fname = `${tmplName}.mst`;
                } else {
                    return Promise.reject(new Error(`could not find a template with name "${templatePath}"`));
                }

                fname = `${tmplDir}/${fname}`;

                return Promise.resolve()
                    .then(() => this._contentsApi.getContentsData(fname))
                    .then(tmpldata => Template[useMst ? 'loadMst' : 'loadYaml'](tmpldata, {
                        schemaProvider,
                        dataProvider,
                        templateProvider: this
                    }));
            });
    }

    _getSchemaProvider(tsName) {
        if (!this._schemaProviders[tsName]) {
            this._schemaProviders[tsName] = new GitHubSchemaProvider(this.repo, tsName, { apiToken: this._apiToken });
        }

        return this._schemaProviders[tsName];
    }

    _getDataProvider(tsName) {
        if (!this._dataProviders[tsName]) {
            this._dataProviders[tsName] = new GitHubDataProvider(this.repo, tsName, { apiToken: this._apiToken });
        }

        return this._dataProviders[tsName];
    }

    /**
     * Get a list of set names known to the provider
     *
     * @returns {Promise} Promise resolves to a string array
     */
    listSets() {
        return Promise.resolve()
            .then(() => this._contentsApi.getContentsByType('', 'dir'))
            .then(items => items.filter(
                x => this.filteredSets.size === 0 || this.filteredSets.has(x)
            ));
    }

    /**
     * List all templates known to the provider (optionally filtered by the supplied list of set names)
     *
     * @param {string[]} [setList=[]]
     * @returns {Promise} Promise resolves to a string array
     */
    list(setList) {
        setList = setList || [];
        if (typeof setList === 'string') {
            setList = [setList];
        }

        return this.listSets()
            .then(sets => sets.filter(x => setList.length === 0 || setList.includes(x)))
            .then(sets => Promise.all(sets.map(
                setName => this._contentsApi.getContentsByType(`/${setName}`, 'file')
                    .then(data => data
                        .filter(x => this.hasTemplateExtension(x))
                        .map(x => `${setName}/${stripExtension(x)}`))
            )))
            .then(sets => sets.reduce((acc, curr) => acc.concat(curr), []));
    }

    /**
     * Delete the template set associated with the supplied set ID.
     *
     * Not implemented for FsSchemaProvider.
     *
     * @returns {Promise}
     */
    removeSet() {
        return Promise.reject(new Error('Set removal not implemented'));
    }

    /**
     * Get all schema known to the provider (optionally filtered by the supplied set name)
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to an object containing schema
     */
    getSchemas(filteredSetName) {
        const schemas = {};
        return Promise.resolve()
            .then(() => (filteredSetName ? [filteredSetName] : this.listSets()))
            .then(setList => Promise.all(setList.map(
                tsName => this._getSchemaProvider(tsName).list()
                    .then(schemaList => Promise.all(schemaList.map(
                        schemaName => this._getSchemaProvider(tsName).fetch(schemaName)
                            .then((schemaData) => {
                                const name = `${tsName}/${schemaName}`;
                                const schemaHash = crypto.createHash('sha256');
                                schemaHash.update(schemaData);
                                schemas[name] = {
                                    name,
                                    data: schemaData,
                                    hash: schemaHash.digest('hex')
                                };
                            })
                    )))
            )))
            .then(() => schemas);
    }

    /**
     * Get all data files known to the provider (optionally filtered by the supplied set name)
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to an object containing data files
     */
    getDataFiles(filteredSetName) {
        const dataFiles = {};
        return Promise.resolve()
            .then(() => (filteredSetName ? [filteredSetName] : this.listSets()))
            .then(setList => Promise.all(setList.map(
                tsName => this._getDataProvider(tsName).list()
                    .then(dataFileList => Promise.all(dataFileList.map(
                        dataName => this._getDataProvider(tsName).fetch(dataName)
                            .then((data) => {
                                const name = `${tsName}/${dataName}`;
                                const dataHash = crypto.createHash('sha256');
                                dataHash.update(data);
                                dataFiles[name] = {
                                    name,
                                    data,
                                    hash: dataHash.digest('hex')
                                };
                            })
                    )))
            )))
            .then(() => dataFiles);
    }
}

module.exports = {
    GitHubTemplateProvider,
    GitHubSchemaProvider
};
