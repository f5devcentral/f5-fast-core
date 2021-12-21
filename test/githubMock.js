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

const fs = require('fs');
const nock = require('nock');

function nockGitHubAPI(repo, filesPath) {
    const gatherFiles = (dir, root) => {
        const files = [];
        const dirs = fs.readdirSync(dir, { withFileTypes: true });
        dirs.forEach((d) => {
            const entryPath = `${dir}/${d.name}`;
            files.push({
                name: d.name,
                path: entryPath.replace(`${root}/`, ''),
                type: (d.isFile()) ? 'file' : 'dir'
            });

            if (d.isDirectory()) {
                files.push(...gatherFiles(entryPath, root));
            } else if (d.isFile()) {
                const fileData = fs.readFileSync(entryPath, { encoding: 'utf8' });
                files[files.length - 1].content = Buffer.from(fileData, 'utf8').toString('base64');
            }
        });

        return files;
    };

    const files = gatherFiles(filesPath, filesPath);

    const uriParts = (uri) => {
        const parts = uri.split('/');

        return {
            repo: `${parts[2]}/${parts[3]}`,
            directory: parts[5],
            file: parts[6]
        };
    };

    nock('https://api.github.com', {
        reqheaders: {
            authorization: 'Token secret'
        }
    })
        .persist()
        .get(/repos\/.*\/contents\/.*/)
        .reply((uri) => {
            const req = uriParts(uri);
            if (req.repo !== repo) {
                return [
                    400,
                    {
                        message: `Expected repo ${repo} but got ${req.repo}`
                    }
                ];
            }

            if (req.file) {
                const retFile = files
                    .filter(x => x.path === `${req.directory}/${req.file}`)[0];
                return [
                    200,
                    retFile
                ];
            }

            const data = files
                .filter(x => x.path.startsWith(req.directory));
            return [
                200,
                data
            ];
        });
}

module.exports = {
    nockGitHubAPI
};
