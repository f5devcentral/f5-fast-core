'use strict';

const dataStores = require('@f5devcentral/atg-storage');

const FsSchemaProvider = require('./lib/schema_provider').FsSchemaProvider;
const { FsTemplateProvider, DataStoreTemplateProvider } = require('./lib/template_provider');
const { Template, mergeStrategies, postProcessStrategies } = require('./lib/template');
const httpUtils = require('./lib/http_utils');
const guiUtils = require('./lib/gui_utils');
const TransactionLogger = require('./lib/transaction_logger');

module.exports = {
    FsSchemaProvider,
    FsTemplateProvider,
    DataStoreTemplateProvider,
    Template,
    mergeStrategies,
    httpUtils,
    guiUtils,
    dataStores,
    TransactionLogger
};
