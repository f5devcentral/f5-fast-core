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

class ResourceCache {
    constructor(asyncFetch) {
        // used for caching AS3 TemplateEngine objects
        this.cached = {};
        this.cache_limit = 100;
        this.asyncFetch = asyncFetch;
    }

    fetch(key) {
        return (() => {
            if (!this.cached[key]) {
                this.cached[key] = this.asyncFetch(key)
                    .then((resource) => {
                        this.cached[key] = resource;
                        const allKeys = Object.keys(this.cached);
                        const oldestKey = allKeys.shift();
                        if (allKeys.length > this.cache_limit) delete this.cached[oldestKey];
                        return resource;
                    });
            }
            return Promise.resolve(this.cached[key]);
        })();
    }

    invalidate() {
        this.cached = {};
    }
}

module.exports = {
    ResourceCache
};
