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
