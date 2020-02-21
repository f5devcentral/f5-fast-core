/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const assert = require('assert').strict;

const FsSchemaProvider = require('../lib/schema_provider').FsSchemaProvider;
const Template = require('../lib/template').Template;


const templatesPath = './test/templatesets/test';

const mstWithTypes = `{
    "name" : "test template",
    "default" : "{{variable1}}",
    "string_type" : {{string_variable::string}},
    "array_type" : [
      {{#array_variable}}
        "{{.}}",
      {{/array_variable}}
    ],
    "boolean_type" : {{boolean_variable::boolean}},
    "number_type" : {{number_variable::number}},
    "duplicate_key": "{{variable1}}"
`;

describe('Template class tests', function () {
    it('construct', function () {
        const tmpl = new Template();
        assert.ok(tmpl);
    });
    it('load_mustache', function () {
        const mstdata = `
            {{!
                Just a basic template
            }}
            {
                {{foo}}
            }
        `;

        const reference = new Template();
        reference.description = 'Just a basic template';
        reference.templateText = mstdata;

        return Template.loadMst(mstdata)
            .then((tmpl) => {
                reference._viewSchema = tmpl._viewSchema;
                assert.ok(tmpl);
                assert.deepStrictEqual(tmpl, reference);
            });
    });
    it('load_yaml', function () {
        const ymldata = `
            view:
              message: Hello!
            definitions:
              body:
                template:
                  <body>
                    <h1>{{message}}</h1>
                  </body>
            template: |
              <html>
                {{> body}}
              </html>
        `;

        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('from_json', function () {
        return Template.loadMst(mstWithTypes)
            .then((tmpl) => {
                const jsondata = JSON.stringify(tmpl);
                let jsontmpl = Template.fromJson(jsondata);
                console.log(jsondata);
                console.log(jsontmpl);
                assert.deepEqual(jsontmpl, tmpl);

                jsontmpl = Template.fromJson(JSON.parse(jsondata));
                assert.deepEqual(jsontmpl, tmpl);
            });
    });
    it('missing_dscription', function () {
        const mstdata = '{{{foo}}: {{bar}}}';
        return Template.loadMst(mstdata)
            .then((tmpl) => {
                assert.ok(tmpl);
                assert.strictEqual(tmpl.description, '');
            });
    });
    it('get_schema', function () {
        const reference = {
            type: 'object',
            properties: {
                variable1: { type: 'string', default: '' },
                string_variable: { type: 'string', default: '' },
                array_variable: {
                    type: 'array',
                    skip_xform: true,
                    items: {
                        default: '',
                        type: 'string'
                    },
                    default: []
                },
                boolean_variable: { type: 'boolean', default: false },
                number_variable: { type: 'number', default: 0 }
            },
            required: [
                'variable1',
                'string_variable',
                'array_variable',
                'boolean_variable',
                'number_variable'
            ],
            title: '',
            description: ''
        };
        return Template.loadMst(mstWithTypes)
            .then((tmpl) => {
                assert.deepStrictEqual(tmpl.getViewSchema(), reference);
            });
    });
    it('load_complex_yaml', function () {
        const ymldata = fs.readFileSync(`${templatesPath}/complex.yml`, 'utf8');
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('fail_validation', function () {
        const mstdata = `
            {{foo}
        `;
        assert.throws(() => Template.validate(mstdata));

        // should fail for missing template, but still passes as valid mustache
        // const ymldata = 'title: foo';
        // assert.throws(() => Template.validate(ymldata));
    });
    it('render', function () {
        const mstdata = `
            {{foo::string}}
        `;
        const view = {
            foo: 'bar'
        };
        const reference = `
            bar
        `;
        return Template.loadMst(mstdata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('load_partials', function () {
        const ymldata = fs.readFileSync(`${templatesPath}/complex.yml`, 'utf8');
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                assert.notStrictEqual(tmpl._getPartials(), {});
            });
    });
    it('render_partial_with_type', function () {
        const ymldata = `
            view:
                numb: 5
                arr:
                    - "1"
                    - "2"
            definitions:
                numbpartial:
                    template: |
                        numb={{numb::integer}}
                arraypartial:
                    template: |
                        arr={{arr::array}}
            template: |
                {{> numbpartial}}
                {{> arraypartial}}
        `;
        const reference = 'numb=5\narr=["1","2"]\n';
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(), reference);
            });
    });
    it('render_empty_template', function () {
        const mstdata = '';
        const view = {};
        const reference = '';

        return Template.loadMst(mstdata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('render_inverted_section', function () {
        const mstdata = '{{^skip_foo}}foo{{/skip_foo}}{{^skip_bar}}bar{{/skip_bar}}';
        const view = { skip_foo: true };
        const reference = 'bar';

        return Template.loadMst(mstdata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('render_type_defaults', function () {
        const schemaProvider = new FsSchemaProvider('./../templates/bigip-fast-templates');
        const mstdata = '{{virtual_port:f5:port}}';
        const view = {};
        const reference = '443';

        return Template.loadMst(mstdata, schemaProvider)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('render_array', function () {
        const mstdata = '{{values::array}}';
        const view = { values: ['1', '2', '3'] };
        const reference = '["1","2","3"]';
        return Template.loadMst(mstdata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('render_nested_section', function () {
        const mstdata = `
            {{#outer_val}}
                {{outer_val::array}}
            {{/outer_val}}
            {{^outer_val}}
                {{#inner_val}}
                    {{inner_val::array}}
                {{/inner_val}}
            {{/outer_val}}
        `;
        const view = { outer_val: [], inner_val: ['1', '2', '3'] };
        const reference = '["1","2","3"]';

        return Template.loadMst(mstdata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
                assert.strictEqual(tmpl.render(view).trim(), reference);
            });
    });
    it('render_merged_sections', function () {
        const ymldata = `
            definitions:
                part_nothing:
                    template: |
                        {{^value}}
                            Nothing
                        {{/value}}
                part_value:
                    template: |
                        {{#value}}
                            {{value}}
                        {{/value}}
            template: |
                {{> part_value}}
                {{> part_nothing}}
        `;
        const view = { value: 'foo' };
        const reference = 'foo';

        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getViewSchema(), null, 2));
                assert.strictEqual(tmpl.render(view).trim(), reference);
            });
    });
    it('schema_clean_deps', function () {
        const mstdata = `
            {{app_name}}
            {{#do_foo}}
                {{app_name}}_foo
            {{/do_foo}}
        `;

        return Template.loadMst(mstdata)
            .then((tmpl) => {
                const schema = tmpl.getViewSchema();
                console.log(JSON.stringify(schema, null, 2));
                assert(schema.required.includes('app_name'));
                assert(typeof schema.dependencies === 'undefined');
            });
    });
    it('schema_title_desc_from_def', function () {
        const ymldata = `
            definitions:
                foo:
                    title: 'Foo'
                    description: 'BarBar'
                baz:
                    title: 'Baz'
            template: |
                {{foo}}{{baz}}{{empty}}
        `;

        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                const fooDef = tmpl.getViewSchema().properties.foo;
                assert.strictEqual(fooDef.title, 'Foo');
                assert.strictEqual(fooDef.description, 'BarBar');

                const bazDef = tmpl.getViewSchema().properties.baz;
                assert.strictEqual(bazDef.title, 'Baz');
                assert.strictEqual(typeof bazDef.description, 'undefined');

                const emptyDef = tmpl.getViewSchema().properties.empty;
                assert.strictEqual(typeof emptyDef.title, 'undefined');
                assert.strictEqual(typeof emptyDef.description, 'undefined');
            });
    });
});
