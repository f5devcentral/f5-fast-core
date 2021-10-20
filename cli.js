#!/usr/bin/env node

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

/* eslint-disable no-console */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const Template = require('./lib/template').Template;
const FsTemplateProvider = require('./lib/template_provider').FsTemplateProvider;
const guiUtils = require('./lib/gui_utils');

const loadTemplate = (templatePath) => {
    const tmplName = path.basename(templatePath, path.extname(templatePath));
    const tsName = path.basename(path.dirname(templatePath));
    const tsDir = path.dirname(path.dirname(templatePath));
    const provider = new FsTemplateProvider(tsDir, [tsName]);
    return provider.fetch(`${tsName}/${tmplName}`)
        .catch((e) => {
            const validationErrors = Template.getValidationErrors();
            if (validationErrors !== 'null') {
                console.error(validationErrors);
            }
            console.error(`failed to load template\n${e.stack}`);
            process.exit(1);
        });
};

const loadParameters = (parametersPath) => {
    if (!parametersPath) return Promise.resolve({});
    return fs.readFile(parametersPath, 'utf8')
        .then(paramsData => yaml.load(paramsData))
        .catch((e) => {
            console.error(`Failed to load the parameters file:\n${e.stack}`);
            process.exit(1);
        });
};

const loadTemplateAndParameters = (templatePath, parametersPath) => Promise.all([
    loadTemplate(templatePath),
    loadParameters(parametersPath)
]);

const validateTemplate = templatePath => loadTemplate(templatePath)
    .then(() => {
        console.log(`template source at ${templatePath} is valid`);
    });

const templateToParametersSchema = templatePath => loadTemplate(templatePath)
    .then((tmpl) => {
        const schema = tmpl.getParametersSchema();
        console.log(JSON.stringify(schema, null, 2));
    })
    .catch((e) => {
        console.error(`Failed to generate schema:\n${e.stack}`);
        process.exit(1);
    });

const templateToParametersSchemaGui = templatePath => loadTemplate(templatePath)
    .then((tmpl) => {
        let schema = tmpl.getParametersSchema();
        schema = guiUtils.modSchemaForJSONEditor(schema);
        console.log(JSON.stringify(schema, null, 2));
    })
    .catch((e) => {
        console.error(`Failed to generate schema:\n${e.stack}`);
        process.exit(1);
    });

const validateParamData = (tmpl, parameters) => {
    try {
        tmpl.validateParameters(parameters);
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
};

const validateParameters = (templatePath, parametersPath) => loadTemplateAndParameters(templatePath, parametersPath)
    .then(([tmpl, parameters]) => {
        validateParamData(tmpl, parameters);
    })
    .catch((e) => {
        console.error(e.stack);
        process.exit(1);
    });

const renderTemplate = (templatePath, parametersPath) => loadTemplateAndParameters(templatePath, parametersPath)
    .then(([tmpl, parameters]) => Promise.all([
        Promise.resolve(tmpl),
        tmpl.fetchHttp()
            .then(httpParams => Object.assign({}, parameters, httpParams))
    ]))
    .then(([tmpl, parameters]) => {
        console.log(tmpl.render(parameters));
    })
    .catch((e) => {
        console.error(`Failed to render template:\n${e.stack}`);
        process.exit(1);
    });

const validateTemplateSet = (tsPath) => {
    const tsName = path.basename(tsPath);
    const tsDir = path.dirname(tsPath);
    const provider = new FsTemplateProvider(tsDir, [tsName]);
    let errorFound = false;
    return provider.list()
        .then(templateList => Promise.all(
            templateList.map(
                tmpl => provider.fetch(tmpl)
                    .catch((e) => {
                        console.error(
                            `Template "${tmpl}" failed validation:\n${e.stack}\n`
                        );
                        errorFound = true;
                    })

            )
        ))
        .then(() => {
            if (errorFound) {
                console.error(`Template set "${tsName}" failed validation`);
                process.exit(1);
            }
        })
        .catch((e) => {
            console.error(`Template set "${tsName}" failed validation:\n${e.stack}`);
            process.exit(1);
        });
};

const htmlPreview = (templatePath, parametersPath) => loadTemplateAndParameters(templatePath, parametersPath)
    .then(([tmpl, parameters]) => guiUtils.generateHtmlPreview(
        tmpl.getParametersSchema(),
        tmpl.getCombinedParameters(parameters)
    ))
    .then(htmlData => console.log(htmlData));

const packageTemplateSet = (tsPath, dst) => validateTemplateSet(tsPath)
    .then(() => {
        const tsName = path.basename(tsPath);
        const tsDir = path.dirname(tsPath);
        const provider = new FsTemplateProvider(tsDir, [tsName]);

        dst = dst || `./${tsName}.zip`;

        return provider.buildPackage(tsName, dst)
            .then(() => {
                console.log(`Template set "${tsName}" packaged as ${dst}`);
            });
    });

/* eslint-disable-next-line no-unused-expressions */
require('yargs')
    .command('validate <file>', 'validate given template source file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template source file to validate'
            });
    }, argv => validateTemplate(argv.file))
    .command('schema <file>', 'get template parameter schema for given template source file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template source file to parse'
            });
    }, argv => templateToParametersSchema(argv.file))
    .command('guiSchema <file>', 'get template parameter schema (modified for use with JSON Editor) for given template source file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template source file to parse'
            });
    }, argv => templateToParametersSchemaGui(argv.file))
    .command('validateParameters <tmplFile> <parameterFile>', 'validate supplied template parameters with given template', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template to get template parameters schema from'
            })
            .positional('parameterFile', {
                describe: 'file with template parameters to validate'
            });
    }, argv => validateParameters(argv.tmplFile, argv.parameterFile))
    .command('render <tmplFile> [parameterFile]', 'render given template file with supplied parameters', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template source file to render'
            })
            .positional('parameterFile', {
                describe: 'optional file with template parameters to use in addition to any defined in the parameters in the template source file'
            });
    }, argv => renderTemplate(argv.tmplFile, argv.parameterFile))
    .command('validateTemplateSet <templateSetPath>', 'validate supplied template set', (yargs) => {
        yargs
            .positional('templateSetPath', {
                describe: 'path to the directory containing template sources'
            });
    }, argv => validateTemplateSet(argv.templateSetPath))
    .command('htmlpreview <tmplFile> [parameterFile]', 'generate a static HTML file with a preview editor to standard out', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template source file to render'
            })
            .positional('parameterFile', {
                describe: 'optional file with template parameters to use in addition to any defined in the parameters in the template source file'
            });
    }, argv => htmlPreview(argv.tmplFile, argv.parameterFile))
    .command('packageTemplateSet <templateSetPath> [dst]', 'build a package for a given template set', (yargs) => {
        yargs
            .positional('templateSetPath', {
                describe: 'path to the directory containing template sources'
            })
            .positional('dst', {
                describe: 'optional location for the built package (defaults to the current working directory)'
            });
    }, argv => packageTemplateSet(argv.templateSetPath, argv.dst))
    .demandCommand(1, 'A command is required')
    .wrap(120)
    .strict()
    .argv;
