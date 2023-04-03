# Getting Started

## CLI

A command line interface is provided via a `fast` binary.

FAST can render a basic template with the CLI. Here is an example using a template file named hello.yaml:
```yaml
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
```

With this command to render the template:
```bash
fast render hello.yaml
```

For help, like the text provided below, is also accessed via `fast --help`:


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

## ContentTypes

When FAST renders it is doing string replacement via Mustache, which is agnostic to the output type. However, specifying a contentType in the template can enable some additional features:

* Post-processing steps (e.g., strip dangling commas for JSON)
* Smarter merges
* Smarter handling of some data types
