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

/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */

'use strict';

const assert = require('assert');

const TransactionLogger = require('../lib/transaction_logger');

describe('TransactionLogger', function () {
    describe('Init', function () {
        it('should provide default callbacks', function () {
            const tl = new TransactionLogger();
            assert.ok(tl.onEnterCb);
            assert.ok(tl.onExitCb);
        });
    });

    describe('Enter', function () {
        it('should error on missing transaction', function () {
            const tl = new TransactionLogger();
            assert.throws(tl.enter, /transaction/);
        });
        it('should store transaction', function () {
            const tl = new TransactionLogger();
            tl.enter('a');
            assert.ok(tl.transactions['a-0']);
        });
        it('should call onEnter callback', function () {
            let called = false;
            const tl = new TransactionLogger(
                (transaction, enterTime) => {
                    called = true;
                    assert.strictEqual(transaction, 'a transaction');
                    assert.ok(enterTime);
                }
            );
            tl.enter('a transaction');
            assert(called, 'expected onEnter to be called');
        });
    });

    describe('Exit', function () {
        it('should error on missing transaction', function () {
            const tl = new TransactionLogger();
            assert.throws(tl.exit, /transaction/);
        });
        it('should error if called without enter()', function () {
            const tl = new TransactionLogger();
            assert.throws(() => tl.exit('a'), /called without enter/);
        });
        it('should call onExit callback', function () {
            let called = false;
            const tl = new TransactionLogger(
                () => {},
                (transaction, exitTime, deltaTime) => {
                    called = true;
                    assert.strictEqual(transaction, 'a transaction');
                    assert.ok(exitTime);
                    assert.notStrictEqual(typeof deltaTime, 'undefined');
                }
            );
            tl.enter('a transaction');
            tl.exit('a transaction');
            assert(called, 'expected onExit to be called');
        });
    });

    describe('Record Promise', function () {
        it('should error on missing transaction', function () {
            const tl = new TransactionLogger();
            assert.throws(tl.exit, /transaction/);
        });
        it('should call onEnter() and onExit()', function () {
            let onEnterCalled = false;
            let onExitCalled = false;
            const tl = new TransactionLogger(
                (transaction, enterTime) => {
                    onEnterCalled = true;
                    assert.strictEqual(transaction, 'a transaction');
                    assert.ok(enterTime);
                },
                (transaction, exitTime, deltaTime) => {
                    onExitCalled = true;
                    assert.strictEqual(transaction, 'a transaction');
                    assert.ok(exitTime);
                    assert(typeof deltaTime !== 'undefined');
                }
            );
            return Promise.resolve()
                .then(() => tl.enterPromise('a transaction', Promise.resolve()))
                .then(() => {
                    assert(onEnterCalled, 'expected onEnter to be called');
                    assert(onExitCalled, 'expected onExit to be called');
                });
        });
        it('should call onExit() on a rejected promise', function () {
            let called = false;
            const tl = new TransactionLogger(
                () => {},
                (transaction, exitTime, deltaTime) => {
                    called = true;
                    assert.strictEqual(transaction, 'a transaction');
                    assert.ok(exitTime);
                    assert(typeof deltaTime !== 'undefined');
                }
            );
            return Promise.resolve()
                .then(() => tl.enterPromise('a transaction', Promise.reject()))
                .then(() => {
                    assert(called, 'expected onExit to be called');
                })
                .catch(() => {});
        });
    });
});
