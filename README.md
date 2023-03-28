![Pipeline](https://github.com/f5devcentral/f5-fast-core/workflows/Pipeline/badge.svg)
![npm](https://img.shields.io/npm/dw/@f5devcentral/f5-fast-core)
![NPM](https://img.shields.io/npm/l/@f5devcentral/f5-fast-core?registry_uri=https%3A%2F%2Fregistry.npmjs.com)

# F5 Application Services Templates (FAST) SDK

This module provides a framework for handling templates.

## Features

* Parses Mustache templates and an extended template format (in YAML)
* Generates a parameter schema from parsed template data
* Supports Mustache partials and sections
* Renders templates with user-provided parameters
* Validates user-provided parameters against generated parameter schema
* Includes a [command line interface](docs/getting_started.md#cli)

## Installation

To install this module run:

```bash
npm install @f5devcentral/f5-fast-core
```

## Development

* To check for lint errors run `npm run lint` 
* To run unit tests use `npm test`

Both of these are run as part of the CI pipeline for this repo.

## License

[Apache License 2.0](https://choosealicense.com/licenses/apache-2.0/)

## Copyright

Copyright 2014-2020 F5 Networks Inc.


### F5 Networks Contributor License Agreement

Before you start contributing to any project sponsored by F5 Networks, Inc. (F5) on GitHub, you will need to sign a Contributor License Agreement (CLA).

If you are signing as an individual, we recommend that you talk to your employer (if applicable) before signing the CLA since some employment agreements may have restrictions on your contributions to other projects.
Otherwise by submitting a CLA you represent that you are legally entitled to grant the licenses recited therein.

If your employer has rights to intellectual property that you create, such as your contributions, you represent that you have received permission to make contributions on behalf of that employer, that your employer has waived such rights for your contributions, or that your employer has executed a separate CLA with F5.

If you are signing on behalf of a company, you represent that you are legally entitled to grant the license recited therein.
You represent further that each employee of the entity that submits contributions is authorized to submit such contributions on behalf of the entity pursuant to the CLA.
