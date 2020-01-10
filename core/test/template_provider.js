/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const assert = require('assert').strict;

const { FsSchemaProvider } = require('../lib/schema_provider');
const { FsTemplateProvider } = require('../lib/template_provider');

const templatesPath = './../templates';

describe('template provider tests', function () {
    it('construct', function () {
        const provider = new FsTemplateProvider(templatesPath);
        assert.ok(provider);
    });
    it('load_single', function () {
        const provider = new FsTemplateProvider(templatesPath);
        return provider.fetch('simple_http')
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('load_single_with_schema', function () {
        const schemaProvider = new FsSchemaProvider('./../schemas');
        const provider = new FsTemplateProvider(templatesPath, schemaProvider);
        return provider.fetch('f5_https')
            .then((tmpl) => {
                assert.ok(tmpl);
            });
    });
    it('load_list', function () {
        const provider = new FsTemplateProvider(templatesPath);
        return provider.list()
            .then((templates) => {
                assert.ok(templates);
                assert.notEqual(templates.length, 0);
            });
    });
});
