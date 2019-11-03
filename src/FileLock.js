/** @flow */
import _lockFile from "lockfile";
import {promisify} from "util";
import fs from "fs-extra";
import {sleep} from "./util";
import type {DeferredPromise} from "./util";

const lockFile: typeof _lockFile = {
    lock: promisify(_lockFile.lock),
    unlock: promisify(_lockFile.unlock),
};
export type FileLockOptions = {
    prefix: string,
}
export type LockType = 'w' | 'r';
export type LockEntry = {
    wait: Promise<void>,
    release: DeferredPromise<void>,
    type: LockType,
    holders: number,
};
export type LockObject = {
    waitLock?: Promise<void>,
    currentType?: LockType,
    releaseLock: DeferredPromise<void>,
    queue: Array<LockEntry>,
};

export class FileLock {
    _options: FileLockOptions;
    _locks: Map<string, LockObject> = new Map();
    _lockCounter: Map<string, number> = new Map();

    constructor(options: FileLockOptions) {
        this._options = options || {};
    }

    async lock<R>(lockId: string, type: LockType, cb: () => Promise<R>): Promise<R> {
        const fileLock = `${this._options.prefix}_${lockId}.${type}lock`;

        let lockObject: ?LockObject = this._locks.get(lockId);
        let waitOnLock;
        if (!lockObject) {
           lockObject = {
               queue: [],
               holders: 1,
               currentType: type,
               waitLock: this._obtainLock(fileLock),
               releaseLock: this._releaseLock()
           };
           waitOnLock = lockObject.waitLock;
           this._locks.set(lockId, lockObject);
        } else {
            const queue = lockObject.queue;
            if (lockObject.currentType === 'r' && type === 'r') {
                // Merge with current lock
                lockObject.holders++;
                waitOnLock = lockObject.waitLock;
            } else if (queue.length && queue[queue.length-1][1] === 'r' && type === 'r') {
                // Check if last is a read and we are a read to bundle together
                waitOnLock = queue[queue.length][0];
            } else if (queue.length) {
                // Piggyback next in queue
            } else {
                // Schedule next in queue
                waitOnLock = this._obtainLock(fileLock);
                queue.push()
            }
        }

        try {
            await waitOnLock;
            return await Promise.resolve(cb())
        } finally {
            const pendingLocks = this._lockCounter.get(lockId);
            if (pendingLocks == null || pendingLocks === 1) {
                this._lockCounter.delete(lockId);
                this._locks.delete(lockId);
            } else {
                this._lockCounter.set(lockId, pendingLocks - 1);
            }
            await lockFile.unlock(fileLock)
        }
    }

    _obtainLock(fileLock: string): Promise<void> {
        return new Promise(async (accept, reject) => {
            let i = 0;
            while (true) {
                try {
                    await lockFile.lock(fileLock);
                    accept();
                    break;
                } catch (e) {
                    if (e.code !== 'EEXIST') {
                        reject(e);
                        break;
                    }
                    await sleep(i++ < 10 ? 100 : 200);
                }
            }
        });
    }

}