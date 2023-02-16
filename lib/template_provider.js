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
const { stripExtension } = require('./utils');
const { FsDataProvider } = require('./data_provider');

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
            'getSchemas',
            'getDataFiles'
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
            this.getSchemas(setName),
            this.getDataFiles(setName)
        ])
            .then(([templates, schemas, dataFiles]) => {
                const tsHash = crypto.createHash('sha256');
                const tmplHashes = Object.values(templates).map(x => x.sourceHash).sort();
                tmplHashes.forEach((hash) => {
                    tsHash.update(hash);
                });
                const schemaHashes = Object.values(schemas).map(x => x.hash).sort();
                schemaHashes.forEach((hash) => {
                    tsHash.update(hash);
                });
                const dataHashes = Object.values(dataFiles).map(x => x.hash).sort();
                dataHashes.forEach((hash) => {
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
                    }, []),
                    dataFiles: Object.keys(dataFiles).reduce((acc, curr) => {
                        const data = dataFiles[curr];
                        acc.push({
                            name: data.name,
                            hash: data.hash
                        });
                        return acc;
                    }, [])
                });
            });
    }

    /**
     * Determine if the provided file name has a supported template file extension
     *
     * @param {string} fileName - the file name to check
     * @returns {boolean}
     */
    hasTemplateExtension(fileName) {
        return fileName.endsWith('.yml')
            || fileName.endsWith('.yaml')
            || fileName.endsWith('.mst');
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
        this.dataProviders = {};
        this.filteredSets = new Set(filteredSets || []);
    }

    _loadTemplate(templateName) {
        const tsName = templateName.split('/')[0];
        this._ensureSchemaProvider(tsName);
        this._ensureDataProvider(tsName);
        const schemaProvider = this.schemaProviders[tsName];
        const dataProvider = this.dataProviders[tsName];
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
            .then(tmpldata => Template[(useMst) ? 'loadMst' : 'loadYaml'](tmpldata, {
                schemaProvider,
                dataProvider,
                templateProvider: this,
                rootDir: path.resolve(this.config_template_path, tsName)
            }));
    }

    _ensureSchemaProvider(tsName) {
        if (!this.schemaProviders[tsName]) {
            this.schemaProviders[tsName] = new FsSchemaProvider(path.resolve(
                this.config_template_path,
                tsName
            ));
        }
    }

    _ensureDataProvider(tsName) {
        if (!this.dataProviders[tsName]) {
            this.dataProviders[tsName] = new FsDataProvider(path.resolve(
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
                            .filter(x => this.hasTemplateExtension(x))
                            .map(x => `${setName}/${stripExtension(x)}`)
                    );
                });
            })))).then(sets => sets.reduce((acc, curr) => acc.concat(curr), []))
            .then((sets) => {
                sets.forEach(set => this._ensureSchemaProvider(set));
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
                setList.forEach(tsName => this._ensureSchemaProvider(tsName));
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
     * Get all data files known to the provider (optionally filtered by the supplied set name)
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to an object containing data files
     */
    getDataFiles(filteredSetName) {
        const dataFiles = {};
        return Promise.resolve()
            .then(() => {
                if (filteredSetName) {
                    return Promise.resolve([filteredSetName]);
                }
                return this.listSets();
            })
            .then((setList) => {
                setList.forEach(tsName => this._ensureDataProvider(tsName));
                return setList;
            })
            .then(setList => Promise.all(setList.map(
                tsName => this.dataProviders[tsName].list()
                    .then(dataList => Promise.all(dataList.map(
                        dataName => this.dataProviders[tsName].fetch(dataName)
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
     * Get all data files known to the provider (optionally filtered by the supplied set name)
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to an object containing data files
     */
    getDataFiles(filteredSetName) {
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
                Object.keys(curr.dataFiles || []).forEach((dataName) => {
                    const dataFile = curr.dataFiles[dataName];
                    const name = `${tsName}/${dataName}`;
                    const dataHash = crypto.createHash('sha256');
                    dataHash.update(dataFile);
                    acc[name] = {
                        name,
                        data: dataFile,
                        hash: dataHash.digest('hex')
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
                fsprovider.getSchemas(tsName),
                fsprovider.getDataFiles(tsName)
            ])
                .then(([setTemplates, setSchemas, setDataFiles]) => {
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
                    const dataFiles = Object.entries(setDataFiles).reduce((acc, curr) => {
                        const [dataPath, data] = curr;
                        const dataName = dataPath.split('/')[1];
                        acc[dataName] = data.data;
                        return acc;
                    }, {});

                    const tsData = {
                        name: tsName,
                        templates,
                        schemas,
                        dataFiles
                    };

                    // DataStores do not guarantee support for parallel writes
                    promiseChain = promiseChain.then(() => datastore.setItem(tsName, tsData));
                })
                .catch((e) => {
                    const tsData = {
                        name: tsName,
                        templates: {},
                        schemas: {},
                        dataFiles: {},
                        error: e.message
                    };

                    // DataStores do not guarantee support for parallel writes
                    promiseChain = promiseChain.then(() => datastore.setItem(tsName, tsData));
                }))))
            .then(() => promiseChain);
    }
}

/**
 * TemplateProvider that aggregates multiple template providers
 */
class CompositeTemplateProvider extends BaseTemplateProvider {
    /**
     * @param {BaseTemplateProvider[]} providers - an array of template providers
     * @param {object} [supportedHashes={}] - an optional map of hash values to validate against
     */
    constructor(providers, supportedHashes) {
        super(supportedHashes);
        this.providers = providers;
    }

    _getProviderForSet(setName) {
        return Promise.resolve()
            .then(() => Promise.all(
                this.providers.map(provider => Promise.all([
                    Promise.resolve(provider),
                    provider.hasSet(setName)
                ]))
            ))
            .then(providerList => providerList
                .filter(x => x[1])
                .map(x => x[0]))
            .then((providers) => {
                if (providers.length === 0) {
                    return Promise.reject(new Error(
                        `Could not find template set "${setName}"`
                    ));
                }

                return Promise.resolve(providers[0]);
            });
    }

    _getProviderForTemplate(templatePath) {
        const setName = templatePath.split('/')[0];
        return this._getProviderForSet(setName);
    }

    _getSetProviderPairs(setListOrName) {
        const initSetList = (typeof setListOrName === 'string') ? [setListOrName] : (setListOrName || []);

        return Promise.resolve()
            .then(() => (initSetList.length > 0 ? Promise.resolve(initSetList) : this.listSets()))
            .then(setList => Promise.all(
                setList.map(
                    setName => this._getProviderForSet(setName)
                        .then(provider => [setName, provider])
                )
            ));
    }

    _loadTemplate(templateName) {
        return Promise.resolve()
            .then(() => this._getProviderForTemplate(templateName))
            .then(provider => provider.fetch(templateName));
    }

    /**
     * Delete the template set associated with the supplied set ID
     *
     * @returns {Promise}
     */
    removeSet(setid) {
        return this._getProviderForSet(setid)
            .then(provider => provider.removeSet(setid));
    }

    /**
     * Get a list of set names known to the provider
     *
     * @returns {Promise} Promise resolves to a string array
     */
    listSets() {
        return Promise.all(
            this.providers.map(provider => provider.listSets())
        )
            .then(setLists => [...new Set(setLists.flat())]);
    }

    /**
     * List all templates known to the provider (optionally filtered by the supplied list of set names)
     *
     * @param {string[]} [setList=[]]
     * @returns {Promise} Promise resolves to a string array
     */
    list(setList) {
        return this._getSetProviderPairs(setList)
            .then(pairs => Promise.all(pairs.map(([setName, provider]) => provider.list(setName))))
            .then(setLists => setLists.flat());
    }

    /**
     * Get all schema known to the provider (optionally filtered by the supplied set name)
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to an object containing schema
     */
    getSchemas(filteredSetName) {
        return this._getSetProviderPairs(filteredSetName)
            .then(pairs => Promise.all(pairs.map(([setName, provider]) => provider.getSchemas(setName))))
            .then(data => Object.assign({}, ...data));
    }

    /**
     * Get all data files known to the provider (optionally filtered by the supplied set name)
     *
     * @param {string} [filteredSetName] - only return data for this template set (instead of all template sets)
     * @returns {Promise} Promise resolves to an object containing data files
     */
    getDataFiles(filteredSetName) {
        return this._getSetProviderPairs(filteredSetName)
            .then(pairs => Promise.all(pairs.map(([setName, provider]) => provider.getDataFiles(setName))))
            .then(data => Object.assign({}, ...data));
    }

    /**
     * Clear any cache associated with this provider
     */
    invalidateCache() {
        super.invalidateCache();
        this.providers.forEach(provider => provider.invalidateCache());
    }
}

module.exports = {
    BaseTemplateProvider,
    FsTemplateProvider,
    FsSingleTemplateProvider,
    DataStoreTemplateProvider,
    CompositeTemplateProvider
};
