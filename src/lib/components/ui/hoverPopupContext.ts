export const HOVER_POPUP_PIN_KEY = Symbol("hoverPopupPin");

export type HoverPopupPin = {
    setPinned: (pinned: boolean) => void;
};
