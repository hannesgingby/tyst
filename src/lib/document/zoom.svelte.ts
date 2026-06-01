const STEP = 0.1;
const MIN = 0.4;
const MAX = 1.0;

const DEFAULT = 0.9;

let zoom = $state(DEFAULT);

export const zoomStore = {
    get value() {
        return zoom;
    },
    get percent() {
        return Math.round(zoom * 100);
    },
    stepUp() {
        zoom = Math.min(MAX, Math.round((zoom + STEP) * 10) / 10);
    },
    stepDown() {
        zoom = Math.max(MIN, Math.round((zoom - STEP) * 10) / 10);
    },
    set(value: number) {
        zoom = Math.min(MAX, Math.max(MIN, value));
    },
    reset() {
        zoom = DEFAULT;
    },
};
