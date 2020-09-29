/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const assert = require('assert').strict;
const nock = require('nock');

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
    "duplicate_key": "{{variable1}}",
    "hidden_type": {{hidden_variable::hidden}}
`;

describe('Template class tests', function () {
    afterEach(function () {
        nock.cleanAll();
    });
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

        return Template.loadMst(mstdata)
            .then((tmpl) => {
                assert.ok(tmpl);
                assert.strictEqual(tmpl.description, 'Just a basic template');
                assert.strictEqual(tmpl.templateText, mstdata);
                assert.strictEqual(tmpl.sourceType, 'MST');
                assert.strictEqual(tmpl.sourceText, mstdata);
                assert.strictEqual(tmpl.sourceHash, '6ac8bbb53fdfe637931e0dfc9e4259ef685ab5fc8e1e13b796dbf6d3145fe213');
            });
    });
    it('load_yaml', function () {
        const ymldata = `
            parameters:
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
                assert.strictEqual(tmpl.description, '');
                assert.deepStrictEqual(tmpl.defaultParameters, {
                    message: 'Hello!'
                });
                assert.deepStrictEqual(tmpl.definitions, {
                    body: {
                        template: '<body> <h1>{{message}}</h1> </body>'
                    }
                });
                assert.strictEqual(tmpl.templateText, '<html>\n  {{> body}}\n</html>\n');
                assert.strictEqual(tmpl.sourceType, 'YAML');
                assert.strictEqual(tmpl.sourceText, ymldata);
                assert.strictEqual(tmpl.sourceHash, 'adec093e096e713e8d16e4e213b42c488179da5d42d0928ef729eaef04ee7f92');
                assert.strictEqual(tmpl._parametersSchema, tmpl._parametersSchema);
            });
    });
    it('from_json_str', function () {
        let tmpl = null;
        return Template.loadMst(mstWithTypes)
            .then((tmplData) => {
                tmpl = tmplData;
                return Template.fromJson(JSON.stringify(tmpl));
            })
            .then((jsontmpl) => {
                delete jsontmpl._parametersValidator;
                delete tmpl._parametersValidator;
                assert.deepEqual(jsontmpl, tmpl);
            });
    });
    it('from_json_obj', function () {
        let tmpl = null;
        return Template.loadMst(mstWithTypes)
            .then((tmplData) => {
                tmpl = tmplData;
                return Template.fromJson(JSON.parse(JSON.stringify(tmpl)));
            })
            .then((jsontmpl) => {
                delete jsontmpl._parametersValidator;
                delete tmpl._parametersValidator;
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
                        type: 'string'
                    }
                },
                boolean_variable: { type: 'boolean', default: false },
                number_variable: { type: 'number', default: 0 },
                hidden_variable: { type: 'string', format: 'hidden', default: '' }
            },
            required: [
                'variable1',
                'string_variable',
                'array_variable',
                'boolean_variable',
                'number_variable'
            ],
            title: '',
            description: '',
            definitions: {}
        };
        return Template.loadMst(mstWithTypes)
            .then((tmpl) => {
                assert.deepStrictEqual(tmpl.getParametersSchema(), reference);
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
    it('schema_sections_array', function () {
        const mstdata = '{{#section}}{{foo}}{{/section}}';
        return Template.loadMst(mstdata)
            .then((tmpl) => {
                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));
                assert(
                    schema.required.includes('section'),
                    'section should be required'
                );
                assert(
                    !schema.required.includes('foo'),
                    'foo should not be required on base schema'
                );
                assert(
                    !Object.keys(schema.properties).includes('foo'),
                    'foo should not have been hoisted to global scope'
                );
                assert.ok(schema.dependencies);
                assert.deepStrictEqual(schema.dependencies.foo, ['section']);

                const sectionDef = schema.properties.section;
                console.log(JSON.stringify(sectionDef, null, 2));
                assert.ok(sectionDef);
                assert.strictEqual(sectionDef.type, 'array');
                assert.ok(sectionDef.items.properties.foo, 'foo variable should be nested in section');
                assert(
                    sectionDef.items.required.includes('foo'),
                    'foo variable should be required on section'
                );
            });
    });
    it('schema_sections_dot_array', function () {
        const ymldata = `
            definitions:
                section:
                    type: array
                    items:
                        enumFromBigip: ltm/rule
            template: |
                {{#section}}{{.}}{{/section}}
        `;
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));
                assert(
                    schema.required.includes('section'),
                    'section should be required'
                );
                assert(!schema.dependencies, 'schema should have no dependencies');

                const sectionDef = schema.properties.section;
                console.log(JSON.stringify(sectionDef, null, 2));
                assert.ok(sectionDef);
                assert.strictEqual(sectionDef.type, 'array');
                assert.strictEqual(sectionDef.items.type, 'string');
                assert.ok(sectionDef.items.enumFromBigip);
            });
    });
    it('schema_sections_boolean', function () {
        const ymldata = `
            definitions:
                section:
                    type: "boolean"
            template: |
                {{#section}}{{foo}}{{/section}}
        `;
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));
                assert(
                    schema.required.includes('section'),
                    'section should be required'
                );
                assert(
                    !schema.required.includes('foo'),
                    'foo should not be required on base schema'
                );
                assert.ok(schema.properties.foo, 'foo variable should have been hoisted to global scope');
                assert.ok(schema.dependencies);
                assert.deepStrictEqual(schema.dependencies.foo, ['section']);

                const sectionDef = schema.properties.section;
                console.log(JSON.stringify(sectionDef, null, 2));
                assert.ok(sectionDef);
                assert.strictEqual(sectionDef.type, 'boolean');
                assert(!sectionDef.items);
            });
    });
    it('schema_sections_object', function () {
        const ymldata = `
            definitions:
                section:
                    type: "object"
            template: |
                {{#section}}{{foo}}{{/section}}
        `;
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));
                assert(
                    schema.required.includes('section'),
                    'section should be required'
                );
                assert(
                    !schema.required.includes('foo'),
                    'foo should not be required on base schema'
                );
                assert(
                    !Object.keys(schema.properties).includes('foo'),
                    'foo should not have been hoisted to global scope'
                );
                assert.ok(schema.dependencies);
                assert.deepStrictEqual(schema.dependencies.foo, ['section']);

                const sectionDef = schema.properties.section;
                console.log(JSON.stringify(sectionDef, null, 2));
                assert.ok(sectionDef);
                assert.strictEqual(sectionDef.type, 'object');
                assert.ok(sectionDef.properties.foo, 'foo variable should be nested in section');
                assert(
                    sectionDef.required.includes('foo'),
                    'foo variable should be required on section'
                );
            });
    });
    it('schema_x_of', function () {
        const ymldata = fs.readFileSync(`${templatesPath}/combine.yml`, 'utf8');
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));

                const allOf = schema.allOf;
                assert.ok(allOf);
                assert.ok(allOf[0].properties.name);

                const oneOf = schema.oneOf;
                assert.ok(oneOf);
                assert.ok(oneOf[0].properties.prop1);
                assert.ok(oneOf[1].properties.prop2);

                const anyOf = schema.anyOf;
                assert.ok(anyOf);
                assert.ok(anyOf[1].properties.mixin_prop);
            });
    });
    it('render', function () {
        const mstdata = `
            {{foo::string}}
        `;
        const parameters = {
            foo: 'bar'
        };
        const reference = `
            bar
        `;
        return Template.loadMst(mstdata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(parameters), reference);
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
            parameters:
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
    it('render_section_with_type', function () {
        const schemaProvider = new FsSchemaProvider(templatesPath);
        const mstdata = '{{#section:types:bool_section}}{{var}}{{/section:types:bool_section}}';
        const view = {
            section: true,
            var: 'foo'
        };
        const reference = 'foo';

        return Template.loadMst(mstdata, schemaProvider)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(view), reference);
            });
    });
    it('render_section_with_partial', function () {
        const ymldata = `
            parameters:
                section:
                    - numb: 1
                    - numb: 3
                    - numb: 5
                    - numb: 7
            definitions:
                numbpartial:
                    template: |
                        numb={{numb::integer}}
                arraypartial:
                    template: |
                        arr={{arr::array}}
            template: |
                {{#section}}{{> numbpartial}}{{/section}}
        `;
        const reference = 'numb=1\nnumb=3\nnumb=5\nnumb=7\n';
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(), reference);
            });
    });
    it('render_empty_template', function () {
        const mstdata = '';
        const parameters = {};
        const reference = '';

        return Template.loadMst(mstdata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(parameters), reference);
            });
    });
    it('render_inverted_section', function () {
        const mstdata = '{{^skip_foo}}{{foo}}{{/skip_foo}}{{^skip_bar}}bar{{/skip_bar}}';
        const parameters = { skip_foo: true };
        const reference = 'bar';

        return Template.loadMst(mstdata)
            .then((tmpl) => {
                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));
                assert.strictEqual(tmpl.render(parameters), reference);
                assert.deepStrictEqual(schema.properties.foo.invertDependency, ['skip_foo']);
            });
    });
    it('render_type_defaults', function () {
        const schemaProvider = new FsSchemaProvider(templatesPath);
        const mstdata = '{{virtual_port:types:port}}';

        return Template.loadMst(mstdata, schemaProvider)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getParametersSchema(), null, 2));
                assert.strictEqual(tmpl.definitions.port.type, 'integer');
            });
    });
    it('render_array', function () {
        const mstdata = '{{values::array}}';
        const parameters = { values: ['1', '2', '3'] };
        const reference = '["1","2","3"]';
        return Template.loadMst(mstdata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getParametersSchema(), null, 2));
                assert.strictEqual(tmpl.render(parameters), reference);
            });
    });
    it('render_text', function () {
        const mstdata = '{{textvar::text}}';
        const parameters = { textvar: 'multi\nline' };
        const reference = '"multi\\nline"';
        return Template.loadMst(mstdata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getParametersSchema(), null, 2));
                assert.strictEqual(tmpl.render(parameters), reference);
            });
    });
    it('render_merged_sections', function () {
        const ymldata = `
            definitions:
                value:
                    type: string
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
        const parameters = { value: 'foo' };
        const reference = 'foo';

        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                console.log(JSON.stringify(tmpl.getParametersSchema(), null, 2));
                assert.strictEqual(tmpl.render(parameters).trim(), reference);
            });
    });
    it('render_x_of', function () {
        const ymldata = fs.readFileSync(`${templatesPath}/combine.yml`, 'utf8');
        return Promise.resolve()
            .then(() => Template.loadYaml(ymldata))
            .then((tmpl) => {
                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));
                const parameters = {
                    name: 'foo',
                    prop1: 'bar',
                    mixin_prop: 'baz'
                };
                const reference = 'foo\nbaz\nbar';
                const rendered = tmpl.render(parameters).trim();
                console.log(JSON.stringify(parameters, null, 2));
                assert.strictEqual(rendered, reference);
            });
    });
    it('render_remove_dangling_commas', function () {
        const yamldata = `
            contentType: application/json
            parameters:
                list:
                    - foo
                    - bar
            template: |
                {
                    "list": [
                    {{#list}}
                        "{{ . }}",
                    {{/list}}
                    ]
                }
            `;
        return Promise.resolve()
            .then(() => Template.loadYaml(yamldata))
            .then((tmpl) => {
                const rendered = tmpl.render();
                const parsed = JSON.parse(rendered);
                assert.deepStrictEqual(parsed.list, [
                    'foo',
                    'bar'
                ]);
            });
    });
    it('render_json_object', function () {
        const yamldata = `
            contentType: application/json
            parameters:
                foo:
                    bar: 1
                    baz: stringy
            definitions:
                foo:
                    type: object
            template: |
                {{foo}}
        `;
        const reference = [
            '{',
            '  "bar": 1,',
            '  "baz": "stringy"',
            '}'
        ].join('\n');
        return Template.loadYaml(yamldata)
            .then((tmpl) => {
                assert.strictEqual(tmpl.render(), reference);
            });
    });
    it('schema_nested_sections', function () {
        const ymldata = `
            definitions:
                part:
                    template: |
                        {{^use_existing_a}}
                            {{^make_new_b}}
                                {{value}}
                            {{/make_new_b}}
                        {{/use_existing_a}}
            template: |
                {{> part}}
        `;
        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                assert.ok(tmpl);

                const schema = tmpl.getParametersSchema();
                console.log(JSON.stringify(schema, null, 2));
                assert.deepStrictEqual(schema.dependencies.value, ['use_existing_a', 'make_new_b']);
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
                const schema = tmpl.getParametersSchema();
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
                section:
                    title: 'Section'
                inv_section:
                    title: 'Inverted'
            template: |
                {{foo}}{{baz}}{{empty}}
                {{#section}}{{/section}}
                {{^inv_section}}{{/inv_section}}
        `;

        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                const fooDef = tmpl.getParametersSchema().properties.foo;
                assert.strictEqual(fooDef.title, 'Foo');
                assert.strictEqual(fooDef.description, 'BarBar');

                const bazDef = tmpl.getParametersSchema().properties.baz;
                assert.strictEqual(bazDef.title, 'Baz');
                assert.strictEqual(typeof bazDef.description, 'undefined');

                const emptyDef = tmpl.getParametersSchema().properties.empty;
                assert.strictEqual(typeof emptyDef.title, 'undefined');
                assert.strictEqual(typeof emptyDef.description, 'undefined');

                const secDef = tmpl.getParametersSchema().properties.section;
                assert.strictEqual(secDef.title, 'Section');

                const invSecDef = tmpl.getParametersSchema().properties.inv_section;
                assert.strictEqual(invSecDef.title, 'Inverted');
            });
    });
    it('schema_prop_order_from_def', function () {
        const ymldata = `
            definitions:
                foo:
                    title: 'Foo'
                baz:
                    title: 'Baz'
            template: |
                {{bar}}{{baz}}{{foo}}{{other}}
        `;

        return Template.loadYaml(ymldata)
            .then((tmpl) => {
                assert.deepStrictEqual(Object.keys(tmpl.getParametersSchema().properties), [
                    'foo',
                    'baz',
                    'bar',
                    'other'
                ]);
            });
    });
    it('schema_mix_types_and_defs', function () {
        const schemaProvider = new FsSchemaProvider(templatesPath);
        const ymldata = `
            definitions:
                https_port:
                    title: Foo
                    description: Very Foo
                    default: 500
            template: |
                {{https_port:types:port}}
        `;

        return Template.loadYaml(ymldata, schemaProvider)
            .then((tmpl) => {
                const schema = tmpl.getParametersSchema();
                console.log(schema);

                assert.strictEqual(schema.properties.https_port.title, 'Foo');
                assert.strictEqual(schema.properties.https_port.description, 'Very Foo');
                assert.strictEqual(schema.properties.https_port.minimum, 0);
                assert.strictEqual(schema.properties.https_port.default, 500);
            });
    });
    it('ref_fail_http', function () {
        const ymldata = `
            definitions:
                ref:
                    $ref: "http://example.com/foo.json#/definitions/foo"
            template: |
                {{ref}}
        `;

        return Template.loadYaml(ymldata)
            .then(() => {
                assert(false, 'should have failed on http reference');
            })
            .catch((e) => {
                console.log(JSON.stringify(e, null, 2));
                assert.match(e.message, /Parsing references failed/);
            });
    });
    it('ref_fail_parent_dir', function () {
        const ymldata = `
            definitions:
                foo:
                    type: string
                ref:
                    $ref: "../foo.json#/definitions/foo"
            template: |
                {{ref}}
        `;

        return Template.loadYaml(ymldata)
            .then(() => {
                assert(false, 'should have failed on a parent directory reference');
            })
            .catch((e) => {
                console.log(e.message);
                assert.match(e.message, /Parsing references failed/);
            });
    });
    it('ref_fail_partial', function () {
        const ymldata = `
            definitions:
                data:
                    template: |
                        {{foo}}
                ref:
                    $ref: "#/definitions/data"
            template: |
                {{> ref}}
        `;

        return Template.loadYaml(ymldata)
            .then(() => {
                assert(false, 'should have failed on missing partial');
            })
            .catch((e) => {
                console.log(e);
                assert.match(e.message, /does not reference a known partial/);
            });
    });
    it('fetch_http_basic', function () {
        const ymldata = `
            definitions:
                var:
                    url: http://example.com/resource
            template: |
                {{var}}
        `;

        nock('http://example.com/')
            .get('/resource')
            .reply(200, 'foo')
            .get('/resource')
            .reply(200, '"foo"');
        return Template.loadYaml(ymldata)
            .then(tmpl => Promise.resolve()
                .then(() => tmpl.fetchHttp())
                .then((httpView) => {
                    console.log(JSON.stringify(httpView, null, 2));
                    assert.strictEqual(httpView.var, 'foo');
                })
                .then(() => tmpl.fetchAndRender())
                .then((rendered) => {
                    assert.strictEqual(rendered.trim(), 'foo');
                }));
    });
    it('fetch_http_url_obj', function () {
        const ymldata = `
            definitions:
                var:
                    url:
                      host: example.com
                      path: /resource
            template: |
                {{var}}
        `;

        nock('http://example.com/')
            .get('/resource')
            .reply(200, 'foo');
        return Template.loadYaml(ymldata)
            .then(tmpl => tmpl.fetchHttp())
            .then((httpView) => {
                console.log(JSON.stringify(httpView, null, 2));
                assert.strictEqual(httpView.var, 'foo');
            });
    });
    it('fetch_http_with_data', function () {
        const ymldata = `
            definitions:
                var:
                    url: http://example.com/resource
                    pathQuery: $.foo
            template: |
                {{var}}
        `;

        nock('http://example.com/')
            .persist()
            .get('/resource')
            .reply(200, { foo: 'bar' });
        return Template.loadYaml(ymldata)
            .then(tmpl => Promise.resolve()
                .then(() => tmpl.fetchHttp())
                .then((httpView) => {
                    console.log(JSON.stringify(httpView, null, 2));
                    assert.strictEqual(httpView.var, 'bar');
                })
                .then(() => tmpl.fetchAndRender())
                .then((rendered) => {
                    assert.strictEqual(rendered.trim(), 'bar');
                }));
    });
    it('fetch_http_bad_query', function () {
        const ymldata = `
            definitions:
                var:
                    url: http://example.com/resource
                    pathQuery: $.bar
            template: |
                {{var}}
        `;

        nock('http://example.com/')
            .persist()
            .get('/resource')
            .reply(200, { foo: 'bar' });
        return Template.loadYaml(ymldata)
            .then(tmpl => tmpl.fetchHttp())
            .then((httpView) => {
                console.log(JSON.stringify(httpView, null, 2));
                assert.strictEqual(httpView.var, undefined);
            });
    });
    it('forward_http', function () {
        const ymldata = `
            httpForward:
                url: http://example.com/resource
            definitions:
                var:
                    default: foo
            template: |
                {{var}}
        `;
        let posted = false;
        nock('http://example.com/')
            .post('/resource')
            .reply(200, () => {
                posted = true;
                return '';
            });
        return Template.loadYaml(ymldata)
            .then(tmpl => tmpl.forwardHttp())
            .then(() => {
                assert(posted, 'failed to post the rendered result');
            });
    });
    it('forward_http_missing', function () {
        const ymldata = `
            definitions:
                var:
                    default: foo
            template: |
                {{var}}
        `;
        return Template.loadYaml(ymldata)
            .then(tmpl => tmpl.forwardHttp())
            .catch((e) => {
                console.log(e.message);
                assert.match(e.message, /httpForward was not defined for this template/);
            });
    });
});
