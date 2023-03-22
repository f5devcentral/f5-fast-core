![Pipeline](https://github.com/f5devcentral/f5-fast-core/workflows/Pipeline/badge.svg)
![npm](https://img.shields.io/npm/dw/@f5devcentral/f5-fast-core)
![NPM](https://img.shields.io/npm/l/@f5devcentral/f5-fast-core?registry_uri=https%3A%2F%2Fregistry.npmjs.com)

# F5 Application Services Templates (FAST) SDK

This module provides a framework for handling templates.

## Features

* Parses Mustache templates and an extended template format (in YAML)
* Generates a view schema from parsed template data
* Supports Mustache partials and sections
* Renders templates with user-provided views
* Validates user-provided views against generated view schema
* Includes a [command line interface](#cli)

## Installation

To install this module run:

```bash
npm install @f5devcentral/f5-fast-core
```

## CLI

A command line interface is provided via a `fast` binary.
The help text is provided below and also accessed via `fast --help`:


```
fast <command>

Commands:
  fast validate <file>                                validate given template source file
  fast schema <file>                                  get template parameter schema for given template source file
  fast guiSchema <file>                               get template parameter schema (modified for use with JSON Editor) for given template source file
  fast validateParameters <tmplFile> <parameterFile>  validate supplied template parameters with given template
  fast render <tmplFile> [parameterFile]              render given template file with supplied parameters
  fast validateTemplateSet <templateSetPath>          validate supplied template set
  fast htmlpreview <tmplFile> [parameterFile]         generate a static HTML file with a preview editor to standard out
  fast packageTemplateSet <templateSetPath> [dst]     build a package for a given template set

Options:
  --help     Show help                                                                                         [boolean]
  --version  Show version number                                                                               [boolean]
```

For more information on a given command use the `--help` flag combined with a command:

```bash
fast <command> --help
```

The CLI can also be accessed by executing `cli.js`.
For example:

```bash
./cli.js render path/to/template
```

## Authoring Templates

Documentation on how to write FAST templates can be found [here](https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/userguide/json-schema.html).

## Module API

### Simple Loading

Below is a basic example for loading a template without any additional type schema:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const yamldata = `
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

fast.Template.loadYaml(yamldata)
    .then((template) => {
        console.log(template.getParametersSchema());
        console.log(template.render({message: "Hello world!"}));
    });
```

If a `Template` has been serialized to JSON (e.g., to send in an HTTP request), it can be deserialized with `Template.fromJson()`:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const yamldata = `
    template: |
        {{message}}
`;

fast.Template.loadYaml(yamldata)
    .then(template => JSON.stringify(template))
    .then(jsonData => template.fromJson(jsonData))
    .then((template) => {
        console.log(template.getParametersSchema());
        console.log(template.render({message: "Hello world!"}));
    });
```

`Template` does not provide a mechanism for loading a template from a file and, instead, needs to be paired with something like Node's `fs` module:

```javascript
const fs = require('fs');
const fast = require('@f5devcentral/f5-fast-core');

const yamldata = fs.readFileSync('path/to/file', 'utf8');

fast.Template.loadYaml(yamldata)
    .then((template) => {
        console.log(template.getParametersSchema());
        console.log(template.render({message: "Hello world!"}));
    });
```

### Loading with Type Schema

To support user-defined types, a `SchemaProvider` must be used.
The `FsSchemaProvider` can be used to load schema from disk:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const templatesPath = '/path/to/templatesdir'; // directory containing types.json
const schemaProvider = new fast.FsSchemaProvider(templatesPath);
const yamldata = `
    template: |
        {{virtual_port:types:port}}
`;

fast.Template.loadYaml(yamldata, schemaProvider)
    .then((template) => {
        console.log(template.getParametersSchema());
        console.log(template.render({virtual_port: 443});
    });
```

### Using a TemplateProvider

A higher-level API is available for loading templates via `TemplateProvider` classes.
These classes will handle calling the correct load function (`Template.loadYaml()` vs `Template.loadMst()`) and can also automatically handle additional schema files.
For example, to load "templates sets" (a directory containing template files) from a given directory, the `FsTemplateProvider` class can be used:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const templateSetsPath = '/path/to/templateSetsDir';
const templateProvider = new fast.FsTemplateProvider(templateSetsPath);

templateProvider.fetch('templateSetName/templateName')
    .then((template) => {
        console.log(template.getParametersSchema());
        console.log(template.render({
            var: "value",
            boolVar: false
        }));
    });
```

If only a subset of the directories should be loaded as template sets, `FsTemplateProvider` provides an option to filter directories:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const templateSetsPath = '/path/to/templateSetsDir';
const setsToLoad = ['foo', 'bar'];
const templateProvider = new fast.FsTemplateProvider(templateSetsPath, setsToLoad);

templateProvider.fetch('templateSetName/templateName')
    .then((template) => {
        console.log(template.getParametersSchema());
        console.log(template.render({
            var: "value",
            boolVar: false
        }));
    });
```

A `FsSingleTemplateProvider` is provided as convenience for loading a single template set (instead of a directory of template sets):

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const templateSetPath = '/path/to/templateSet';
const templateProvider = new fast.FsSingleTemplateProvider(templateSetPath);

templateProvider.fetch('templateSet/templateName')
    .then((template) => {
        console.log(template.getParametersSchema());
        console.log(template.render({
            var: "value",
            boolVar: false
        }));
    });
```

Calculate the hash of a local Template Set with  `FsSingleTemplateProvider` like this:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const templateSetPath = '/path/to/templateSet';
const templateProvider = new fast.FsSingleTemplateProvider(templateSetPath);

templateProvider.getSetData('templateSetName')
    .then((tsData) => {
        console.log(tsData.hash)
    });
```

Note that despite loading a single template set, a template set name must still be provided when querying the provider.

### HTTP Fetch

To resolve external URLs in templates, a `Template.fetchHttp()` is available.
This will take any definition with a `url` property, resolve it, and return an object of the results.

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const yamldata = `
    definitions:
        var:
            url: http://example.com/resource
            pathQuery: $.foo
    template: |
        {{var}}
`;

fast.Template.loadYaml(yamldata)
    .then(template => Promise.all[(
        Promise.resolve(template),
        () => template.fetchHttp()
    )])
    .then(([template, httpParams]) => {
        console.log(template.render(httpParams));
    });
```

A `Template.fetchAndRender()` convenience function is also available to do fetchHttp() and render() in a single function call.

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const yamldata = `
    definitions:
        var:
            url: http://example.com/resource
            pathQuery: $.foo
    template: |
        {{var}}
`;

fast.Template.loadYaml(yamldata)
    .then(template => template.fetchAndRender())
    .then((rendered) => {
        console.log(rendered);
    });
```

### HTTP Forward

It is common to want to submit the rendered template result to an HTTP endpoint.
`f5-fast-core` makes this simpler with `Template.forwardHttp()`.
This function will:

* Resolve external URLs with `Template.fetchHttp()`
* Render the template result
* Forward the rendered result as a `POST` (by default) to the endpoint defined by the template's `httpForward` property

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const yamldata = `
    httpForward:
        url: http://example.com/resource
    definitions:
        var:
            default: foo
    template: |
        {{var}}
`;

fast.Template.loadYaml(yamldata)
    .then(template => template.forwardHttp()); // POST "foo" to http://example.com/resource
```

### Template Data Files

Sometimes it is desirable to keep a portion of a template in a separate file and include it into the template text.
This can be done with parameters and the `dataFile` property:

```javascript
const fast = require('@f5devcentral/f5-fast-core');

const templatesPath = '/path/to/templatesdir'; // directory containing example.data
const dataProvider = new fast.FsDataProvider(templatesPath);
const yamldata = `
    definitions:
        var:
            dataFile: example
    template: |
        {{var}}
`;

fast.Template.loadYaml(yamldata, { dataProvider })
    .then((template) => {
        console.log(template.getParametersSchema());
        console.log(template.render({virtual_port: 443});
    });
```
The `FsDataProvider` will pick up on any files with the `.data` extension in the template set directory.
When referencing the file in a template, use the filename (without the extension) as a key.

Parameters with a `dataFile` property:

* are removed from `required`
* have their `default` set to the contents of the file
* given a default `format` of `hidden`

Additionally, the contents of the data file can be base64-encoded before being used as for `default` by setting the `toBase64` property to `true`:

```yaml
definitions:
    var:
        dataFile: example
        toBase64: true
    template: |
        {{var}}
```

Similarly, if the data file is base64-encoded, it can be decoded using `fromBase64`.
If both `toBase64` and `fromBase64` are set, then `toBase64` takes precedence.

## Development

* To check for lint errors run `npm run lint` 
* To run unit tests use `npm test`

Both of these are run as part of the CI pipeline for this repo.

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)

## Copyright

Copyright 2014-2020 F5 Networks Inc.


### F5 Networks Contributor License Agreement

Before you start contributing to any project sponsored by F5 Networks, Inc. (F5) on GitHub, you will need to sign a Contributor License Agreement (CLA).

If you are signing as an individual, we recommend that you talk to your employer (if applicable) before signing the CLA since some employment agreements may have restrictions on your contributions to other projects.
Otherwise by submitting a CLA you represent that you are legally entitled to grant the licenses recited therein.

If your employer has rights to intellectual property that you create, such as your contributions, you represent that you have received permission to make contributions on behalf of that employer, that your employer has waived such rights for your contributions, or that your employer has executed a separate CLA with F5.

If you are signing on behalf of a company, you represent that you are legally entitled to grant the license recited therein.
You represent further that each employee of the entity that submits contributions is authorized to submit such contributions on behalf of the entity pursuant to the CLA.
