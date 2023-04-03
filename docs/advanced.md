# Advanced Features

This page offers more advanced features that do not appear in other related documentation for FAST Core.

## HTTP Fetch

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

## HTTP Forward

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

## HTTP Calls to External Resources
Some template parameters may be sourced from other places, such as external APIs or databases.

A Template.fetchHttp() method does an HTTP request for each parameter definition that has a url property returning a parameter object with the response results. The value used from a response can be altered by specifying a JSONPath query in an optional pathQuery property of the parameter definition. url can also be an object matching Node’s http.request() options object.
```yaml
type: object
properties:
  url:
    description: HTTP resource to call to fetch data.
      oneOf:
        - type: string
        - type: object # looks like Node request options
  pathQuery:
    type: string
    description: JSONPath of data to be fetched, must match schema
```

## Calculating Template Set Hashes

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

>**Note:**  Despite loading a single template set, a template set name must still be provided when querying the provider.
