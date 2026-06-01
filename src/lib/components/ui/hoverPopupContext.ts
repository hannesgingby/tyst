export const HOVER_POPUP_PIN_KEY = Symbol("hoverPopupPin");

export type HoverPopupPin = {
    setPinned: (pinned: boolean) => void;
    /** Close the popup immediately (e.g. when focus moves to the document). */
    dismiss: () => void;
};
