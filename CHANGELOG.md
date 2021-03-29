# v0.12.0
## Added
* template: Allow using a TemplateProvider to resolve external JSON references

## Fixed

## Changed
* Update Ajv dependency to 7.x
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
