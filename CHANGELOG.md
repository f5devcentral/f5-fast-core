# v0.22.1
## Fixed
* template: Fix "paramters" typo in validateParameters() error

# v0.22.0
## Added
* cli: Add --json-output flag to change all output to JSON

## Changed
* template: Change the Error message from validateParameters() to be simpler
* template: Move validation errors and parameters from the validateParameters() Error message string to validationErrors and parameters properties on the Error object
* template: Show all validation errors when calling validateParameters()
* template: Parse the Ajv validation errors from validateParameters() and create easier to read/understand error messages

# v0.21.0
## Added
* template: Allow customizing input transform behavior via fast.transformStrategies

## Fixed
* Fix undefined fast.postProcessStrategies
* template: Fix using an object parameter as input to a section

## Changed
* template: JsonTransformStrategy is now only used for 'application/json' contentType

# v0.20.2
## Fixed
* Add CompositeTemplateProvider to index

# v0.20.1
## Changed
* Locked json-schema-ref-parser dependency to 9.0.9 (9.1.x is breaking template loading)

# v0.20.0
## Added
* Add a CompositeTemplateProvider to aggregate results from multiple template providers

## Changed
* Update dependencies

# v0.19.1
## Changed
* Update dependencies

# v0.19.0
## Added
* template: Add dataFile parameter property for including arbitrary text from files

## Fixed
* Fix loading sub-templates with GitHubTemplateProvider

# v0.18.0
## Added
* Add a GitHubSchemaProvider and GitHubTemplateProvider

## Changed
* Updated dependencies
* Stop pulling in pkg as a dev dependency
* Expose BaseTemplateProvider class

# v0.17.0
## Fixed
* guiUtils: Prefer defaults from top-level templates when merging allOf templates
* template: Fix duplicate items in required property when merging sections (issue #23)

# v0.16.0
## Fixed
* schema_provider: Fix loading schema files with a '.' in the filename 
* template: Fix parameters from Mustache sections getting listed as required even if they have a default value
* guiUtils: Fix merging nested mixins

# v0.15.0
## Changed
* template: Merge duplicate section definitions instead of overwriting

# v0.14.0
## Fixed
* template: Fix merging array items definitions with custom types
* template: Fix over-aggressive cleaning of definitions referenced in "items" keyword
* template: Fix losing definitions from merged in templates
* template: Fix missing description when merging templates

## Changed
* ResourceCache: Improve cache utilization for concurrent requests
* template: Do not mark properties with defaults as required
* template: Do not automatically supply default values for primitive types

# v0.13.0
## Added
* TemplateProvider: Return template description and title with getSetData()

# v0.12.0
## Added
* template: Allow using a TemplateProvider to resolve external JSON references

## Fixed
* TemplateProvider: Fix template sets with matching prefixes from getting listed together

## Changed
* Update js-yaml dependency to 4.x
* Switch from archiver to adm-zip to reduce transitive dependencies
* Remove uuid dependency
* Remove json-schema-merge-allof dependency

# v0.11.0
## Added
* template: Allow overriding automatic dependencies with definitions

## Fixed
* guiUtils: Fix merging dependencies when collapsing allOf items
* template: Fix merging dependencies when using partials

## Changed
* Updated dependencies

# v0.10.0
## Added

## Fixed
* template: Fix duplicate allOf property
* template: Fix gathering tokens for mathExpressions on merged templates

## Changed
* template: Skip creating unused parameter validators on merged-in templates
* guiUtils: Remove hidden mathExpression parameters from the GUI schema
* htmlpreview: Pull JSON Editor from a CDN
* cli: Display errors for each template when using validateTemplateSet

# v0.9.0
## Added
* template: Add better support for JSON Editor "info" format
* template_provider: Add FsSingleTemplateProvider convenience class to load a single template set
* template: Add support for YAML contentType (text/x-yaml, application/x-yaml, and application/yaml are all accepted)
* template: Add support for calculating parameter values from arithmetic expressions

## Fixed
* guiUtils: Fix "No resolver found for key propertyOrder" error when collapsing multiple allOf items
* guiUtils: Fix "No resolver found for key invertDependency" when collapsing allOf items
* template: Fix for duplicate items in dependencies
* template: Fix running JSON and YAML post-process strategies on empty strings

## Changed
* Switch from internal httpUtils library to axios (httpUtils has also been removed)
* template: Prefer defaults from the current template over merged in templates
* template: Allow definitions to override values in merged templates even if the parameters are not present in the template text
* template: Significantly reduce the size of the Template object
* template: Remove typeDefinitions from the public API
* template: Prune unused definitions (Template.definitions no longer contains the original definitions from the template file)

# v0.8.0
## Added
* template: Support extended user types (e.g., "var:lib:type") for sections and partials
* template: Add post-processing strategies and add one for 'application/json' to cleanup dangling commas
* cli: Add guiSchema sub command that runs the parameters schema through guiUtils.modSchemaForJSONEditor() before displaying it

## Fixed
* template: Fix using full Mustache variable names (e.g., "var:lib:type") for dependencies and requires
* template: Fix sections with a dot item overriding user definitions
* template: Add missing doc strings for  HTTP fetching and forwarding functions
* template: Fix missing defaults from merged templates
* guiUtils: Additional fixes for allOf schema in modSchemaForJSONEditor()
* guiUtils: Do not error if a dependency is missing from the properties

## Changed
* cli: Run fetchHttp() as part of render command
* guiUtils: modSchemaForJSONEditor() no longer modifies in place

# v0.7.0
## Added
* Add jsdoc-style docs to classes mentioned in the README
* Add option to get variable values from HTTP requests
* Add Template.forwardHttp() to forward a rendered template result to an HTTP server

## Fixed
* Improve guiUtils.filterExtraProperties() when using template merging
* guiUtils: Improve form render order when using allOf

## Changed
* guiUtils: Use JSON Editor 'select' format for arrays of unique enum items
* guiUtils: Flatten allOf schema in modSchemaForJSONEditor
* template: Return an empty array instead of undefined when transforming an undefined array

# v0.6.0
## Added
* Expose Template mergeStrategies in index.js
* Cache GET requests to AS3 declare endpoint
* Add "responses" information from AS3 tasks to FAST tasks
* Add operation information (e.g., update vs delete) to FAST tasks
* Merge definitions and default parameters from base templates
* Save additional, top-level properties found on YAML templates

## Fixed
* Missing type schema when merging templates

## Changed
* Move empty-string checks out of template merge strategies
* Remove AS3Driver

# v0.5.1
## Fixed
* Bad reference to atg-storage

# v0.5
## Added
* CLI: Support YAML for parameter files
* AS3 driver: Add deleteApplications() function
* Support combining templates via oneOf/allOf/anyOf
* Support $ref in template definitions (http $refs are not supported)

## Fixed

## Changed
* Report a better error message when Ajv fails to compile a schema
* Improve error reporting in the CLI

# v0.4
Initial, independent release (previously part of [f5-appsvcs-templates](https://github.com/F5networks/f5-appsvcs-templates))
