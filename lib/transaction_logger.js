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

const uuid4 = require('uuid').v4;

class TransactionLogger {
    constructor(onEnter, onExit) {
        this.onEnterCb = onEnter || (() => {});
        this.onExitCb = onExit || (() => {});
        this.transactions = {};
    }

    _getTime() {
        return new Date();
    }

    _deltaTime(startTime, endTime) {
        return endTime.getTime() - startTime.getTime();
    }

    enter(transaction, tid) {
        if (!transaction) {
            throw new Error('Missing required argument transaction');
        }
        tid = tid || 0;
        const enterTime = this._getTime();
        this.onEnterCb(transaction, enterTime);
        this.transactions[`${transaction}-${tid}`] = enterTime;
    }

    exit(transaction, tid) {
        if (!transaction) {
            throw new Error('Missing required argument transaction');
        }
        tid = tid || 0;
        const tkey = `${transaction}-${tid}`;
        if (!this.transactions[tkey]) {
            throw new Error('exit() called without enter()');
        }
        const exitTime = this._getTime();
        const enterTime = this.transactions[tkey];
        this.onExitCb(transaction, exitTime, this._deltaTime(enterTime, exitTime));
        delete this.transactions[tkey];
    }

    enterPromise(transaction, promise) {
        const tid = uuid4();
        this.enter(transaction, tid);
        return promise
            .finally(() => this.exit(transaction, tid));
    }
}

module.exports = TransactionLogger;
