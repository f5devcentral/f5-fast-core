'use strict';

const fs = require('fs');

const Mustache = require('mustache');
const mergeAllOf = require('json-schema-merge-allof');

const htmlStub = require('./html_stub');

// Disable HTML escaping
Mustache.escape = function escape(text) {
    return text;
};

const injectFormatsIntoSchema = (schema) => {
    Object.values(schema).forEach((item) => {
        if (item !== null && typeof item === 'object') {
            if (item.type === 'boolean') {
                item.format = 'checkbox';
            } else if (item.type === 'array') {
                item.format = 'table';
            } else if (item.format === 'text') {
                item.format = 'textarea';
            }

            injectFormatsIntoSchema(item);
        }
    });
};

const addDepsToSchema = (schema) => {
    if (schema.dependencies) {
        Object.keys(schema.dependencies).forEach((key) => {
            const depsOpt = schema.dependencies[key].reduce((acc, curr) => {
                acc[curr] = !(
                    schema.properties[key].invertDependency
                    && schema.properties[key].invertDependency.includes(curr)
                );
                return acc;
            }, {});
            schema.properties[key].options = Object.assign({}, schema.properties[key].options, {
                dependencies: depsOpt
            });
        });
    }
    if (schema.properties) {
        Object.values(schema.properties).forEach(item => addDepsToSchema(item));
    }
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

const fixAllOfOrder = (schema) => {
    if (schema.allOf) {
        Object.keys(schema.properties).forEach((key) => {
            const prop = schema.properties[key];
            if (!prop.propertyOrder && !keyInXOf(key, schema)) {
                prop.propertyOrder = 1100;
            }
        });
    }
};

const collapseAllOf = (schema) => {
    Object.assign(schema, mergeAllOf(schema));
};

const modSchemaForJSONEditor = (schema) => {
    schema.title = schema.title || 'Template';
    injectFormatsIntoSchema(schema);
    addDepsToSchema(schema);
    fixAllOfOrder(schema);
    collapseAllOf(schema);

    return schema;
};

const filterExtraProperties = (view, schema) => Object.keys(view).reduce((acc, curr) => {
    const exists = (
        (schema.properties && schema.properties[curr] !== undefined)
        || keyInXOf(curr, schema)
    );
    if (exists) {
        acc[curr] = view[curr];
    }
    return acc;
}, {});

const generateHtmlPreview = (schema, view) => {
    const htmlView = {
        schema_data: JSON.stringify(modSchemaForJSONEditor(schema)),
        default_view: JSON.stringify(filterExtraProperties(view, schema)),
        jsoneditor: fs.readFileSync(`${__dirname}/jsoneditor.js`, 'utf8')
    };
    return Mustache.render(htmlStub.htmlData, htmlView);
};

module.exports = {
    injectFormatsIntoSchema,
    addDepsToSchema,
    modSchemaForJSONEditor,
    filterExtraProperties,
    generateHtmlPreview
};
