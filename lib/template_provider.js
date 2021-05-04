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
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ResourceCache = require('./resource_cache').ResourceCache;
const Template = require('./template').Template;
const { FsSchemaProvider } = require('./schema_provider');

/**
 * Abstract base class for TemplateProvider classes
 */
class BaseTemplateProvider {
    /**
     * @param {object} [supportedHashes={}] - an optional map of hash values to validate against
     */
    constructor(supportedHashes) {
        if (new.target === BaseTemplateProvider) {
            throw new TypeError('Cannot instantiate Abstract BaseTemplateProvider');
        }

        const abstractMethods = [
            '_loadTemplate',
            'listSets',
            'removeSet',
            'list',
            'getSchemas'
        ];
        abstractMethods.forEach((method) => {
            if (this[method] === undefined) {
                throw new TypeError(`Expected ${method} to be defined`);
            }
        });

        this.supportedHashes = supportedHashes || {};

        this.cache = new ResourceCache((tmplName => this._loadTemplate(tmplName)));
    }

    /**
     * Clear any cache associated with this provider
     */
    invalidateCache() {
        this.cache.invalidate();
    }

    /**
     * Get the template associated with the supplied key
     *
     * @param {string} key
     * @returns {Promise} Promise resolves to `Template`
     */
    fetch(key) {
        return this.cache.fetch(key);
    }

    /**
     * Get the template set associated with the supplied ID
     *
     * @param {string} setName
     * @returns {Promise} Promise resolves to an object containing template set information
     */
    fetchSet(setName) {
        return this.list(setName)
            .then(tmplList => Promise.all(tmplList.map(tmplName => Promise.all([
                Promise.resolve(tmplName),
                this.fetch(tmplName)
                    .catch(e => Promise.reject(new Error(
                        `Failed to load ${tmplName}: ${e.message}`
                    )))
            ]))))
            .then(tmplList => tmplList.reduce((acc, curr) => {
                const [tmplName, tmplData] = curr;
                acc[tmplName] = tmplData;
                return acc;
            }, {}));
    }

    /**
     * Determine if the provided template set ID is known to the provider
     *
     * @param {string} setid
     */
    hasSet(setid) {
        return this.listSets()
            .then(sets => sets.includes(setid));
    }

    /**
     * Get an object with a count of each template source type known to the provider.
     *
     * This is an object with properties being each unique type found and the values
     * are the number of times that type was found.
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to an object
     */
    getNumTemplateSourceTypes(filteredSetName) {
        const sourceTypes = {};
        const filteredSetList = (filteredSetName && [filteredSetName]) || [];
        return this.list(filteredSetList)
            .then(tmplList => Promise.all(tmplList.map(tmpl => this.fetch(tmpl))))
            .then(tmplList => tmplList.forEach((tmpl) => {
                if (!sourceTypes[tmpl.sourceType]) {
                    sourceTypes[tmpl.sourceType] = 0;
                }
                sourceTypes[tmpl.sourceType] += 1;
            }))
            .then(() => sourceTypes);
    }

    /**
     * Get the number of schema objects known to this provider
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to a number
     */
    getNumSchema(filteredSetName) {
        return this.getSchemas(filteredSetName)
            .then(schemas => Object.keys(schemas).length);
    }

    /**
     * Get data associated with the given template set
     *
     * @returns {Promise} Promise resolves to an object
     */
    getSetData(setName) {
        return Promise.all([
            this.fetchSet(setName),
            this.getSchemas(setName)
        ])
            .then(([templates, schemas]) => {
                const tsHash = crypto.createHash('sha256');
                const tmplHashes = Object.values(templates).map(x => x.sourceHash).sort();
                tmplHashes.forEach((hash) => {
                    tsHash.update(hash);
                });
                const schemaHashes = Object.values(schemas).map(x => x.hash).sort();
                schemaHashes.forEach((hash) => {
                    tsHash.update(hash);
                });

                const tsHashDigest = tsHash.digest('hex');
                const supported = (
                    Object.keys(this.supportedHashes).includes(setName)
                    && this.supportedHashes[setName].includes(tsHashDigest)
                );
                return Promise.resolve({
                    name: setName,
                    hash: tsHashDigest,
                    supported,
                    templates: Object.keys(templates).reduce((acc, curr) => {
                        const tmpl = templates[curr];
                        acc.push({
                            name: curr,
                            hash: tmpl.sourceHash,
                            description: tmpl.description,
                            title: tmpl.title
                        });
                        return acc;
                    }, []),
                    schemas: Object.keys(schemas).reduce((acc, curr) => {
                        const schema = schemas[curr];
                        acc.push({
                            name: schema.name,
                            hash: schema.hash
                        });
                        return acc;
                    }, [])
                });
            });
    }
}

/**
 * TemplateProvider that fetches templates from the file system
 */
class FsTemplateProvider extends BaseTemplateProvider {
    /**
     * @param {string} templateRootPath - a path to a directory containing template set directories
     * @param {string[]} [filteredSets[]] - only load template sets in this list (or all if list is empty)
     * @param {object} [supportedHashes={}] - an optional map of hash values to validate against
     */
    constructor(templateRootPath, filteredSets, supportedHashes) {
        super(supportedHashes);
        this.config_template_path = templateRootPath;
        this.schemaProviders = {};
        this.filteredSets = new Set(filteredSets || []);
    }

    _loadTemplate(templateName) {
        const tsName = templateName.split('/')[0];
        this._ensureSchemaaProvider(tsName);
        const schemaProvider = this.schemaProviders[tsName];
        let useMst = 0;
        let tmplpath = `${this.config_template_path}/${templateName}`;
        if (fs.existsSync(`${tmplpath}.yml`)) {
            tmplpath = `${tmplpath}.yml`;
        } else if (fs.existsSync(`${tmplpath}.yaml`)) {
            tmplpath = `${tmplpath}.yaml`;
        } else if (fs.existsSync(`${tmplpath}.mst`)) {
            useMst = 1;
            tmplpath = `${tmplpath}.mst`;
        } else {
            return Promise.reject(new Error(`could not find a template with name "${templateName}"`));
        }

        return new Promise((resolve, reject) => {
            fs.readFile(tmplpath, (err, data) => {
                if (err) reject(err);
                else {
                    resolve(data.toString('utf8'));
                }
            });
        })
            .then(tmpldata => Template[(useMst) ? 'loadMst' : 'loadYaml'](
                tmpldata, {
                    schemaProvider,
                    templateProvider: this,
                    rootDir: path.resolve(this.config_template_path, tsName)
                }
            ));
    }

    _ensureSchemaaProvider(tsName) {
        if (!this.schemaProviders[tsName]) {
            this.schemaProviders[tsName] = new FsSchemaProvider(path.resolve(
                this.config_template_path,
                tsName
            ));
        }
    }

    /**
     * Get a list of set names known to the provider
     *
     * @returns {Promise} Promise resolves to a string array
     */
    listSets() {
        return new Promise((resolve, reject) => {
            fs.readdir(this.config_template_path, (err, files) => {
                if (err) return reject(err);
                return resolve(files.filter(x => (
                    fs.lstatSync(path.join(this.config_template_path, x)).isDirectory()
                    && (this.filteredSets.size === 0 || this.filteredSets.has(x))
                )));
            });
        });
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
            .then(sets => Promise.all(sets.map(setName => new Promise((resolve, reject) => {
                fs.readdir(path.join(this.config_template_path, setName), (err, files) => {
                    if (err) return reject(err);
                    return resolve(
                        files
                            .filter(x => x.endsWith('.yml') || x.endsWith('.yaml') || x.endsWith('.mst'))
                            .map((x) => {
                                const tmplExt = x.split('.').pop();
                                let tmplName = '';
                                if (tmplExt === 'mst' || tmplExt === 'yml') {
                                    tmplName = x.slice(0, -4);
                                } else if (tmplExt === 'yaml') {
                                    tmplName = x.slice(0, -5);
                                }
                                return `${setName}/${tmplName}`;
                            })
                    );
                });
            })))).then(sets => sets.reduce((acc, curr) => acc.concat(curr), []))
            .then((sets) => {
                sets.forEach(set => this._ensureSchemaaProvider(set));
                return sets;
            });
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
            .then(() => {
                if (filteredSetName) {
                    return Promise.resolve([filteredSetName]);
                }
                return this.listSets();
            })
            .then((setList) => {
                setList.forEach(tsName => this._ensureSchemaaProvider(tsName));
                return setList;
            })
            .then(setList => Promise.all(setList.map(
                tsName => this.schemaProviders[tsName].list()
                    .then(schemaList => Promise.all(schemaList.map(
                        schemaName => this.schemaProviders[tsName].fetch(schemaName)
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
     * Create a template set package for the supplied template set ID
     *
     * @returns {Promise}
     */
    buildPackage(setName, dst) {
        const archive = new AdmZip();
        const source = `${this.config_template_path}/${setName}`;

        archive.addLocalFolder(source);
        archive.writeZip(dst);

        return Promise.resolve();
    }
}
/**
 * FsTemplateProvider specialization that for use with a single template set
 */
class FsSingleTemplateProvider extends FsTemplateProvider {
    /**
     * @param {string} templateRootPath - a path to a directory for a single template set
     * @param {object} [supportedHashes={}] - an optional map of hash values to validate against
     */
    constructor(templateRootPath, supportedHashes) {
        const templSetDir = path.resolve(templateRootPath, '..');
        const templSetName = path.basename(templateRootPath);
        super(templSetDir, [templSetName], supportedHashes);
    }
}

/**
 * TemplateProvider that fetches data from an atg-storage DataStore
 */
class DataStoreTemplateProvider extends BaseTemplateProvider {
    /**
     * @param {object} datastore - an atg-storage DataStore
     * @param {string[]} [filteredSets[]] - only load template sets in this list (or all if list is empty)
     * @param {object} [supportedHashes={}] - an optional map of hash values to validate against
     */
    constructor(datastore, filteredSets, supportedHashes) {
        super(supportedHashes);
        this.filteredSets = new Set(filteredSets || []);
        this.storage = datastore;
        this.keyCache = [];
        this._numSchema = {};
    }

    _loadTemplate(templatePath) {
        const [tsName, templateName] = templatePath.split('/');
        return this.storage.hasItem(tsName)
            .then((result) => {
                if (result) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error(`Could not find template set "${tsName}" in data store`));
            })
            .then(() => this.storage.getItem(tsName))
            .then((tsData) => {
                const templateData = tsData.templates[templateName];

                if (typeof templateData === 'undefined') {
                    return Promise.reject(new Error(`Could not find template "${templateName}" in template set "${tsName}"`));
                }
                return Template.fromJson(JSON.parse(templateData));
            })
            .then(tmpl => tmpl);
    }

    /**
     * Clear any cache associated with this provider
     */
    invalidateCache() {
        super.invalidateCache();
        this.keyCache = [];
    }

    /**
     * Get a list of set names known to the provider
     *
     * @returns {Promise} Promise resolves to a string array
     */
    listSets() {
        if (this.keyCache.length !== 0) {
            return Promise.resolve(this.keyCache);
        }

        return this.storage.keys()
            .then(keys => keys.filter(x => this.filteredSets.size === 0 || this.filteredSets.has(x)))
            .then((keys) => {
                this.keyCache = keys;
                return keys;
            });
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
            .then(templateSets => Promise.all(templateSets.map(x => this.storage.getItem(x))))
            .then((templateSets) => {
                let templates = [];
                templateSets.forEach((tsData) => {
                    if (tsData) {
                        const tmplNames = Object.keys(tsData.templates).map(tmplName => `${tsData.name}/${tmplName}`);
                        templates = templates.concat(tmplNames);
                    }
                });
                return templates;
            });
    }

    /**
     * Delete the template set associated with the supplied set ID
     *
     * @returns {Promise}
     */
    removeSet(setid) {
        return this.hasSet(setid)
            .then(result => (result || Promise.reject(
                new Error(`failed to find template set: ${setid}`)
            )))
            .then(() => this.storage.deleteItem(setid))
            .then(() => this.invalidateCache());
    }

    /**
     * Get all schema known to the provider (optionally filtered by the supplied set name)
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to an object containing schema
     */
    getSchemas(filteredSetName) {
        return Promise.resolve()
            .then(() => {
                if (filteredSetName) {
                    return Promise.resolve([filteredSetName]);
                }
                return this.listSets();
            })
            .then(setNames => Promise.all(setNames.map(x => this.storage.getItem(x))))
            .then(setData => setData.filter(x => x))
            .then(setData => setData.reduce((acc, curr) => {
                const tsName = curr.name;
                Object.keys(curr.schemas).forEach((schemaName) => {
                    const schemaData = curr.schemas[schemaName];
                    const name = `${tsName}/${schemaName}`;
                    const schemaHash = crypto.createHash('sha256');
                    schemaHash.update(schemaData);
                    acc[name] = {
                        name,
                        data: schemaData,
                        hash: schemaHash.digest('hex')
                    };
                });
                return acc;
            }, {}));
    }

    /**
     * Create a new DataStoreTemplateProvider by searching the file system for template sets
     *
     * @param {object} datastore - an atg-storage DataStore
     * @param {string} templateRootPath - a path to a directory containing template set directories
     * @param {string[]} [filteredSets[]] - only load template sets in this list (or all if list is empty)
     */
    static fromFs(datastore, templateRootPath, filteredSets) {
        filteredSets = new Set(filteredSets || []);
        const fsprovider = new FsTemplateProvider(templateRootPath, filteredSets);
        let promiseChain = Promise.resolve();

        return Promise.resolve()
            .then(() => fsprovider.listSets())
            .then(setList => Promise.all(setList.map(tsName => Promise.all([
                fsprovider.fetchSet(tsName),
                fsprovider.getSchemas(tsName)
            ])
                .then(([setTemplates, setSchemas]) => {
                    const templates = Object.entries(setTemplates).reduce((acc, curr) => {
                        const [tmplPath, tmplData] = curr;
                        const tmplName = tmplPath.split('/')[1];
                        acc[tmplName] = JSON.stringify(tmplData);
                        return acc;
                    }, {});
                    const schemas = Object.entries(setSchemas).reduce((acc, curr) => {
                        const [schemaPath, schemaData] = curr;
                        const schemaName = schemaPath.split('/')[1];
                        acc[schemaName] = schemaData.data;
                        return acc;
                    }, {});

                    const tsData = {
                        name: tsName,
                        templates,
                        schemas
                    };

                    // DataStores do not guarantee support for parallel writes
                    promiseChain = promiseChain.then(() => datastore.setItem(tsName, tsData));
                })
                .catch((e) => {
                    const tsData = {
                        name: tsName,
                        templates: {},
                        schemas: {},
                        error: e.message
                    };

                    // DataStores do not guarantee support for parallel writes
                    promiseChain = promiseChain.then(() => datastore.setItem(tsName, tsData));
                }))))
            .then(() => promiseChain);
    }
}

module.exports = {
    FsTemplateProvider,
    FsSingleTemplateProvider,
    DataStoreTemplateProvider
};
