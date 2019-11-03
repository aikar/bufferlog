/** @flow */

import type {BufferLogOptions} from "./bufferlog";
import {BufferLogFile} from "./BufferLogFile";
import path from "path";

export class BufferLog {
    _options: BufferLogOptions;
    _filePrefix: string;
    _bufferLogFiles: Map<string, Promise<BufferLogFile>> = new Map();

    constructor(options: BufferLogOptions) {
        this._options = options;
        this._filePrefix = path.join(this._options.directory, this._options.filePrefix);
    }

    get dataFilePrefix(): string {
        return this._filePrefix;
    }

    obtainBufferLogFile(log: string): Promise<BufferLogFile> {
        let bufferLogFile = this._bufferLogFiles.get(log);
        if (bufferLogFile) {
            return bufferLogFile;
        }

        bufferLogFile = new Promise((accept) => {
            accept(new BufferLogFile(this, log).init());
        });
        this._bufferLogFiles.set(log, bufferLogFile);
        return bufferLogFile;
    }

    async closeBufferLogFile(log: string) {
        const file = this._bufferLogFiles.get(log);
        if (!file) {
            return;
        }
        this._bufferLogFiles.delete(log);
        return (await file).close();
    }
}
