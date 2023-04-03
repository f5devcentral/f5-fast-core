# Overlaid Definitions

The way BIG-IP FAST generates parameter definitions can be surprising at times if that parameter shows up multiple times in the template text.

When generating parameter definitions, BIG-IP FAST looks at the following locations in the following order, with later definitions overriding/modifying previous ones:
1. Embedded mustache tags in any merged templates.  For example: {{var:f5:port}}
2. The definitions properties of any merged templates. Templates are merged by name using $ref inside a oneOf, anyOf, or allOf clause.
3. Embedded mustache tags in the primary template.
4. The definitions property in the primary template.
5. The parameters property in any merged templates.
6. The parameters property in the primary template.

#### Notes:
* If a duplicate Mustache tag exists in the template, then the last encountered tag is used for the definition. The order that Mustache tags are parsed in should not be assumed.
* Properties within the definition (e.g., title, description, type, format, default, etc.) are merged together as they are found with newer data taking precedence over old data on key conflicts.
* Values from the parameters property of YAML templates will be used in place of the default from the parameter definition but will not actually update the definition itself.


# JSON Schema Basic Types

## Definitions
Users can control the JSON Schema that FAST generates for parameters by providing parameter `definitions.`
These definitions are added to the top-level definitions property of a template file.

In the following example, we have a Template with a definition for ip addresses, named ip_addrs.yaml:
```yaml
definitions:
  ip_addrs:
    type: array
    items:
      type: string,
      format: ipv4
```

And we can add that to the top-level of another template with this Template:
```yaml
allOf:
  - $ref: "ip_addrs.yaml#"
definitions:
  ports:
    type: array
      items:
        type: integer
template: 
  Services:
  {{#ip_addrs}}
    {{ . }}{{#ports}}:{{ . }}{{/ports}}
  {{/ip_addrs}}
```

Parameters:
```yaml
    ip_addrs:
      - 10.0.0.1
      - 10.0.0.2
    ports:
      - 80
      - 443
```

Output:
```
  Services:
    10.0.0.1:80
    10.0.0.1:443
    10.0.0.2:80
    10.0.0.2:443  
```

> **See Also:** [JSON Editor: $ref and definitions](https://github.com/json-editor/json-editor#ref-and-definitions) for additional code examples.

**Array:** Arrays are used for ordered elements.
In JSON, each element in an array may be of a different type. 
Elements of the array may be ordered or unordered based on the API being templated. 
This section covers typical JSON schema definitions for common patterns.

For example, ip_addrs is defined with a type: array having items defined with type: string and format: ipv4 (more on formats later).

```yaml
definitions:
  ip_addrs:
    type: array
    items:
      type: string,
      format: ipv4
```

**Numeric Types:** JSON has two numeric types; integer and number.
An integer is used for integral (whole) numbers, while a number is any numerical value including integers and floating-point (decimal) numbers.

**Ranges:** Combining minimum and maximum keywords for ranges or exclusiveMinimum and exclusiveMaximum for expressing exclusive ranges. 
The example below defines the range of port numbers as type: integer.

```yaml
type: integer
minimum: 0
maximum: 65535
```

Another example is combining minimum and exclusiveMaximum. 
When using a minimum range of 0, then 0 is valid. 
With an exclusiveMaximum of 65535, 65534 is valid while 65535 is not.

```yaml
type: number
minimum: 0
exclusiveMaximum: 65535
```

**String:** The string type is used for strings of text and may contain Unicode characters. 
The length of a string may be constrained using minLength and maxLength which cannot be a negative number.

```yaml
type: string
minLength: 2
maxLength: 5
```

Along with the string type, JSON has some built in formats, using the format keyword. 
This allows for basic validation and can be used for certain strings such as IPv4 and IPv6 addressing.

Regular Expressions (regexes) are used to match and extract parts of a string by searching for one or more matches of a search pattern.
This example matches numbers from 0 and 255. 
String zeroTo255 = "([01]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])"

The string consists of three groups separated with a pipe.
1. [01]?[0-9]{1,2} - Matches any number between 0 and 199. [01]?: 0 or 1 may appear at most once at front of the number. [0-9]{1,2}: digits 0 to 9 may appear exactly once or twice on the 2nd or 3rd position in the number.
2. 2[0-4][0-9] - Matches numbers between 200 and 249, where the first digit is always 2, the second is between 0 and 4, and the third digit is any between 0 and 9,
3. 25[0-5]: (the 3rd group) matches numbers between 250 and 255, where 25 is always at front and the third digit is between 0 and 5.

> **See Also:** JSON schema [Built-in Formats](https://json-schema.org/understanding-json-schema/reference/string.html?highlight=maxlength#built-in-formats) and [Regular Expressions](https://json-schema.org/understanding-json-schema/reference/string.html#id6) for more information.

**Boolean:** The boolean type { type: boolean } matches two values; true or false and must be used in all lower case characters.


# Combining Schema
JSON uses the keywords allOf, anyOf and oneOf for combining schema together.
BIG-IP FAST also uses they keywords of oneOf/allOf/anyOf for template merging, however this section is focused on JSON schema.

**anyOf:** One or more of the contained schema is validated against the instance value.
It is less restrictive than allOf as more than one of the same type may be specified.

```javascript
{
    "anyOf": [
        { "type": "string" },
        { "type": "number" }
    ]
}
```

**oneOf:** Validates against exactly one subschema even though multiple instances listed.
For example, if multipleOf is set to 5 and 3, validation will pass on 10 and 9, but will fail on 2 as neither 5 nor 3 are multiples of 2.
It will also fail on 15 as it is a multipleOf both 5 and 3 not oneOf.

```javascript
{
    "oneOf": [
        { "type": "number", "multipleOf": 5 },
        { "type": "number", "multipleOf": 3 }
    ]
}
```

**allOf:** All of the contained schemas must validate against the instance value.

```javascript
{
    "allOf": [
        { "type": "string" },
        { "maxLength": 5 }
    ]
}
```

> **Note:** When using allOf, be cautious of specifying multiple types such as `{ type: string }` and `{ type: number }` as a type cannot be a string and a number at the same time.

When authoring templates using yaml, allOf takes on a special meaning by referencing another template in the set, known as Template Merging.
* allOf will merge the schema of the merge template with external template(s) just as JSON schema will when generating schema for the merged templates
* When a merge template is rendered, the JSON output of the templates will be merged together
* Merge can be used to add additional configuration to a template

```yaml
parameters:
    ...
definitions:
    ...
template: |
    ...
allOf:
    - $ref: "tcp.yaml#"
```

> **See Also:** For detailed information, additional code examples and references, visit [Understanding JSON Schema](https://json-schema.org/understanding-json-schema/index.html)

