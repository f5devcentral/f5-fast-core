# v0.8.0
## Added
* Support extended user types (e.g., "var:lib:type") for sections and partials
* Add post-processing strategies and add one for 'application/json' to cleanup dangling commas
* cli: Add guiSchema sub command that runs the parameters schema through guiUtils.modSchemaForJSONEditor() before displaying it

## Fixed
* template: Fix using full Mustache variable names (e.g., "var:lib:type") for dependencies and requires
* guiUtils: Additional fixes for allOf schema in modSchemaForJSONEditor()
* Fix sections with a dot item overriding user definitions
* Add missing doc strings for  HTTP fetching and forwarding functions 
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
