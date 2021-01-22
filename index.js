/* Copyright 2021 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const dataStores = require('@f5devcentral/atg-storage');

const FsSchemaProvider = require('./lib/schema_provider').FsSchemaProvider;
const { FsTemplateProvider, FsSingleTemplateProvider, DataStoreTemplateProvider } = require('./lib/template_provider');
const { Template, mergeStrategies, postProcessStrategies } = require('./lib/template');
const guiUtils = require('./lib/gui_utils');
const TransactionLogger = require('./lib/transaction_logger');

module.exports = {
    FsSchemaProvider,
    FsTemplateProvider,
    FsSingleTemplateProvider,
    DataStoreTemplateProvider,
    Template,
    mergeStrategies,
    postProcessStrategies,
    guiUtils,
    dataStores,
    TransactionLogger
};
