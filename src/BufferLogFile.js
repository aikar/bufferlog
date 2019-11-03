/** @flow */
import type {BufferLog} from "./BufferLog";
import _fs from "fs";
import path from "path";
import _lockFile from "lockfile";
import {promisify} from "util";
const lockFile: typeof _lockFile = {
    lock: promisify(_lockFile.lock),
    unlock: promisify(_lockFile.unlock),
};
const fs = {
    readFile: promisify(_fs.readFile),
    writeFile: promisify(_fs.writeFile),
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const LOG_INDEX_HEADER_SPEC = {
    VERSION: 0, // 8 bit
    CURRENT_GENERATION: 1, // 24bit
    FIRST_INDEX: 4, // 32bit
    LAST_INDEX: 8, // 32bit
    LOG_COUNT: 12, // 32bit
    _UNUSED: 16,
};
const LOG_INDEX_SPEC = {
    LOG_FILE: 0, // 32bit
    FIRST_TIMESTAMP: 4, // 32bit
    LAST_TIMESTAMP: 8, // 32bit
    FILE_OFFSET: 16, // 32bit
    DATA_LENGTH: 24, // 32bit
    _UNUSED: 28, // 32bit
};
const RECORD_SIZE = 32;
const HEADER_SIZE = 256;
export class BufferLogFile {
    _main: BufferLog;
    _file: string;
    _locks: Map<string, Promise<void>> = new Map();
    _lockCounter: Map<string, number> = new Map();
    _closing: boolean = false;
    constructor(main: BufferLog, file: string) {
        this._main = main;
        this._file = file;
    }
    async _lock<R>(file: string, cb: () => Promise<R>): Promise<R> {
        const fileLock = this._main.dataFilePrefix + file + + ".lock";

        const pendingLockCount = this._lockCounter.get(file);
        this._lockCounter.set(file, pendingLockCount != null ? pendingLockCount + 1 : 1);
        let pendingLock = this._locks.get(file);
        if (!pendingLock) {
            pendingLock = new Promise(async (accept, reject) => {
                let i = 0;
                while (true) {
                    try {
                        lockFile.lock();
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

        try {
            await pendingLock;
            return await Promise.resolve(cb())
        } finally {
            const pendingLocks = this._lockCounter.get(file);
            if (pendingLocks == null || pendingLocks === 1) {
                this._lockCounter.delete(file);
                this._locks.delete(file);
            } else {
                this._lockCounter.set(file, pendingLocks - 1);
            }
            await lockFile.unlock(fileLock)
        }
    }

    async _createLog() {
        await this._obtainIndexLock(async () => {

        });
    }

    async getFirstIndex(): Promise<?number> {
        const buf: Buffer = await this._readIndexFile();
        if (!buf || buf.length < 8) {
            return null;
        }
        return buf.readUInt32BE(LOG_INDEX_HEADER_SPEC.FIRST_INDEX);
    }

    async getLatestIndex(): Promise<?number> {
        const buf: Buffer = await this._readIndexFile();
        if (!buf || buf.length < 8) {
            return null;
        }
        return buf.readUInt32BE(LOG_INDEX_HEADER_SPEC.LAST_INDEX);
    }
    async getFirstIndexTimestamp(): Promise<?number> {
        const buf: Buffer = await this._readIndexFile();
        if (!buf || buf.length <= HEADER_SIZE + RECORD_SIZE) {
            return null;
        }

        return buf.readInt32BE(HEADER_SIZE + LOG_INDEX_SPEC.FIRST_TIMESTAMP);
    }

    async getLatestIndexTimestamp(): Promise<?number> {
        const buf: Buffer = await this._readIndexFile();
        if (!buf || buf.length < 8) {
            return null;
        }
        const logCount = buf.readUInt32BE(LOG_INDEX_HEADER_SPEC.LOG_COUNT);
        return buf.readInt32BE(HEADER_SIZE + (logCount * RECORD_SIZE) - RECORD_SIZE + LOG_INDEX_SPEC.LAST_TIMESTAMP);
    }

    * _forEachLogRecord(buf: Buffer) {
        const logCount = buf.readUInt32BE(LOG_INDEX_HEADER_SPEC.LOG_COUNT);
        for (let offset = HEADER_SIZE + (logCount * RECORD_SIZE) - RECORD_SIZE; offset >= HEADER_SIZE; offset -= RECORD_SIZE) {
            yield offset;
        }
    }
    async _readIndexFile(cb?: (buf: Buffer) => Promise<void>): Promise<Buffer> {
        return this._obtainIndexLock(async () => {
            const buf = await fs.readFile(this._main.dataFilePrefix + "index");
            if (cb != null) {
                await Promise.resolve(cb(buf));
            }
            return buf;
        })
    }

    async _obtainIndexLock<R>(cb: () => Promise<R>): Promise<R> {
        return this._lock("index", cb);
    }

    async init(): Promise<BufferLogFile> {
        return this;
    }
    async close() {
        this._closing = true;
        // Potential for recursion but 2nd call will do nothing
        await this._main.closeBufferLogFile(this._file);
    }

}
