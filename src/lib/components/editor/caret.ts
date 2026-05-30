/**
 * Caret / selection helpers for the contenteditable block editor.
 *
 * Everything here operates on plain DOM nodes; the editor has a single text
 * node per block (plus a sentinel `<br>` for empty blocks), but the helpers
 * walk text nodes generically so they tolerate browser-inserted markup.
 */

/** Character offset of `(container, offset)` within `el`. */
export function measureOffset(el: HTMLElement, container: Node, offset: number): number {
	try {
		const range = document.createRange();
		range.selectNodeContents(el);
		range.setEnd(container, offset);
		return range.toString().length;
	} catch {
		return 0;
	}
}

/** Current collapsed-caret offset within `el`. Returns 0 if the selection is detached. */
export function getCaretOffset(el: HTMLElement): number {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return 0;
	const range = sel.getRangeAt(0);
	return measureOffset(el, range.endContainer, range.endOffset);
}

/** Set a collapsed caret at character `offset` inside `el`. */
export function setCaretOffset(el: HTMLElement, offset: number): void {
	const sel = window.getSelection();
	if (!sel) return;
	const range = document.createRange();
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	if (!node) {
		range.selectNodeContents(el);
		range.collapse(true);
	} else {
		let remaining = offset;
		while (node) {
			const len = node.textContent?.length ?? 0;
			if (remaining <= len) {
				range.setStart(node, remaining);
				break;
			}
			remaining -= len;
			const next = walker.nextNode();
			if (!next) {
				range.setStart(node, len);
				break;
			}
			node = next;
		}
		range.collapse(true);
	}
	sel.removeAllRanges();
	sel.addRange(range);
}

/** Select the text range [start, end] inside `el`. Falls back to selecting all contents. */
export function setCaretRange(el: HTMLElement, start: number, end: number): void {
	const sel = window.getSelection();
	if (!sel) return;
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const textNode = walker.nextNode();
	const range = document.createRange();
	if (textNode) {
		range.setStart(textNode, start);
		range.setEnd(textNode, end);
	} else {
		range.selectNodeContents(el);
	}
	sel.removeAllRanges();
	sel.addRange(range);
}

export function caretAtEnd(el: HTMLElement, textLen: number): boolean {
	return !!window.getSelection()?.isCollapsed && getCaretOffset(el) >= textLen;
}

export function caretAtStart(el: HTMLElement): boolean {
	return !!window.getSelection()?.isCollapsed && getCaretOffset(el) === 0;
}
