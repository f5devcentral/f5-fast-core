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

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const assert = require('assert');

const templateSetDir = path.join(__dirname, 'templatesets', 'test');
const templateSimplePath = path.join(templateSetDir, 'simple.yaml');

async function executeCommand(commandStr) {
    const cmd = `node ${path.join('..', 'cli.js')} ${commandStr}`;
    console.log(`running: ${cmd}`);
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
            }

            resolve({ stdout, stderr });
        });
    });
}

describe('CLI tests', function () {
    let tmpDir = null;
    const mktmpdir = () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fast'));
    };

    const rmtmpdir = () => {
        if (tmpDir !== null) {
            if (fs.rmSync) {
                fs.rmSync(tmpDir, { recursive: true });
            } else {
                // Older Node version
                fs.rmdirSync(tmpDir, { recursive: true });
            }
            tmpDir = null;
        }
    };

    afterEach(rmtmpdir);

    describe('validate', function () {
        it('should succeed on valid template', async function () {
            const { stdout } = await executeCommand(`validate ${templateSimplePath}`);
            assert.match(stdout, /template source at .* is valid/);
        });
        it('should fail on invalid template', async function () {
            const invalidTemplatePath = path.join(__dirname, 'invalid_templatesets', 'invalid', 'invalid.yaml');
            return executeCommand(`validate ${invalidTemplatePath}`)
                .then(() => assert(false, 'Expected command to fail'))
                .catch((e) => {
                    console.log(e);
                    assert.match(e.stderr, /failed to load template/);
                });
        });
        it('should support JSON output', async function () {
            const { stdout } = await executeCommand(`validate --json-output ${templateSimplePath}`);
            const output = JSON.parse(stdout);
            assert.match(output.result, /template source at .* is valid/);
        });
        it('should support JSON error output', async function () {
            const invalidTemplatePath = path.join(__dirname, 'invalid_templatesets', 'invalid', 'invalid.yaml');
            return executeCommand(`validate --json-output ${invalidTemplatePath}`)
                .then(() => assert(false, 'Expected command to fail'))
                .catch((e) => {
                    const output = JSON.parse(e.stdout);
                    console.log(output);
                    assert.match(output.error, /failed to load template/);
                });
        });
    });
    describe('schema', function () {
        it('should output template parameters schema', async function () {
            const { stdout } = await executeCommand(`schema ${templateSimplePath}`);
            const schema = JSON.parse(stdout);
            assert.ok(schema.properties.str_var);
            assert.match(schema.title, /Simple YAML file/);
        });
        it('should support JSON output', async function () {
            const { stdout } = await executeCommand(`schema --json-output ${templateSimplePath}`);
            const output = JSON.parse(stdout);
            const schema = output.result;
            assert.ok(schema.properties.str_var);
            assert.match(schema.title, /Simple YAML file/);
        });
    });
    describe('guiSchema', function () {
        it('should output gui-friendly template parameters schema', async function () {
            const { stdout } = await executeCommand(`guiSchema ${templateSimplePath}`);
            const schema = JSON.parse(stdout);
            assert.ok(schema.properties.str_var);
            assert.match(schema.title, /Simple YAML file/);
        });
        it('should support JSON output', async function () {
            const { stdout } = await executeCommand(`guiSchema --json-output ${templateSimplePath}`);
            const output = JSON.parse(stdout);
            const schema = output.result;
            assert.ok(schema.properties.str_var);
            assert.match(schema.title, /Simple YAML file/);
        });
    });
    describe('validateParameters', function () {
        it('should succeed on valid parameters', async function () {
            mktmpdir();
            const viewPath = path.join(tmpDir, 'view.json');
            fs.writeFileSync(viewPath, JSON.stringify({ str_var: 'bar' }));
            const { stdout } = await executeCommand(`validateParameters ${templateSimplePath} ${viewPath}`);
            assert.strictEqual(stdout, '');
        });
        it('should fail on invalid parameters', async function () {
            mktmpdir();
            const viewPath = path.join(tmpDir, 'view.json');
            fs.writeFileSync(viewPath, JSON.stringify({ str_var: 5 }));
            return executeCommand(`validateParameters ${templateSimplePath} ${viewPath}`)
                .then(() => assert(false, 'Expected command to fail'))
                .catch((e) => {
                    console.log(e);
                    assert.match(e.stderr, /parameters failed validation/);
                });
        });
        it('should support JSON output', async function () {
            mktmpdir();
            const viewPath = path.join(tmpDir, 'view.json');
            fs.writeFileSync(viewPath, JSON.stringify({ str_var: 'bar' }));
            const { stdout } = await executeCommand(`validateParameters --json-output ${templateSimplePath} ${viewPath}`);
            const output = JSON.parse(stdout);
            assert.strictEqual(output.result, '');
        });
        it('should support JSON error output', async function () {
            mktmpdir();
            const viewPath = path.join(tmpDir, 'view.json');
            fs.writeFileSync(viewPath, JSON.stringify({ str_var: 5 }));
            return executeCommand(`validateParameters --json-output ${templateSimplePath} ${viewPath}`)
                .then(() => assert(false, 'Expected command to fail'))
                .catch((e) => {
                    const output = JSON.parse(e.stdout);
                    console.log(output);
                    assert.match(output.error, /parameters failed validation/);
                    assert.deepStrictEqual(
                        output.templateParameters,
                        {
                            str_var: 5
                        }
                    );
                    assert.deepStrictEqual(
                        output.validationErrors,
                        [
                            { message: 'parameter str_var should be of type string' }
                        ]
                    );
                });
        });
    });
    describe('render', function () {
        it('should render template to stdout', async function () {
            const { stdout } = await executeCommand(`render ${templateSimplePath}`);
            assert.match(stdout, /foo/);
        });
        it('should fail on invalid parameters', async function () {
            mktmpdir();
            const viewPath = path.join(tmpDir, 'view.json');
            fs.writeFileSync(viewPath, JSON.stringify({ str_var: 5 }));
            return executeCommand(`render ${templateSimplePath} ${viewPath}`)
                .then(() => assert(false, 'Expected command to fail'))
                .catch((e) => {
                    console.log(e);
                    assert.match(e.stderr, /Failed to render template since parameters failed validation/);
                });
        });
        it('should support JSON output', async function () {
            const { stdout } = await executeCommand(`render --json-output ${templateSimplePath}`);
            const output = JSON.parse(stdout);
            assert.match(output.result, /foo/);
        });
        it('should support JSON error output', async function () {
            mktmpdir();
            const viewPath = path.join(tmpDir, 'view.json');
            fs.writeFileSync(viewPath, JSON.stringify({ str_var: 5 }));
            return executeCommand(`render --json-output ${templateSimplePath} ${viewPath}`)
                .then(() => assert(false, 'Expected command to fail'))
                .catch((e) => {
                    const output = JSON.parse(e.stdout);
                    console.log(output);
                    assert.match(output.error, /parameters failed validation/);
                    assert.deepStrictEqual(
                        output.templateParameters,
                        {
                            str_var: 5
                        }
                    );
                    assert.deepStrictEqual(
                        output.validationErrors,
                        [
                            { message: 'parameter str_var should be of type string' }
                        ]
                    );
                });
        });
    });
    describe('validateTemplateSet', function () {
        it('should succeed on valid template set', async function () {
            const { stdout } = await executeCommand(`validateTemplateSet ${templateSetDir}`);
            assert.strictEqual(stdout, '');
        });
        it('should fail on invalid template set', async function () {
            const invalidSetPath = path.join(__dirname, 'invalid_templatesets', 'invalid');
            return executeCommand(`validateTemplateSet ${invalidSetPath}`)
                .then(() => assert(false, 'Expected command to fail'))
                .catch((e) => {
                    console.log(e);
                    assert.match(e.stderr, /Template .* failed validation/);
                });
        });
        it('should support JSON output', async function () {
            const { stdout } = await executeCommand(`validateTemplateSet --json-output ${templateSetDir}`);
            const output = JSON.parse(stdout);
            assert.strictEqual(output.result, '');
        });
        it('should support JSON error output', async function () {
            const invalidSetPath = path.join(__dirname, 'invalid_templatesets', 'invalid');
            return executeCommand(`validateTemplateSet --json-output ${invalidSetPath}`)
                .then(() => assert(false, 'Expected command to fail'))
                .catch((e) => {
                    const output = JSON.parse(e.stdout);
                    console.log(output);
                    assert.match(output.error, /Template set .* failed validation/);
                    assert.match(output.errors[0].message, /Template .* failed validation/);
                    assert.match(output.errors[0].validationErrors[0].message, /invalid template text/);
                });
        });
    });
    describe('htmlpreview', function () {
        it('should generate a static HTML page to stdout', async function () {
            const { stdout } = await executeCommand(`htmlpreview ${templateSimplePath}`);
            assert.match(stdout, /doctype html/);
        });
        it('should support JSON output', async function () {
            const { stdout } = await executeCommand(`htmlpreview --json-output ${templateSimplePath}`);
            const output = JSON.parse(stdout);
            assert.match(output.result, /doctype html/);
        });
    });
    describe('packageTemplateSet', function () {
        it('should create a package for the given template set', async function () {
            mktmpdir();
            const pkgpath = path.join(tmpDir, 'pkg.zip');
            const { stdout } = await executeCommand(`packageTemplateSet ${templateSetDir} ${pkgpath}`);
            assert.match(stdout, /Template set "test" packaged as .*\/pkg.zip/);
        });
        it('should support JSON output', async function () {
            mktmpdir();
            const pkgpath = path.join(tmpDir, 'pkg.zip');
            const { stdout } = await executeCommand(`packageTemplateSet --json-output ${templateSetDir} ${pkgpath}`);
            const output = JSON.parse(stdout);
            assert.match(output.result, /Template set "test" packaged as .*\/pkg.zip/);
        });
    });
});
