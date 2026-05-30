<script lang="ts">
	import { untrack } from "svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import { ptToPx } from "$lib/document/units";
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
		onpastelines: (id: string, lines: string[]) => void;
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
		onpastelines,
	}: Props = $props();

	const typography = $derived(documentStore.resolveTypography(block));
	const paragraph = $derived(documentStore.resolveParagraph(block));

	// Typst's line advance is `leading + 0.658em` (the intrinsic line height it
	// uses at zero leading for Libertinus Serif, measured against the compiler).
	// `1 + leading` is too loose; this matches the PDF's line spacing exactly.
	const LINE_ADVANCE_BASE = 0.658;

	const fontSizePx = $derived(ptToPx(typography.size) * scale);
	const lineHeight = $derived(typography.leading + LINE_ADVANCE_BASE);
	const letterSpacingPx = $derived((typography.tracking / 100) * fontSizePx);
	const fontWeight = $derived(WEIGHT_CSS[typography.weight] ?? 400);
	const firstLineIndentEm = $derived(paragraph.firstLineIndent ?? 0);

	let el = $state<HTMLDivElement | null>(null);

	function reportHeight(): void {
		if (el) onheight(block.id, el.offsetHeight);
	}

	/**
	 * Each block is a single logical line. An empty block has no line box of its
	 * own (so its height/caret collapses — notably in WebKit), so we give it a
	 * sentinel `<br>`. `textContent` ignores `<br>`, so it never leaks into the
	 * model. The placeholder block stays truly empty so its `:empty` hint shows.
	 */
	function ensureTrailingBr(): void {
		if (!el) return;
		const isEmpty = (el.textContent ?? "") === "";
		const hasTrailingBr = el.lastChild?.nodeName === "BR";
		if (isEmpty && !placeholder && !hasTrailingBr) {
			el.append(document.createElement("br"));
		} else if ((!isEmpty || placeholder) && hasTrailingBr) {
			el.lastChild?.remove();
		}
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

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			// Every Enter ends the current line and starts a new block, so each
			// keystroke reliably advances one line (no soft-break/split mixing).
			// The serializer turns adjacent lines into `linebreak()` and blank
			// lines into `parbreak()`.
			event.preventDefault();
			onsplit(block.id, caretOffset());
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
		const raw = event.clipboardData?.getData("text/plain") ?? "";
		const lines = raw.replace(/\r\n/g, "\n").split("\n");
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const range = sel.getRangeAt(0);
		range.deleteContents();
		if (lines.length <= 1) {
			// Single-line paste: insert inline.
			const node = document.createTextNode(lines[0] ?? "");
			range.insertNode(node);
			range.setStartAfter(node);
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
			ensureTrailingBr();
			onInput();
		} else {
			// Multi-line paste: keep the first line here, hand the rest to the
			// parent so each becomes its own block (matching the line model).
			const node = document.createTextNode(lines[0]);
			range.insertNode(node);
			range.setStartAfter(node);
			range.collapse(true);
			onInput();
			onpastelines(block.id, lines.slice(1));
		}
	}
</script>

<!-- The page-break offset lives on this wrapper so the editable element (and
     therefore the caret) is contained to exactly the text's line box. -->
<div style:margin-top="{marginTopPx}px">
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
