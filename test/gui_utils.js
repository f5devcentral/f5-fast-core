/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const assert = require('assert');

const guiUtils = require('../lib/gui_utils');

describe('GUI utils test', function () {
    it('add_title', function () {
        const schema = guiUtils.modSchemaForJSONEditor({});
        assert.strictEqual(schema.title, 'Template');
    });
    it('inject_formats', function () {
        let schema = {
            properties: {
                bool: { type: 'boolean' },
                table: { type: 'array' },
                str: { type: 'string' },
                longstr: { type: 'string', format: 'text' },
                multiselect: {
                    type: 'array',
                    uniqueItems: true,
                    items: {
                        type: 'string',
                        enum: ['val1', 'val2']
                    }
                }
            }
        };
        schema = guiUtils.modSchemaForJSONEditor(schema);
        assert.strictEqual(schema.properties.bool.format, 'checkbox');
        assert.strictEqual(schema.properties.table.format, 'table');
        assert.strictEqual(schema.properties.str.format, undefined);
        assert.strictEqual(schema.properties.longstr.format, 'textarea');
        assert.strictEqual(schema.properties.multiselect.format, 'select');
    });
    it('add_deps', function () {
        let schema = {
            properties: {
                useFoo: { type: 'boolean' },
                existingFoo: { type: 'boolean' },
                foo: { type: 'string', invertDependency: ['existingFoo'] },
                skipBar: { type: 'boolean' },
                bar: { type: 'string', invertDependency: ['skipBar'] }
            },
            dependencies: {
                foo: ['existingFoo', 'useFoo'],
                bar: ['skipBar'],
                existingFoo: ['useFoo']
            }
        };
        schema = guiUtils.modSchemaForJSONEditor(schema);
        console.log(JSON.stringify(schema, null, 2));
        assert.deepStrictEqual(schema.properties.foo.options.dependencies, { useFoo: true, existingFoo: false });
        assert.deepStrictEqual(schema.properties.bar.options.dependencies, { skipBar: false });
    });
    it('all_of_fixes', function () {
        let schema = {
            properties: {
                showFirst: { type: 'string' },
                foo: { type: 'string' }
            },
            allOf: [
                {
                    properties: {
                        baz: { type: 'integer' }
                    }
                },
                {
                    properties: {
                        baz: { type: 'integer' }
                    }
                }
            ]
        };
        schema = guiUtils.modSchemaForJSONEditor(schema);
        console.log(JSON.stringify(schema, null, 2));

        // Order fixes
        const expectedOrder = ['baz', 'showFirst', 'foo'];
        const actualOrder = Object.keys(schema.properties).sort((a, b) => (
            schema.properties[a].propertyOrder - schema.properties[b].propertyOrder
        ));
        assert.deepStrictEqual(actualOrder, expectedOrder);

        // Flatten allOf
        assert.strictEqual(schema.allOf, undefined);
    });
    it('filter_extra_props', function () {
        const schema = {
            properties: {
                foo: { type: 'string' }
            }
        };
        const view = {
            foo: 'bar',
            baz: 0
        };
        const filteredView = guiUtils.filterExtraProperties(view, schema);
        assert.deepStrictEqual(filteredView, { foo: 'bar' });

        assert.deepStrictEqual(guiUtils.filterExtraProperties(view, {}), {});
    });
    it('filter_extra_props_all_of', function () {
        const schema = {
            properties: {
                foo: { type: 'string' }
            },
            allOf: [
                {
                    properties: {
                        baz: { type: 'integer' }
                    }
                }
            ]
        };
        const view = {
            foo: 'bar',
            baz: 0,
            noshow: ''
        };
        const filteredView = guiUtils.filterExtraProperties(view, schema);
        assert.deepStrictEqual(filteredView, { foo: 'bar', baz: 0 });

        assert.deepStrictEqual(guiUtils.filterExtraProperties(view, {}), {});
    });
    it('generate_html_preview', function () {
        const schema = {
            properties: {
                foo: { type: 'string' }
            }
        };
        const view = {};
        const htmlData = guiUtils.generateHtmlPreview(schema, view);

        assert.notStrictEqual(htmlData, '');
    });
});
