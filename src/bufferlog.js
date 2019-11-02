/** @flow */

export type BufferLogOptions = {
    directory: string,
    filePrefix: string,
    bufferLogSizeMB: number,
}

export class BufferLog {
    _options: BufferLogOptions;

    constructor(options: BufferLogOptions) {
        this._options = options;
    }

    async _createBufferFile() {

    }
}
