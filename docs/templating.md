# Templating with F5 BIG-IP FAST

This chapter is dedicated to explaining the relationship of schema vs templates. BIG-IP FAST makes use of Mustache, JSON schema and JSONPath, therefore BIG-IP FAST may be familiar if you already understand any of these syntaxes. BIG-IP FAST combines these technologies to provide a complete templating solution. At the foundation, BIG-IP FAST uses a templating specification called mustache to convert parameters into a fully rendered API body. Parameter types can be specified in JSON schema, and are used to validate template inputs when the template is rendered. BIG-IP FAST will auto generate a schema for each template based off the template and json-schema provided. Schema is generated from template text, combined with definitions, and used to validate template parameters.

## Mustache
Mustache is not the templating engine. Mustache is a specification for a templating language, and it specifies how the template file must look. You write templates adhering to the Mustache specification, and it works by expanding tags in a template using values provided in a hash or object. The template is then rendered to create an output.

## Tags
Tags are easily identifiable by the double mustache of opening and closing curley braces {{ }}. The most basic type of tag is a variable. When Mustache process the template it passes an object or hash containing the variable name and associated values. A {{tenant}} tag in a template renders the value of the tenant key.

## Sections
For iterating over a list of data, we make use of Mustache sections.
Sections render blocks of text zero or more times, depending on the value of the key in the current context.
A section begins with a pound and ends with a slash. That is, {{#person}} begins a “person” section while {{/person}} ends it.
The behavior of the section is determined by the value of the key.
Using the person section example from above, 2 types of lists can be created: Empty List or Non-Empty List.

### False Values or Empty Lists

If the person key exists, and has a value of false, or an empty list, the text between the pound and slash will not be displayed. In the following example, person has a `parameter: false`, therefore RED will not be displayed, resulting in the `Rendered Output: BLUE`.
```yaml
{{#person}}
    "RED"],
{{/person}
{{^person}}
    "BLUE",
{{/person}}
```

Parameters:
```yaml
person: false
```

Output:
```
BLUE
```

### Non-Empty Lists
When the value is a non-empty list, the text in the block will be displayed once for each item in the list. The context of the block will be set to the current item for each iteration. In this way we can loop over collections.

Template:
```yaml
{{#repo}}
     <b>{{name}}</b>
{{/repo}}
  "repo": [
  { "name": "resque" },
  { "name": "hub" },
  { "name": "rip" }
 ]
}
```

Outputs:
```
<b>resque</b>
<b>hub</b>
<b>rip</b>
```

> **See Also:** [Mustache Manual](https://mustache.github.io/mustache.5.html) for more information on Sections.


## Partials
Along with sections, Mustache utilizes partials. Mustache partials can be thought of as a way to insert template snippets. The syntax for including a partial uses curley braces and an angle bracket {{> }}.

For BIG-IP FAST, a partial definition must contain template text, i.e., define a template property
```yaml
definitions:
  partialDef:
    template: |
      {{#useVar}}
        {{var}}
      {{/useVar}}
  useVar:
    type: boolean
  template: |
  {{> partialDef}}
  {{> partialDef}}
```

Parameters:
```yaml
{
    "useVar": true,
    "var": "sample"
}
```

Outputs:
```yaml
    sample
    sample
```

> **See Also:** [Mustache Manual](https://mustache.github.io/mustache.5.html) for more information on Partials.


# Template Data Files

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

# Base64 Encoding
Using the GUI, BIG-IP FAST has the ability to encode template parameters as base64, which becomes part of the template output (AS3 declaration).
iRules are a common use case, however AS3 supports base64 for a wide range of objects.

In the following example, base64var will display as editable plain text but render as base64-encoded text:
```yaml
contentType: application/json
definitions:
    base64var:
        type: string
        format: text
        contentEncoding: base64
        default: ZmRhZWVhZWZl # will display as plain text in the GUI
template: |
  {
    "data": {{base64var}}
  }
```

> **See Also:** [AS3 Schema Reference](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html) for a full list of f5base64 fields.


# Enumerated Type
An Enumerated Type (enum) is a list of constant values. In order for the property to be valid, it must match an item in the list of values. As it relates to BIG-IP, it is a mechanism to pull data from the BIG-IP (enumFromBigip) presenting it as an enum.

An example usage would be to create drop-down lists. The path on BIG-IP: `/mgmt/tm/${enumFromBigip}?$select=fullPath`

> **See Also:** [BIG-IP FAST Appendix D: Endpoint List](https://clouddocs.f5.com/products/extensions/f5-appsvcs-templates/latest/userguide/endpoint-list.html#endpoint-list) for a list of BIG-IP endpoints.

(enumFromBigip) supports filtering of BIG-IP metadata based on provided regex: 
```yaml
definitions:
http_profile_name:
title: HTTP Profile description: Select an existing BIG-IP HTTP profile. enumFromBigip:

path: ltm/profile/http filter:

name: “^example_”

default: “/Common/http”
```