# Module API

## Simple Loading

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

> **Note:** If the example above were saved in a file named simpleLoading.js, then you could run it from the CLI with this command: `node simpleLoading.js`

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

## Loading with Type Schema

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


## Using a TemplateProvider

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

> **Note:** Despite loading a single template set, a template set name must still be provided when querying the provider.


## Template Data Files

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
