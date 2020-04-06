#!/usr/bin/env node

'use strict';

/* eslint-disable no-console */

const fs = require('fs').promises;
const path = require('path');

const Template = require('./lib/template').Template;
const FsTemplateProvider = require('./lib/template_provider').FsTemplateProvider;
const generateHtmlPreview = require('./lib/gui_utils').generateHtmlPreview;

const loadTemplate = (templatePath) => {
    const tmplName = path.basename(templatePath, path.extname(templatePath));
    const tsName = path.basename(path.dirname(templatePath));
    const tsDir = path.dirname(path.dirname(templatePath));
    const provider = new FsTemplateProvider(tsDir, [tsName]);
    return provider.fetch(`${tsName}/${tmplName}`)
        .catch((e) => {
            console.error(Template.getValidationErrors());
            console.error(`failed to load template: ${e.stack}`);
            process.exit(1);
        });
};

const loadView = (viewPath) => {
    if (!viewPath) return Promise.resolve({});
    return fs.readFile(viewPath, 'utf8')
        .then(viewData => JSON.parse(viewData));
};

const loadTemplateAndView = (templatePath, viewPath) => Promise.all([
    loadTemplate(templatePath),
    loadView(viewPath)
]);

const validateTemplate = templatePath => loadTemplate(templatePath)
    .then(() => {
        console.log(`template at ${templatePath} is valid`);
    });

const templateToViewSchema = templatePath => loadTemplate(templatePath)
    .then((tmpl) => {
        console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
    });

const validateViewData = (tmpl, view) => {
    try {
        tmpl.validateView(view);
    } catch (e) {
        console.error('view failed validation:');
        if (e.stack) {
            console.error(e.stack);
        } else {
            console.error(e);
        }
        process.exit(1);
    }
};

const validateView = (templatePath, viewPath) => loadTemplateAndView(templatePath, viewPath)
    .then(([tmpl, view]) => {
        validateViewData(tmpl, view);
    });

const renderTemplate = (templatePath, viewPath) => loadTemplateAndView(templatePath, viewPath)
    .then(([tmpl, view]) => {
        validateViewData(tmpl, view);
        console.log(tmpl.render(view));
    });

const validateTemplateSet = (tsPath) => {
    const tsName = path.basename(tsPath);
    const tsDir = path.dirname(tsPath);
    const provider = new FsTemplateProvider(tsDir, [tsName]);
    return provider.list()
        .then(templateList => Promise.all(templateList.map(tmpl => provider.fetch(tmpl))))
        .catch((e) => {
            console.error(`Template set "${tsName}" failed validation:\n${e.stack}`);
            process.exit(1);
        });
};

const htmlPreview = (templatePath, viewPath) => loadTemplateAndView(templatePath, viewPath)
    .then(([tmpl, view]) => generateHtmlPreview(
        tmpl.getViewSchema(),
        tmpl.getCombinedView(view)
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
    .command('validate <file>', 'validate given template file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template file to validate'
            });
    }, argv => validateTemplate(argv.file))
    .command('schema <file>', 'get view schema for given template file', (yargs) => {
        yargs
            .positional('file', {
                describe: 'template file to parse'
            });
    }, argv => templateToViewSchema(argv.file))
    .command('validateView <tmplFile> <viewFile>', 'validate supplied view with given template', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template to get view schema from'
            })
            .positional('viewFile', {
                describe: 'view file validate'
            });
    }, argv => validateView(argv.tmplFile, argv.viewFile))
    .command('render <tmplFile> [viewFile]', 'render given template file with supplied view', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template to render'
            })
            .positional('viewFile', {
                describe: 'optional view file to use in addition to any defined view in the template file'
            });
    }, argv => renderTemplate(argv.tmplFile, argv.viewFile))
    .command('validateTemplateSet <templateSetPath>', 'validate supplied template set', (yargs) => {
        yargs
            .positional('templateSetPath', {
                describe: 'path to template set'
            });
    }, argv => validateTemplateSet(argv.templateSetPath))
    .command('htmlpreview <tmplFile> [viewFile]', 'generate a static HTML file with a preview editor to standard out', (yargs) => {
        yargs
            .positional('tmplFile', {
                describe: 'template to preview'
            })
            .positional('viewFile', {
                describe: 'optional view file to use in addition to any defined view in the template file'
            });
    }, argv => htmlPreview(argv.tmplFile, argv.viewFile))
    .command('packageTemplateSet <templateSetPath> [dst]', 'build a package for a given template set', (yargs) => {
        yargs
            .positional('templateSetPath', {
                describe: 'path to template set'
            })
            .positional('dst', {
                describe: 'optional location for the built package (defaults to the current working directory)'
            });
    }, argv => packageTemplateSet(argv.templateSetPath, argv.dst))
    .demandCommand(1, 'A command is required')
    .strict()
    .argv;
