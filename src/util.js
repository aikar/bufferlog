/** @flow */
export function sleep(ms: number, unref?: boolean = false) {
    return new Promise<void>(resolve => {
        const timer = setTimeout(resolve, ms);
        if (unref) {
            // $FlowFixMe
            timer.unref();
        }
    });
}

export interface DeferredPromise<T: any> extends Promise<T> {
    resolve(v: T): void;
    reject(e: Error): void;
}

function deferPromise<T>(): DeferredPromise<T> {
    let _a, _r;
    const p = new Promise((a, r) => {
        _a = a;
        _r = r;
    });
    // $FlowFixMe
    p.resolve = (v) => _a(v);
    // $FlowFixMe
    p.reject = (e: Error) => _r(e);
    // $FlowFixMe
    return p;
}