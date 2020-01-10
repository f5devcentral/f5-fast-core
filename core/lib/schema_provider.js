'use strict';

const fs = require('fs');

const ResourceCache = require('./io_util.js').ResourceCache;

function FsSchemaProvider(schemaRootPath) {
    this.schema_path = schemaRootPath;
    this.cache = new ResourceCache(schemaName => new Promise((resolve, reject) => {
        fs.readFile(`${schemaRootPath}/${schemaName}.json`, (err, data) => {
            if (err) reject(err);
            else {
                resolve(data.toString('utf8'));
            }
        });
    }));

    return this;
}

FsSchemaProvider.prototype.fetch = function fetch(key) {
    return this.cache.fetch(key);
};

// used for listing AS3 templates available
FsSchemaProvider.prototype.schemaList = function schemaList() {
    return new Promise((resolve, reject) => {
        fs.readdir(this.schema_path, (err, data) => {
            if (err) reject(err);

            const list = data.filter(x => x.endsWith('.json'))
                .map(x => x.split('.')[0]);
            resolve(list);
        });
    });
};

module.exports = {
    FsSchemaProvider
};