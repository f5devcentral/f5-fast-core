# v0.6.0
## Added
* Expose Template mergeStrategies in index.js
* Cache GET requests to AS3 declare endpoint

## Fixed

## Changed

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
