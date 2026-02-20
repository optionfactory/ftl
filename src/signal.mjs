// src/signals.mjs  (add this new file)

let currentEffect = null;

export class Signal {
    _value;
    _subscribers = new Set();

    constructor(value) {
        this._value = value;
    }

    get value() {
        if (currentEffect) {
            currentEffect._deps ??= new Set();
            currentEffect._deps.add(this);
            this._subscribers.add(currentEffect);
        }
        return this._value;
    }

    set value(newValue) {
        if (Object.is(this._value, newValue)) return;
        this._value = newValue;
        this._notify();
    }

    _notify() {
        // copy because a subscriber might dispose itself during run
        const subs = [...this._subscribers];
        this._subscribers.clear();           // will re-subscribe on next run
        for (const fn of subs) fn();
    }
}

export function effect(callback) {
    const runner = () => {
        // cleanup previous dependencies
        if (runner._deps) {
            runner._deps.forEach(sig => sig._subscribers.delete(runner));
            runner._deps.clear();
        }

        const prev = currentEffect;
        currentEffect = runner;
        try {
            callback();
        } finally {
            currentEffect = prev;
        }
    };

    runner._deps = new Set();
    runner();                     // initial run

    // return dispose function
    return () => {
        if (runner._deps) {
            runner._deps.forEach(sig => sig._subscribers.delete(runner));
            runner._deps.clear();
        }
    };
}