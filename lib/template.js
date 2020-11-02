'use strict';

const crypto = require('crypto');

const Ajv = require('ajv');
const Mustache = require('mustache');
const yaml = require('js-yaml');
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const url = require('url');
const deepmerge = require('deepmerge');
const path = require('path');
const JSONPath = require('jsonpath-plus').JSONPath;
const axios = require('axios');
const mexp = require('math-expression-evaluator');

const tmplSchema = require('../schema/template.json');

// Setup validator
const validator = new Ajv();

// meta-schema uses a mustache format; just parse the string validate it
validator.addFormat('mustache', {
    type: 'string',
    validate(input) {
        try {
            Mustache.parse(input);
            return true;
        } catch (e) {
            // TODO find a better way to report issues here
            console.log(e); /* eslint-disable-line no-console */
            return false;
        }
    }
});
const _validateSchema = validator.compile(tmplSchema);

function nodeHttpToAxios(configObj) {
    if (configObj.host || configObj.path) {
        configObj.protocol = configObj.protocol || 'http';
        configObj.pathname = configObj.pathname || configObj.path;
        configObj.url = url.format(configObj);

        delete configObj.host;
        delete configObj.path;
        delete configObj.port;
        delete configObj.protocol;
        delete configObj.hostname;
        delete configObj.pathname;
    }

    if (configObj.auth && typeof configObj.auth === 'string') {
        const [username, password] = configObj.auth.split(':');
        configObj.auth = {
            username,
            password
        };
    }
}

/**
 * TransformStrategy for JSON output
 */
function JsonTransformStrategy(schema, value) {
    if (schema.type === 'array') {
        if (!value) {
            return JSON.stringify([]);
        }
        if (value.length && value.length > 0 && !schema.skip_xform) {
            return JSON.stringify(value);
        }
    }

    if (schema.type === 'object') {
        if (!value) {
            return JSON.stringify({});
        }
        return JSON.stringify(value);
    }

    if (schema.format === 'text' && value) {
        return JSON.stringify(value);
    }

    return value;
}


/**
 * MergeStrategy for targeting `test/plain` Content-Type
 */
function PlainTextMergeStrategy(acc, curr) {
    return `${acc}\n${curr}`;
}

/**
 * MergeStrategy for targeting `application/json` Content-Type
 */
function JsonMergeStrategy(acc, curr) {
    return JSON.stringify(deepmerge(
        yaml.safeLoad(acc),
        yaml.safeLoad(curr)
    ), null, 2);
}

/**
 * MergeStrategy for targeting `application/yaml` Content-Type
 */
function YamlMergeStrategy(acc, curr) {
    return yaml.safeDump(deepmerge(
        yaml.safeLoad(acc),
        yaml.safeLoad(curr)
    ));
}

/**
 * Object containing available merge strategy functions.
 * The property is a Content-Type MIME (e.g., `test/plain`).
 * The value is a MergeStrategy function that accepts an accumulated result and current value.
 */
const mergeStrategies = {
    'application/json': JsonMergeStrategy,
    'application/x-yaml': YamlMergeStrategy,
    'application/yaml': YamlMergeStrategy,
    'text/x-yaml': YamlMergeStrategy
};

/**
 * PostProcessStrategy for targeting `application/json` Content-Type
 */
function JsonPostProcessStrategy(rendered) {
    return JSON.stringify(yaml.safeLoad(rendered), null, 2);
}

/**
 * PostProcessStrategy for targeting `application/yaml` Content-Type
 */
function YamlPostProcessStrategy(rendered) {
    return yaml.safeDump(yaml.safeLoad(rendered));
}

/**
 * Object containing available post-processing strategy functions.
 * The property is a Content-Type MIME (e.g., `test/plain`).
 * The value is a PostProcessStrategy function that accepts rendered output.
 */
const postProcessStrategies = {
    'application/json': JsonPostProcessStrategy,
    'application/x-yaml': YamlPostProcessStrategy,
    'application/yaml': YamlPostProcessStrategy,
    'text/x-yaml': YamlPostProcessStrategy
};

// Disable HTML escaping
Mustache.escape = function escape(text) {
    return text;
};


const keyInXOf = (key, schema) => {
    let found = false;
    ['oneOf', 'allOf', 'anyOf'].forEach((xOf) => {
        if (!schema[xOf]) {
            return;
        }
        schema[xOf].forEach((subSchema) => {
            if (subSchema.properties && subSchema.properties[key] !== undefined) {
                found = true;
                return;
            }
            found = keyInXOf(key, subSchema) || found;
        });
    });

    return found;
};

/**
 * The main class for loading, manipulating, and rendering templates.
 *
 * @example
 * const ymldata = `
 *   template: |
 *     {{var}}
 * `;
 * const tmpl = Template.loadYaml(ymldata);
 * console.log(tmpl.render({ var: 'Hello World' }));
 */
class Template {
    constructor() {
        this.title = '';
        this.description = '';
        this.definitions = {};
        this.typeDefinitions = {};
        this._parametersSchema = {};
        this.target = 'as3';
        this.templateText = '';
        this.defaultParameters = {};
        this.sourceType = 'UNKNOWN';
        this.sourceText = '';
        this.sourceHash = '';
        this._parametersValidator = undefined;
        this._oneOf = [];
        this._allOf = [];
        this._anyOf = [];
        this.contentType = 'text/plain';
        this.httpForward = null;
    }

    _loadTypeSchemas(schemaProvider) {
        if (!schemaProvider) {
            return Promise.resolve({});
        }

        return schemaProvider.list()
            .then(schemaList => Promise.all(
                schemaList.map(x => Promise.all([Promise.resolve(x), schemaProvider.fetch(x)]))
            ))
            .then(schemas => schemas.reduce((acc, curr) => {
                const [schemaName, schema] = curr;
                acc[schemaName] = JSON.parse(schema);
                return acc;
            }, {}));
    }

    _descriptionFromTemplate() {
        const tokens = Mustache.parse(this.templateText);
        const comments = tokens.filter(x => x[0] === '!');
        if (comments.length > 0) {
            this.description = comments[0][1];
        }
    }

    _mergeSchemaInto(dst, src, dstDeps) {
        // Properties
        if (src.properties) {
            // Filter out properties we do not want to overwrite
            src.properties = Object.keys(src.properties).reduce((filtered, prop) => {
                const propDef = src.properties[prop];
                const noOverwrite = (
                    dst.properties && dst.properties[prop] && dst.properties[prop].type
                    && (dst.properties[prop].type === 'array' || dst.properties[prop].type === 'string')
                    && propDef.type && propDef.type === 'boolean'
                );
                if (!noOverwrite) {
                    filtered[prop] = propDef;
                }
                return filtered;
            }, {});

            // Merge properties
            Object.assign(dst.properties, src.properties);

            // Merge dependencies
            Object.keys(src.dependencies || []).forEach((dep) => {
                if (typeof dstDeps[dep] === 'undefined') {
                    dstDeps[dep] = src.dependencies[dep];
                } else {
                    dstDeps[dep] = dstDeps[dep].concat(src.dependencies[dep]);
                }
            });
        }
    }

    _handleParsed(parsed, typeSchemas) {
        const primitives = {
            boolean: false,
            object: {},
            number: 0,
            string: '',
            integer: 0,
            array: [],
            text: '',
            hidden: ''
        };

        const required = new Set();
        const dependencies = {};
        const knownPartials = this._getPartials();
        const schema = parsed.reduce((acc, curr) => {
            const [mstType, mstName] = [curr[0], curr[1]];
            const [defName, schemaName, type] = mstName.split(':');

            if (['name', '#', '>', '^'].includes(mstType)) {
                if (schemaName && typeof typeSchemas[schemaName] === 'undefined') {
                    throw new Error(`Failed to find the specified schema: ${schemaName} (${mstType}, ${mstName})`);
                }

                if (schemaName) {
                    const schemaDef = typeSchemas[schemaName].definitions[type];
                    if (!schemaDef) {
                        throw new Error(`No definition for ${type} in ${schemaName} schema`);
                    }
                    this.definitions[type] = Object.assign({}, schemaDef, this.definitions[type]);
                    Object.assign(this.typeDefinitions, typeSchemas[schemaName].definitions);
                }
            }

            switch (mstType) {
            case 'name': {
                const defType = type || 'string';
                if (!schemaName && typeof primitives[defType] === 'undefined') {
                    throw new Error(`No schema definition for ${schemaName}/${defType}`);
                }

                if (schemaName) {
                    const schemaDef = typeSchemas[schemaName].definitions[defType];
                    acc.properties[defName] = Object.assign({}, schemaDef);
                } else {
                    if (defType === 'text') {
                        acc.properties[defName] = {
                            type: 'string',
                            format: 'text'
                        };
                    } else if (defType === 'array') {
                        acc.properties[defName] = {
                            type: defType,
                            items: {
                                type: 'string'
                            }
                        };
                    } else if (defType === 'hidden') {
                        acc.properties[defName] = {
                            type: 'string',
                            format: 'hidden'
                        };
                    } else {
                        acc.properties[defName] = {
                            type: defType
                        };
                    }

                    const propType = acc.properties[defName].type;
                    if (!this.definitions[defName] && typeof primitives[propType] !== 'undefined') {
                        acc.properties[defName].default = primitives[propType];
                    }
                }
                if (this.definitions[defName]) {
                    Object.assign(acc.properties[defName], this.definitions[defName]);
                }
                const propDef = acc.properties[defName];
                if (propDef.format !== 'hidden' && propDef.format !== 'info' && !propDef.mathExpression) {
                    required.add(defName);
                }
                if (propDef.format === 'info' && !propDef.const) {
                    propDef.const = '';
                }

                if (propDef.mathExpression) {
                    if (!propDef.format) {
                        propDef.format = 'hidden';
                    }
                    Object.entries(this.typeDefinitions).forEach(([key, defProp]) => {
                        if (!acc.properties[key] && propDef.mathExpression.includes(key)) {
                            acc.properties[key] = Object.assign({}, defProp);
                            required.add(key);
                        }
                    });
                }
                break;
            }
            case '>': {
                if (!knownPartials[defName]) {
                    throw new Error(`${defName} does not reference a known partial`);
                }
                const partial = this.typeDefinitions[defName];
                this._mergeSchemaInto(acc, partial, dependencies);
                if (partial.required) {
                    partial.required.forEach(x => required.add(x));
                }
                if (partial.dependencies) {
                    Object.keys(partial.dependencies).forEach((prop) => {
                        dependencies[prop] = partial.dependencies[prop];
                    });
                }
                break;
            }
            case '#': {
                const items = this._handleParsed(curr[4], typeSchemas);
                const schemaDef = Object.assign(
                    this.typeDefinitions[type] || {},
                    this.definitions[defName] || {}
                );
                const defType = schemaDef.type || 'array';
                const newDef = Object.assign({ type: defType }, schemaDef);
                const asBool = defType === 'boolean' || defType === 'string';
                if (defType === 'array') {
                    newDef.skip_xform = true;
                    newDef.items = Object.assign({}, items, newDef.items);
                } else if (defType === 'object') {
                    Object.assign(newDef, items);
                } else if (!asBool) {
                    throw new Error(`unsupported type for section "${defName}": ${defType}`);
                }

                if (items.properties) {
                    Object.keys(items.properties).forEach((item) => {
                        if (!dependencies[item]) {
                            dependencies[item] = [];
                        }
                        dependencies[item].push(defName);
                    });
                }

                if (asBool) {
                    // Hoist properties to global scope
                    this._mergeSchemaInto(acc, items, dependencies);
                    if (typeof newDef.default === 'undefined') {
                        newDef.default = primitives[newDef.type];
                    }
                }

                acc.properties[defName] = Object.assign({}, newDef);
                required.add(defName);

                break;
            }
            case '^': {
                const items = this._handleParsed(curr[4], typeSchemas);
                const schemaDef = Object.assign(
                    this.typeDefinitions[type] || {},
                    this.definitions[defName] || {}
                );

                if (!acc.properties[defName]) {
                    acc.properties[defName] = Object.assign({
                        type: 'boolean',
                        default: primitives.boolean
                    },
                    schemaDef);
                }
                if (items.properties) {
                    Object.keys(items.properties).forEach((item) => {
                        if (!dependencies[item]) {
                            dependencies[item] = [];
                        }
                        dependencies[item].push(defName);
                        if (!items.properties[item].invertDependency) {
                            items.properties[item].invertDependency = [];
                        }
                        items.properties[item].invertDependency.push(defName);
                    });
                }

                // If an inverted section is present, the section variable is not required
                required.delete(defName);

                if (this.definitions[defName]) {
                    Object.assign(acc.properties[defName], this.definitions[defName]);
                }
                this._mergeSchemaInto(acc, items, dependencies);
                break;
            }
            case '!':
            case 'text':
                // skip
                break;
            default:
                // console.log(`skipping ${defName} with type of ${mstType}`);
            }
            return acc;
        }, {
            type: 'object',
            properties: {}
        });
        if (schema.properties['.'] && Object.keys(schema.properties).length === 1) {
            return {
                type: 'string'
            };
        }
        if (Object.keys(schema.properties).length < 1) {
            return {
                type: 'string',
                default: primitives.string
            };
        }

        // Get propertyOrder from definition if available
        Object.values(schema.properties).forEach((schemaDef) => {
            schemaDef.propertyOrder = 1000;
        });
        Object.keys(this.definitions).forEach((prop, idx) => {
            const schemaDef = schema.properties[prop];
            if (!schemaDef) {
                return;
            }
            schemaDef.propertyOrder = idx;
        });

        // Re-sort properties based on propertyOrder
        schema.properties = Object.entries(schema.properties)
            .map(([key, def]) => Object.assign({ name: key }, def))
            .sort((a, b) => a.propertyOrder - b.propertyOrder)
            .reduce((acc, curr) => {
                acc[curr.name] = curr;
                delete curr.name;
                delete curr.propertyOrder;
                return acc;
            }, {});

        // Remove any required items from dependencies
        required.forEach((value) => {
            delete dependencies[value];
        });

        // Add required and dependencies to the schema
        schema.required = Array.from(required);
        if (dependencies && Object.keys(dependencies).length > 0) {
            schema.dependencies = dependencies;
        }

        return schema;
    }

    _parametersSchemaFromTemplate(typeSchemas) {
        let mergedDefs = {};
        ['oneOf', 'allOf', 'anyOf'].forEach((xOf) => {
            this[`_${xOf}`].forEach((tmpl) => {
                mergedDefs = deepmerge(
                    mergedDefs,
                    tmpl.definitions
                );
            });
        });
        this.definition = deepmerge(
            mergedDefs,
            this.definitions
        );
        Object.entries(this.definitions).forEach(([name, def]) => {
            if (def.template) {
                const newDef = this._handleParsed(
                    Mustache.parse(def.template), typeSchemas
                );
                delete newDef.template;
                this.typeDefinitions[name] = newDef;
            } else {
                this.typeDefinitions[name] = JSON.parse(JSON.stringify(def));
            }
        });
        this._parametersSchema = this._handleParsed(Mustache.parse(this.templateText), typeSchemas);

        // If we just ended up with an empty string type, then we have no types and we
        // should return an empty object instead.
        if (this._parametersSchema.type === 'string' && !this._parametersSchema.properties) {
            this._parametersSchema.type = 'object';
        }
    }

    _recordSource(sourceType, sourceText) {
        const hash = crypto.createHash('sha256');
        hash.update(sourceText);

        this.sourceType = sourceType;
        this.sourceText = sourceText;
        this.sourceHash = hash.digest('hex');
    }

    _createParametersValidator() {
        const loadSchema = (uri) => {
            axios.get(uri)
                .then(res => res.data);
        };
        const ajv = new Ajv({
            loadSchema,
            unknownFormats: 'ignore'
        });
        ajv.addFormat('text', /.*/);
        ajv.addFormat('hidden', /.*/);
        ajv.addFormat('password', /.*/);
        ajv.addFormat('info', /.*/);
        return ajv.compileAsync(this.getParametersSchema())
            .then((validate) => {
                this._parametersValidator = validate;
                return Promise.resolve();
            })
            .catch(e => Promise.reject(new Error(
                'Failed to compile parameter validator\n'
                + `schema:\n${JSON.stringify(this.getParametersSchema(), null, 2)}\n`
                + `compile error:\n${e.message}`
            )));
    }

    /**
     * Create a `Template` instance for the supplied Mustache text
     *
     * @param {string} msttext - Mustache text to parse and create a `Template` from
     * @param {SchemaProvider} [schemaProvider] - SchemaProvider to use to fetch schema referenced by the template
     *
     * @returns {Promise} Promise resolves to `Template`
     */
    static loadMst(msttext, schemaProvider) {
        this.validate(msttext);
        const tmpl = new this();
        tmpl._recordSource('MST', msttext);
        tmpl.templateText = msttext;
        return tmpl._loadTypeSchemas(schemaProvider)
            .then((typeSchemas) => {
                tmpl._descriptionFromTemplate();
                tmpl._parametersSchemaFromTemplate(typeSchemas);
            })
            .then(() => tmpl._createParametersValidator())
            .then(() => tmpl);
    }

    /**
     * Create a `Template` instance for the supplied YAML text
     *
     * @param {string} yamltext - YAML text to parse and create a `Template` from
     * @param {SchemaProvider} [schemaProvider] - SchemaProvider to use to fetch schema referenced by the template
     * @param {string} [filePath]
     * @param {string} [rootDir]
     *
     * @returns {Promise} Promise resolves to `Template`
     */
    static loadYaml(yamltext, schemaProvider, filePath, rootDir) {
        this.validate(yamltext);
        const tmpl = new this();
        const yamldata = yaml.safeLoad(yamltext);
        tmpl._recordSource('YAML', yamltext);

        Object.assign(tmpl, yamldata);
        tmpl.templateText = tmpl.template || tmpl.templateText;
        delete tmpl.template;
        tmpl.defaultParameters = tmpl.parameters || tmpl.defaultParameters;
        delete tmpl.parameters;
        delete tmpl.anyOf;
        delete tmpl.oneOf;
        delete tmpl.anyOf;

        const oneOf = yamldata.oneOf || [];
        const allOf = yamldata.allOf || [];
        const anyOf = yamldata.anyOf || [];

        const refParserOpts = {
            resolve: {
                http: false
            },
            dereference: {
                circular: false
            }
        };
        const refParserArgs = [yamldata, refParserOpts];
        if (filePath) {
            refParserArgs.unshift(filePath);
        }

        return Promise.resolve()
            .then(() => Promise.resolve()
                .then(() => {
                    if (rootDir) {
                        return $RefParser.resolve(...refParserArgs)
                            .then(refs => refs.paths());
                    }
                    return Promise.resolve([]);
                })
                .then((refs) => {
                    refs.forEach((ref) => {
                        if (path.relative(rootDir, ref).startsWith('..')) {
                            throw new Error(
                                `Found ref to path outside of the template set: ${ref}`
                            );
                        }
                    });
                })
                .then(() => $RefParser.bundle(...refParserArgs))
                .catch(e => Promise.reject(new Error(
                    `Parsing references failed:\n${e.stack}`
                ))))
            .then(() => Promise.all(oneOf.map(x => Template.loadYaml(JSON.stringify(x), schemaProvider))))
            .then((tmplList) => {
                tmpl._oneOf = tmplList;
            })
            .then(() => Promise.all(allOf.map(x => Template.loadYaml(JSON.stringify(x), schemaProvider))))
            .then((tmplList) => {
                tmpl._allOf = tmplList;
            })
            .then(() => Promise.all(anyOf.map(x => Template.loadYaml(JSON.stringify(x), schemaProvider))))
            .then((tmplList) => {
                tmpl._anyOf = tmplList;
            })
            .then(() => tmpl._loadTypeSchemas(schemaProvider))
            .then((typeSchemas) => {
                tmpl._parametersSchemaFromTemplate(typeSchemas);
            })
            .then(() => tmpl._createParametersValidator())
            .then(() => tmpl);
    }

    /**
     * Create a `Template` instance from JSON data
     *
     * @param {object|string} obj - The JSON data to create a `Template` from
     *
     * @returns {Promise} Promise resolves to `Template`
     */
    static fromJson(obj) {
        if (typeof obj === 'string') {
            obj = JSON.parse(obj);
        }
        const tmpl = new this();
        Object.assign(tmpl, obj);
        return Promise.resolve()
            .then(() => Promise.all(tmpl._oneOf.map(x => Template.fromJson(x))))
            .then((tmplList) => {
                tmpl._oneOf = tmplList;
            })
            .then(() => Promise.all(tmpl._allOf.map(x => Template.fromJson(x))))
            .then((tmplList) => {
                tmpl._allOf = tmplList;
            })
            .then(() => Promise.all(tmpl._anyOf.map(x => Template.fromJson(x))))
            .then((tmplList) => {
                tmpl._anyOf = tmplList;
            })
            .then(() => tmpl._createParametersValidator())
            .then(() => tmpl);
    }

    /**
     * Check if the supplied template data is a valid template
     *
     * @returns {boolean}
     */
    static isValid(tmpldata) {
        return _validateSchema(tmpldata);
    }

    /**
     * Get any template validation errors from previous `isValid()` or `validate()` calls
     *
     * @returns {string}
     */
    static getValidationErrors() {
        return JSON.stringify(_validateSchema.errors, null, 2);
    }

    /**
     * Check if the supplied template data is a valid template
     *
     * @throws Will throw an error if the template data is not valid
     */
    static validate(tmpldata) {
        if (!this.isValid(tmpldata)) {
            throw new Error(this.getValidationErrors());
        }
    }

    /**
     * Get JSON schema for the template parameters
     */
    getParametersSchema() {
        const schema = Object.assign({}, this._parametersSchema, {
            title: this.title,
            description: this.description,
            definitions: this.typeDefinitions
        });

        ['oneOf', 'allOf', 'anyOf'].forEach((xOf) => {
            const prop = `_${xOf}`;
            if (this[prop].length > 0) {
                schema[xOf] = this[prop].map(x => x.getParametersSchema());
            }
        });

        Object.entries(this.definitions).forEach(([name, def]) => {
            if (!schema.properties[name] && keyInXOf(name, schema)) {
                schema.properties[name] = Object.assign({}, def);
            }
        });

        return schema;
    }

    /**
     * Merge default parameters values with the supplied parameters object and return the result
     *
     * @param {object} parameters
     */
    getCombinedParameters(parameters) {
        const typeProps = this.getParametersSchema().properties;
        const typeDefaults = typeProps && Object.keys(typeProps).reduce((acc, key) => {
            const value = typeProps[key];
            if (value.default !== undefined) {
                acc[key] = value.default;
            }
            return acc;
        }, {});
        let mergedDefaults = {};
        ['oneOf', 'allOf', 'anyOf'].forEach((xOf) => {
            this[`_${xOf}`].forEach((tmpl) => {
                mergedDefaults = deepmerge(
                    mergedDefaults,
                    tmpl.getCombinedParameters(parameters)
                );
            });
        });

        const defaults = Object.assign(
            {},
            mergedDefaults,
            typeDefaults || {},
            this.defaultParameters,
            parameters || {}
        );
        const mathExprTokens = Object.keys(this.typeDefinitions).map(key => ({
            type: 3,
            token: key,
            show: key,
            value: key
        }));
        const mathExprPairs = Object.assign({}, defaults);
        const mathExprResults = typeProps && Object.keys(typeProps).reduce((acc, key) => {
            const value = typeProps[key];
            if (value.mathExpression) {
                let result = mexp.eval(value.mathExpression, mathExprTokens, mathExprPairs);
                if (value.type === 'string') {
                    result = result.toString();
                }
                acc[key] = result;
            }
            return acc;
        }, {});

        return Object.assign(defaults, mathExprResults);
    }

    _getPartials() {
        return Object.keys(this.definitions).reduce((acc, curr) => {
            const def = this.definitions[curr];
            const templateText = def.template;
            if (templateText) {
                acc[curr] = this._cleanTemplateText(templateText);
            }
            return acc;
        }, {});
    }

    /**
     * Validate the supplied parameters object against the template's parameter schema
     *
     * @param {object} parameters
     */
    validateParameters(parameters) {
        const combParams = this.getCombinedParameters(parameters);
        if (!this._parametersValidator(combParams)) {
            const errstr = ''
                + 'Parameters failed validation:\n'
                + `${JSON.stringify(parameters, null, 2)}\n\n`
                + 'Validation error:\n'
                + `${JSON.stringify(this._parametersValidator.errors, null, 2)}`;
            throw new Error(errstr);
        }
    }

    /**
     * @ignore
     */
    transformParameters(parameters) {
        const schema = this.getParametersSchema();
        const transform = JsonTransformStrategy;
        return Object.keys(parameters).reduce((acc, curr) => {
            const value = parameters[curr];
            const valueSchema = schema.properties && schema.properties[curr];

            if (valueSchema) {
                acc[curr] = transform(valueSchema, value);
            } else {
                // Skip transform if we do not have schema
                acc[curr] = value;
            }
            return acc;
        }, {});
    }

    _cleanTemplateText(text) {
        return text.replace(/{{([_a-zA-Z0-9#^>/]+):.*?}}/g, '{{$1}}');
    }

    /**
     * Render the template using the supplied parameters object
     *
     * @param {object} parameters
     *
     * @returns {string} rendered result
     */
    render(parameters) {
        this.validateParameters(parameters);
        const xfparams = this.transformParameters(this.getCombinedParameters(parameters));
        const partials = this._getPartials();
        const templateText = this._cleanTemplateText(this.templateText || '');
        const mergeStrategy = mergeStrategies[this.contentType] || PlainTextMergeStrategy;
        const templateTexts = [];

        this._allOf.forEach((tmpl) => {
            templateTexts.push(tmpl.render(xfparams));
        });
        this._anyOf.forEach((tmpl) => {
            try {
                templateTexts.push(tmpl.render(xfparams));
            } catch (e) {
                if (!e.message.match(/failed validation/)) {
                    throw e;
                }
            }
        });
        this._oneOf.forEach((tmpl) => {
            try {
                templateTexts.push(tmpl.render(xfparams));
            } catch (e) {
                if (!e.message.match(/failed validation/)) {
                    throw e;
                }
            }
        });

        templateTexts.push(Mustache.render(templateText, xfparams, partials));

        const rendered = templateTexts.reduce((acc, curr) => {
            if (curr.length === 0) {
                return acc;
            }

            if (acc.length === 0) {
                return curr;
            }

            acc = mergeStrategy(acc, curr);
            return acc;
        });

        const postProcessStrategy = postProcessStrategies[this.contentType];
        if (postProcessStrategy) {
            return postProcessStrategy(rendered);
        }

        return rendered;
    }

    /**
     * Fetch data using an HTTP request for properties that specify a URL
     *
     * @returns {object} parameters
     */
    fetchHttp() {
        const promises = [];
        const view = {};
        Object.entries(this.definitions).forEach(([def, defProp]) => {
            if (!defProp.url) {
                return;
            }

            const axiosConfig = {};

            if (typeof defProp.url === 'string') {
                axiosConfig.url = defProp.url;
            } else {
                Object.assign(axiosConfig, defProp.url);
                nodeHttpToAxios(axiosConfig);
            }

            promises.push(Promise.resolve()
                .then(() => axios(axiosConfig))
                .then((res) => {
                    try {
                        view[def] = JSON.parse(res.data);
                    } catch (e) {
                        view[def] = res.data;
                    }
                    if (defProp.pathQuery) {
                        const results = JSONPath(defProp.pathQuery, view[def]);
                        view[def] = results[0];
                    }
                    return Promise.resolve();
                })
                .catch(e => Promise.reject(
                    new Error(`error loading ${axiosConfig.url}:\n${e}`)
                )));
        });
        return Promise.all(promises)
            .then(() => view);
    }

    /**
     * Run fetchHttp() and combine the results with the supplied parameters object to pass to render()
     *
     * @param {object} parameters
     *
     * @returns {string} rendered result
     */
    fetchAndRender(parameters) {
        return Promise.resolve()
            .then(() => this.fetchHttp())
            .then(httpView => Object.assign({}, parameters, httpView))
            .then(combParams => this.render(combParams));
    }

    /**
     * Render the template using the supplied parameters object and forward the results based on `httpForward` property
     *
     * Also run fetchHttp().
     *
     * @param {object} parameters
     *
     * @returns {Promise} Promise resolves to HTTP response results
     */
    forwardHttp(parameters) {
        if (!this.httpForward) {
            return Promise.reject(
                new Error('httpForward was not defined for this template')
            );
        }

        const axiosConfig = {
            method: 'POST',
            headers: {
                'Content-Type': this.contentType
            }
        };

        if (typeof this.httpForward.url === 'string') {
            axiosConfig.url = this.httpForward.url;
        } else {
            Object.assign(axiosConfig, this.httpForward.url);
            nodeHttpToAxios(axiosConfig);
        }

        return Promise.resolve()
            .then(() => this.fetchAndRender(parameters))
            .then(() => axios(axiosConfig))
            .catch(e => Promise.reject(
                new Error(`error forwarding to ${axiosConfig.url}: ${e}`)
            ));
    }
}

module.exports = {
    Template,
    mergeStrategies
};
