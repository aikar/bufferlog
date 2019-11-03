/** @flow */
import type {BufferLog} from "./BufferLog";
import fs from "fs-extra";

import {promisify} from "util";
import {HEADER_SIZE, INDEX_HEADER_SPEC, INDEX_RECORD_SPEC, RECORD_SIZE} from "./spec";

export class BufferLogFile {
    _main: BufferLog;
    _file: string;
    _closing: boolean = false;
    constructor(main: BufferLog, file: string) {
        this._main = main;
        this._file = file;
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
        return buf.readUInt32BE(INDEX_HEADER_SPEC.FIRST_INDEX);
    }

    async getLatestIndex(): Promise<?number> {
        const buf: Buffer = await this._readIndexFile();
        if (!buf || buf.length < 8) {
            return null;
        }
        return buf.readUInt32BE(INDEX_HEADER_SPEC.LAST_INDEX);
    }
    async getFirstIndexTimestamp(): Promise<?number> {
        const buf: Buffer = await this._readIndexFile();
        if (!buf || buf.length <= HEADER_SIZE + RECORD_SIZE) {
            return null;
        }

        return buf.readInt32BE(HEADER_SIZE + INDEX_RECORD_SPEC.FIRST_TIMESTAMP);
    }

    async getLatestIndexTimestamp(): Promise<?number> {
        const buf: Buffer = await this._readIndexFile();
        if (!buf || buf.length < 8) {
            return null;
        }
        const logCount = buf.readUInt32BE(INDEX_HEADER_SPEC.LOG_COUNT);
        return buf.readInt32BE(HEADER_SIZE + (logCount * RECORD_SIZE) - RECORD_SIZE + INDEX_RECORD_SPEC.LAST_TIMESTAMP);
    }

    * _forEachLogRecord(buf: Buffer) {
        const logCount = buf.readUInt32BE(INDEX_HEADER_SPEC.LOG_COUNT);
        for (let offset = HEADER_SIZE + (logCount * RECORD_SIZE) - RECORD_SIZE; offset >= HEADER_SIZE; offset -= RECORD_SIZE) {
            yield buf.slice(offset, RECORD_SIZE);
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
