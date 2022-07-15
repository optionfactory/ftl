
const timing = {
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    DEBOUNCE_DEFAULT: 0,
    DEBOUNCE_IMMEDIATE: 1,
    debounce(timeoutMs, func, options) {
        let tid = null;
        let args = [];
        let previousTimestamp = 0;
        let opts = options || timing.DEBOUNCE_DEFAULT;

        const later = () => {
            const elapsed = new Date().getTime() - previousTimestamp;
            if (timeoutMs > elapsed) {
                tid = setTimeout(later, timeoutMs - elapsed);
                return;
            }
            tid = null;
            if (opts !== timing.DEBOUNCE_IMMEDIATE) {
                func(...args);
            }
            // This check is needed because `func` can recursively invoke `debounced`.
            if (tid === null) {
                args = [];
            }
        };

        return function () {
            args = arguments;
            previousTimestamp = new Date().getTime();
            if (tid === null) {
                tid = setTimeout(later, timeoutMs);
                if (opts === timing.DEBOUNCE_IMMEDIATE) {
                    func(...args);
                }
            }
        };
    },
    THROTTLE_DEFAULT: 0,
    THROTTLE_NO_LEADING: 1,
    THROTTLE_NO_TRAILING: 2,
    throttle(timeoutMs, func, options) {
        let tid = null;
        let args = [];
        let previousTimestamp = 0;
        let opts = options || timing.THROTTLE_DEFAULT;

        const later = () => {
            previousTimestamp = (opts & timing.THROTTLE_NO_LEADING) ? 0 : new Date().getTime();
            tid = null;
            func(...args);
            if (tid === null) {
                args = [];
            }
        };

        return function () {
            const now = new Date().getTime();
            if (!previousTimestamp && (opts & timing.THROTTLE_NO_LEADING)) {
                previousTimestamp = now;
            }
            const remaining = timeoutMs - (now - previousTimestamp);
            args = arguments;
            if (remaining <= 0 || remaining > timeoutMs) {
                if (tid !== null) {
                    clearTimeout(tid);
                    tid = null;
                }
                previousTimestamp = now;
                func(...args);
                if (tid === null) {
                    args = [];
                }
            } else if (tid === null && !(opts & timing.THROTTLE_NO_TRAILING)) {
                tid = setTimeout(later, remaining);
            }
        };

    }
};


export { timing };