<script lang="ts">
	import { untrack } from "svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import type { Block } from "$lib/document/types";

	const WEIGHT_CSS: Record<string, number> = { Regular: 400, Medium: 500, Bold: 700 };

	interface Props {
		block: Block;
		scale: number;
		marginTopPx?: number;
		placeholder?: string;
		registerel: (id: string, el: HTMLElement | null) => void;
		onheight: (id: string, px: number) => void;
		onfocusblock: (id: string) => void;
		oninputblock: (id: string, text: string) => void;
		onsplit: (id: string, caretOffset: number) => void;
		onmergeprev: (id: string) => void;
	}

	let {
		block,
		scale,
		marginTopPx = 0,
		placeholder,
		registerel,
		onheight,
		onfocusblock,
		oninputblock,
		onsplit,
		onmergeprev,
	}: Props = $props();

	const typography = $derived(documentStore.resolveTypography(block));
	const paragraph = $derived(documentStore.resolveParagraph(block));

	// Typst's line advance is `leading + ~0.66em` (the cap-height-ish base it uses
	// at zero leading, measured against the compiler). `1 + leading` is too loose.
	const LINE_ADVANCE_BASE = 0.66;

	const fontSizePx = $derived(typography.size * scale);
	const lineHeight = $derived(typography.leading + LINE_ADVANCE_BASE);
	const letterSpacingPx = $derived((typography.tracking / 100) * fontSizePx);
	const fontWeight = $derived(WEIGHT_CSS[typography.weight] ?? 400);
	// Empty blocks are blank lines (serialized as `linebreak()`), so they stay
	// tight — only real paragraphs carry paragraph spacing.
	const isEmpty = $derived(block.text === "");
	const marginBottomPx = $derived(isEmpty ? 0 : paragraph.spacing * fontSizePx);
	const firstLineIndentEm = $derived(paragraph.firstLineIndent ?? 0);

	let el = $state<HTMLDivElement | null>(null);

	function reportHeight(): void {
		if (el) onheight(block.id, el.offsetHeight + marginBottomPx);
	}

	/**
	 * A trailing newline (or a completely empty block) isn't rendered with a line
	 * box of its own, so the caret height collapses/varies — notably in WebKit.
	 * A sentinel `<br>` gives every line a consistent box. `textContent` ignores
	 * `<br>`, so this never leaks into the model. The placeholder block is left
	 * truly empty so its `:empty` placeholder still shows.
	 */
	function ensureTrailingBr(): void {
		if (!el) return;
		const text = el.textContent ?? "";
		const needsLineBox = text.endsWith("\n") || (text === "" && !placeholder);
		const hasTrailingBr = el.lastChild?.nodeName === "BR";
		if (needsLineBox && !hasTrailingBr) el.append(document.createElement("br"));
	}

	$effect(() => {
		const node = el;
		if (!node) return;
		registerel(block.id, node);
		node.textContent = untrack(() => block.text);
		ensureTrailingBr();
		const observer = new ResizeObserver(() => reportHeight());
		observer.observe(node);
		return () => {
			observer.disconnect();
			registerel(block.id, null);
		};
	});

	// Re-measure when style inputs that affect height change.
	$effect(() => {
		void marginBottomPx;
		void fontSizePx;
		void lineHeight;
		reportHeight();
	});

	// Keep the (uncontrolled) DOM in sync when the model changes externally.
	$effect(() => {
		const text = block.text;
		if (el && el.textContent !== text && document.activeElement !== el) {
			el.textContent = text;
			ensureTrailingBr();
		}
	});

	function caretOffset(): number {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || !el) return 0;
		const range = sel.getRangeAt(0);
		const pre = document.createRange();
		pre.selectNodeContents(el);
		pre.setEnd(range.endContainer, range.endOffset);
		return pre.toString().length;
	}

	function onInput(): void {
		if (el) oninputblock(block.id, el.textContent ?? "");
	}

	function insertSoftBreak(): void {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const range = sel.getRangeAt(0);
		range.deleteContents();
		const node = document.createTextNode("\n");
		range.insertNode(node);
		ensureTrailingBr();
		range.setStartAfter(node);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
		onInput();
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			const offset = caretOffset();
			const text = el?.textContent ?? "";
			// Single Enter inserts a soft line break; a second Enter (the char
			// before the caret is already a newline) starts a new paragraph block.
			if (text[offset - 1] === "\n") {
				onsplit(block.id, offset);
			} else {
				insertSoftBreak();
			}
		} else if (event.key === "Backspace") {
			const sel = window.getSelection();
			if (sel && sel.isCollapsed && caretOffset() === 0) {
				event.preventDefault();
				onmergeprev(block.id);
			}
		}
	}

	function onPaste(event: ClipboardEvent): void {
		event.preventDefault();
		const text = event.clipboardData?.getData("text/plain") ?? "";
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const range = sel.getRangeAt(0);
		range.deleteContents();
		const node = document.createTextNode(text.replace(/\r\n/g, "\n"));
		range.insertNode(node);
		ensureTrailingBr();
		range.setStartAfter(node);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
		onInput();
	}
</script>

<!-- The spacing lives on this wrapper so the editable element (and therefore the
     caret) is contained to exactly the text's line box. -->
<div style:margin-top="{marginTopPx}px" style:margin-bottom="{marginBottomPx}px">
	<div
		bind:this={el}
		class="doc-block w-full outline-none"
		contenteditable="true"
		spellcheck="false"
		role="textbox"
		tabindex="0"
		aria-multiline="false"
		data-placeholder={placeholder}
		style:font-family={`"${typography.fontFamily}", serif`}
		style:font-size="{fontSizePx}px"
		style:font-weight={fontWeight}
		style:line-height={lineHeight}
		style:letter-spacing="{letterSpacingPx}px"
		style:color={typography.color}
		style:text-align={paragraph.justify ? "justify" : "left"}
		style:text-indent="{firstLineIndentEm}em"
		onfocus={() => onfocusblock(block.id)}
		oninput={onInput}
		onkeydown={onKeydown}
		onpaste={onPaste}
	></div>
</div>

<style>
	.doc-block {
		white-space: pre-wrap;
		overflow-wrap: break-word;
		caret-color: currentColor;
	}

	.doc-block:empty::before {
		content: attr(data-placeholder);
		opacity: 0.3;
		pointer-events: none;
	}
</style>
