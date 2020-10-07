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
                if (item.uniqueItems && item.items && item.items.enum) {
                    item.format = 'select';
                } else {
                    item.format = 'table';
                }
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
            if (!schema.properties[key]) {
                return;
            }
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

const fixAllOfOrder = (schema, orderID) => {
    orderID = orderID || 0;

    if (schema.allOf) {
        schema.allOf.forEach((subSchema) => {
            orderID = fixAllOfOrder(subSchema, orderID);
        });
    }

    if (schema.properties) {
        Object.keys(schema.properties).forEach((key) => {
            const prop = schema.properties[key];
            if (!prop.propertyOrder && !keyInXOf(key, schema)) {
                prop.propertyOrder = orderID;
                orderID += 1;
            }
        });
    }

    return orderID;
};

const collapseAllOf = (schema) => {
    fixAllOfOrder(schema);
    return mergeAllOf(schema);
};

const modSchemaForJSONEditor = (schema) => {
    schema = JSON.parse(JSON.stringify(schema)); // Do not modify original schema
    schema.title = schema.title || 'Template';
    schema = collapseAllOf(schema);
    injectFormatsIntoSchema(schema);
    addDepsToSchema(schema);

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
    schema = modSchemaForJSONEditor(schema);
    const htmlView = {
        schema_data: JSON.stringify(schema),
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
