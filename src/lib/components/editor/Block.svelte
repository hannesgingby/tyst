<script lang="ts">
	import { untrack } from "svelte";
	import { resolveBlockHeadingSpacing, resolveBlockListSpacing } from "$lib/document/blockLevelStyle";
	import { documentStore } from "$lib/document/store.svelte";
	import { formatNumbering } from "$lib/document/numbering";
	import { ptToPx } from "$lib/document/units";
	import type { Block, StrokeDash } from "$lib/document/types";
	import { imageCache } from "$lib/system/imageCache.svelte";
	import { getCaretOffset } from "./caret";

	const WEIGHT_CSS: Record<string, number> = { Regular: 400, Medium: 500, Bold: 700 };

	/**
	 * Role of this block in the paragraph structure:
	 * - "text"      – contains text (or is the sole placeholder block)
	 * - "parbreak"  – first consecutive empty block after content → #parbreak()
	 * - "linebreak" – second+ consecutive empty block → #linebreak()
	 */
	type BlockRole = "text" | "parbreak" | "linebreak";

	interface Props {
		block: Block;
		scale: number;
		role?: BlockRole;
		spacingEm?: number;
		placeholder?: string;
		renderInline?: boolean;
		/** Pre-rendered list marker (e.g. "•", "1."). Set only on list items. */
		marker?: string;
		/** Pre-rendered heading number prefix (e.g. "1.2 "). */
		headingPrefix?: string;
		/** List group uses paragraph leading between items when true. */
		listTight?: boolean;
		/** Another item follows in the same list group. */
		listHasNext?: boolean;
		/** This block is the first item in its list group. */
		listGroupFirst?: boolean;
		/** This block is the first non-continuation block on its page. */
		suppressAbove?: boolean;
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
		role = "text",
		spacingEm,
		placeholder,
		renderInline = false,
		marker,
		headingPrefix = "",
		listTight = true,
		listHasNext = false,
		listGroupFirst = false,
		suppressAbove = false,
		registerel,
		onheight,
		onfocusblock,
		oninputblock,
		onsplit,
		onmergeprev,
		onpastelines,
	}: Props = $props();

	// Default heading font-size multipliers, chosen to approximate Typst's
	// out-of-the-box heading scale. `0` is the document title.
	const HEADING_SCALE: Record<number, number> = {
		0: 2.0,
		1: 1.4,
		2: 1.2,
		3: 1.06,
		4: 1.0,
	};
	const HEADING_TOP_MARGIN_EM_FALLBACK: Record<number, number> = {
		0: 1.4,
		1: 1.2,
		2: 1.0,
		3: 0.8,
		4: 0.6,
	};

	const typography = $derived(documentStore.resolveTypography(block));
	const paragraph = $derived(documentStore.resolveParagraph(block));

	const LINE_ADVANCE_BASE = 0.658;

	const headingScale = $derived(
		block.heading ? (HEADING_SCALE[block.heading.level] ?? 1) : 1,
	);
	const fontSizePx = $derived(ptToPx(typography.size) * scale * headingScale);
	const lineHeight = $derived(
		block.heading ? 1.2 : typography.leading + LINE_ADVANCE_BASE,
	);
	const letterSpacingPx = $derived((typography.tracking / 100) * fontSizePx);
	const fontWeight = $derived(
		block.heading ? 700 : (WEIGHT_CSS[typography.weight] ?? 400),
	);
	const firstLineIndentEm = $derived(
		block.heading || block.list ? 0 : (paragraph.firstLineIndent ?? 0),
	);

	const effectiveLineHeight = $derived(
		role === "parbreak" ? (spacingEm ?? paragraph.spacing) : lineHeight,
	);

	const textAlign = $derived(
		block.alignment ?? (paragraph.justify ? "justify" : "left"),
	);

	const headingTopMarginEm = $derived.by(() => {
		if (!block.heading) return 0;
		const level = block.heading.level;
		const spacing = resolveBlockHeadingSpacing(documentStore.model, block);
		return spacing?.above ?? (HEADING_TOP_MARGIN_EM_FALLBACK[level] ?? 0);
	});

	const headingBottomMarginEm = $derived.by(() => {
		if (!block.heading) return 0;
		return resolveBlockHeadingSpacing(documentStore.model, block)?.below ?? 0;
	});

	const listAboveEm = $derived.by(() => {
		if (!block.list) return 0;
		return (
			resolveBlockListSpacing(
				documentStore.model,
				block,
				documentStore.pageBreakBlockIds,
			)?.above ?? 0
		);
	});

	const listBelowEm = $derived.by(() => {
		if (!block.list) return 0;
		return (
			resolveBlockListSpacing(
				documentStore.model,
				block,
				documentStore.pageBreakBlockIds,
			)?.below ?? 0
		);
	});

	const isInline = $derived(block.continuation || renderInline);
	const isList = $derived(!!block.list);
	const isEmbed = $derived(!!(block.image || block.line || block.rect));
	const isOutline = $derived(!!block.outline);

	// Outline body entries: walk all blocks, count outlined headings, and pick
	// the page each heading falls on so the rendered TOC matches Typst's PDF.
	const outlineEntries = $derived.by(() => {
		if (!block.outline) return [] as {
			id: string;
			level: number;
			prefix: string;
			text: string;
			page: number;
		}[];
		const docModel = documentStore.model;
		const pageBreakSet = new Set(documentStore.pageBreakBlockIds);
		const maxDepth = block.outline.depth ?? 4;
		const counters = [0, 0, 0, 0, 0];
		let page = 1;
		const out: {
			id: string;
			level: number;
			prefix: string;
			text: string;
			page: number;
		}[] = [];
		for (const b of docModel.blocks) {
			if (pageBreakSet.has(b.id)) page += 1;
			if (!b.heading || b.heading.level === 0) continue;
			const level = b.heading.level;
			const baseStyle = documentStore.resolveHeadingStyle(level);
			const style = b.headingNumbering
				? { ...baseStyle, ...b.headingNumbering }
				: baseStyle;
			if (style.outlined === false) continue;
			counters[level] += 1;
			for (let l = level + 1; l <= 4; l++) counters[l] = 0;
			if (level > maxDepth) continue;
			let prefix = "";
			if (style.numbering) {
				const nums = counters.slice(1, level + 1);
				prefix = formatNumbering(style.numbering, nums) + " ";
			}
			out.push({ id: b.id, level, prefix, text: b.text, page });
		}
		return out;
	});

	// Marker glyph and the space it reserves on the left.
	const markerText = $derived(marker ?? "");
	// body-indent (em): space between marker and text. Defaults to 0.5em.
	const bodyIndentEm = $derived(block.list?.bodyIndent ?? 0.5);
	const listIndentPt = $derived(block.list?.indent ?? 0);
	const listItemGapEm = $derived(
		listTight ? typography.leading : paragraph.spacing,
	);

	const effectivePlaceholder = $derived(block.placeholder ?? placeholder);

	let el = $state<HTMLElement | null>(null);
	let outerEl = $state<HTMLElement | null>(null);
	let embedEl = $state<HTMLElement | null>(null);

	function reportHeight(): void {
		const target = embedEl ?? outerEl ?? el;
		if (target) onheight(block.id, target.offsetHeight);
	}

	// Embed blocks: register the wrapper for layout/height, but skip all
	// contenteditable wiring. Click activates the block so the toolbar can tie
	// the matching popup.
	$effect(() => {
		if (!isEmbed) return;
		const node = embedEl;
		if (!node) return;
		const observer = new ResizeObserver(() => reportHeight());
		observer.observe(node);
		reportHeight();
		return () => observer.disconnect();
	});

	function ensureTrailingBr(): void {
		if (!el) return;
		const isEmpty = (el.textContent ?? "") === "";
		const hasTrailingBr = el.lastChild?.nodeName === "BR";
		if (isEmpty && !effectivePlaceholder && !hasTrailingBr) {
			el.append(document.createElement("br"));
		} else if ((!isEmpty || effectivePlaceholder) && hasTrailingBr) {
			el.lastChild?.remove();
		}
	}

	$effect(() => {
		if (isEmbed) return;
		const node = el;
		if (!node) return;
		registerel(block.id, node);
		node.textContent = untrack(() => block.text);
		ensureTrailingBr();
		const target = outerEl ?? node;
		const observer = new ResizeObserver(() => reportHeight());
		observer.observe(target);
		return () => {
			observer.disconnect();
			registerel(block.id, null);
		};
	});

	$effect(() => {
		void fontSizePx;
		void effectiveLineHeight;
		void headingTopMarginEm;
		void headingBottomMarginEm;
		void markerText;
		reportHeight();
	});

	$effect(() => {
		const text = block.text;
		if (el && el.textContent !== text && document.activeElement !== el) {
			el.textContent = text;
			ensureTrailingBr();
		}
	});

	// Toggling the placeholder on an empty block must re-evaluate the sentinel <br>:
	// BR fills the line box when there's no placeholder, but stops :empty from matching.
	$effect(() => {
		void effectivePlaceholder;
		ensureTrailingBr();
	});

	function onInput(): void {
		if (el) oninputblock(block.id, el.textContent ?? "");
	}

	function onKeydown(event: KeyboardEvent): void {
		if (!el) return;
		if (event.key === "Enter") {
			event.preventDefault();
			onsplit(block.id, getCaretOffset(el));
		} else if (event.key === "Backspace") {
			if (
				window.getSelection()?.isCollapsed &&
				getCaretOffset(el) === 0 &&
				!block.continuation
			) {
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
			const node = document.createTextNode(lines[0] ?? "");
			range.insertNode(node);
			range.setStartAfter(node);
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
			ensureTrailingBr();
			onInput();
		} else {
			const node = document.createTextNode(lines[0]);
			range.insertNode(node);
			range.setStartAfter(node);
			range.collapse(true);
			onInput();
			onpastelines(block.id, lines.slice(1));
		}
	}
</script>

{#snippet editable()}
	<svelte:element
		this={isInline ? "span" : "div"}
		bind:this={el}
		class={["doc-block outline-none", !isInline && "w-full"]}
		contenteditable="true"
		spellcheck="false"
		role="textbox"
		tabindex="0"
		aria-multiline="false"
		data-block-id={block.id}
		data-placeholder={effectivePlaceholder}
		style:display={isInline ? "inline" : undefined}
		style:font-family={`"${typography.fontFamily}", serif`}
		style:font-size="{fontSizePx}px"
		style:font-weight={fontWeight}
		style:line-height={effectiveLineHeight}
		style:letter-spacing="{letterSpacingPx}px"
		style:color={typography.color}
		style:text-align={textAlign}
		style:text-indent="{firstLineIndentEm}em"
		onfocus={() => onfocusblock(block.id)}
		oninput={onInput}
		onkeydown={onKeydown}
		onpaste={onPaste}
	></svelte:element>
{/snippet}

{#snippet embedView()}
	{@const img = block.image}
	{@const line = block.line}
	{@const rect = block.rect}
	{@const cached = img ? imageCache.get(block.id) : undefined}
	{@const spacing = documentStore.resolveEmbedSpacing(block)}
	{@const alignClass =
		block.alignment === "center"
			? "justify-center"
			: block.alignment === "right"
				? "justify-end"
				: "justify-start"}
	{@const dashCss = (d: StrokeDash) =>
		d === "dotted" ? "dotted" : d === "dashed" ? "dashed" : "solid"}
	{@const awaitingDelete = documentStore.embedAwaitingDelete === block.id}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={embedEl}
		class={["doc-embed relative flex w-full cursor-pointer", alignClass]}
		data-block-id={block.id}
		style:margin-top={suppressAbove ? "0" : `${spacing?.above ?? 1.2}em`}
		style:margin-bottom="{spacing?.below ?? 0.35}em"
		onclick={(e) => {
			e.preventDefault();
			// Goes through the store so any earlier popup-dismissal is cleared,
			// even when the active block id doesn't change.
			documentStore.activateEmbed(block.id);
			onfocusblock(block.id);
		}}
	>
		{#snippet deleteBadge()}
			{#if awaitingDelete}
				<!-- Anchored to the bottom-right of the per-embed sizing wrapper,
				     translated above it so it sits over the embed's top-right.
				     `bottom: 100%` + padding-bottom gives the spacing. -->
				<span
					class="text-text-150 pointer-events-none absolute right-0 bottom-full select-none"
					style:font-size="{10 * scale}px"
					style:line-height="1"
					style:padding-bottom="{8 * scale}px"
				>
					Backspace to delete
				</span>
			{/if}
		{/snippet}
		{#if img}
			{@const wPx = img.width != null ? ptToPx(img.width) * scale : undefined}
			{@const hPx = img.height != null ? ptToPx(img.height) * scale : undefined}
			<div class="relative inline-block">
				{#if cached}
					<img
						src={cached.dataUrl}
						alt={img.alt ?? img.fileName}
						class="block max-w-full select-none"
						style:width={wPx ? `${wPx}px` : "auto"}
						style:height={hPx ? `${hPx}px` : "auto"}
						style:object-fit={img.fit === "contain"
							? "contain"
							: img.fit === "stretch"
								? "fill"
								: "cover"}
						style:image-rendering={img.scaling === "pixelated" ? "pixelated" : "auto"}
						draggable="false"
					/>
				{:else}
					<div
						class="flex items-center justify-center rounded-md bg-bg-950 px-4 py-6 text-text-250"
						style:width={wPx ? `${wPx}px` : "240px"}
						style:height={hPx ? `${hPx}px` : "120px"}
					>
						{img.fileName}
					</div>
				{/if}
				{@render deleteBadge()}
			</div>
		{:else if line}
			{@const lenPx = line.lengthUnit === "pt" ? line.length * scale : undefined}
			<div
				class="relative my-2"
				style:width={lenPx ? `${lenPx}px` : `${line.length}%`}
				style:transform={line.angle ? `rotate(${line.angle}deg)` : undefined}
				style:transform-origin="left center"
			>
				<div
					style:border-top-style={dashCss(line.stroke.dash)}
					style:border-top-width="{line.stroke.thickness * scale}px"
					style:border-top-color={line.stroke.color}
				></div>
				{@render deleteBadge()}
			</div>
		{:else if rect}
			{@const wPx = rect.width != null ? ptToPx(rect.width) * scale : undefined}
			{@const hPx = (rect.height != null ? ptToPx(rect.height) : 60) * scale}
			<div
				class="relative"
				style:width={wPx ? `${wPx}px` : "100%"}
				style:height="{hPx}px"
				style:background-color={rect.fillEnabled ? rect.fillColor : "transparent"}
				style:border-style={dashCss(rect.stroke.dash)}
				style:border-width="{rect.stroke.thickness * scale}px"
				style:border-color={rect.stroke.color}
				style:border-radius="{rect.radius * scale}px"
				style:padding="{rect.inset * scale}px"
			>
				{@render deleteBadge()}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet outlineView()}
	{@const outline = block.outline!}
	{@const spacing = documentStore.resolveEmbedSpacing(block)}
	{@const docTypo = documentStore.model.typography}
	{@const baseFontPx = ptToPx(docTypo.size) * scale}
	{@const titleFontPx = baseFontPx * 1.4}
	{@const indentEm = outline.indent != null ? outline.indent / docTypo.size : 1.5}
	{@const awaitingDelete = documentStore.embedAwaitingDelete === block.id}
	<div
		bind:this={outerEl}
		class="relative w-full"
		style:margin-top={suppressAbove ? "0" : `${spacing?.above ?? 1.2}em`}
		style:margin-bottom="{spacing?.below ?? 0.35}em"
	>
		{#if awaitingDelete}
			<span
				class="text-text-150 pointer-events-none absolute right-0 bottom-full select-none"
				style:font-size="{10 * scale}px"
				style:line-height="1"
				style:padding-bottom="{8 * scale}px"
			>
				Backspace to delete
			</span>
		{/if}
		<div
			bind:this={el}
			class="doc-block outline-none w-full"
			contenteditable="true"
			spellcheck="false"
			role="textbox"
			tabindex="0"
			aria-multiline="false"
			data-block-id={block.id}
			data-placeholder={effectivePlaceholder ?? "Title"}
			style:font-family={`"${docTypo.fontFamily}", serif`}
			style:font-size="{titleFontPx}px"
			style:font-weight={700}
			style:line-height={1.2}
			style:color={docTypo.color}
			onfocus={() => onfocusblock(block.id)}
			oninput={onInput}
			onkeydown={onKeydown}
			onpaste={onPaste}
		></div>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="doc-embed mt-[0.5em] w-full cursor-pointer select-none"
			data-block-id={block.id}
			style:font-family={`"${docTypo.fontFamily}", serif`}
			style:font-size="{baseFontPx}px"
			style:line-height={docTypo.leading + 0.658}
			style:color={docTypo.color}
			onclick={(e) => {
				e.preventDefault();
				documentStore.activateEmbed(block.id);
				onfocusblock(block.id);
				// Put caret in title for editing convenience.
				if (el) {
					el.focus();
				}
			}}
		>
			{#if outlineEntries.length === 0}
				<div class="opacity-30">(no outlined headings yet)</div>
			{:else}
				{#each outlineEntries as entry (entry.id)}
					<div
						class="flex w-full items-baseline gap-1"
						style:padding-left="{(entry.level - 1) * indentEm}em"
					>
						<span class="whitespace-pre">{entry.prefix}{entry.text}</span>
						<span
							class="min-w-0 flex-1 overflow-hidden"
							style:letter-spacing="0.1em"
							style:opacity="0.8"
							aria-hidden="true"
							>{".".repeat(200)}</span
						>
						<span class="shrink-0 tabular-nums">{entry.page}</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/snippet}

{#if isOutline}
	{@render outlineView()}
{:else if isEmbed}
	{@render embedView()}
{:else if isList}
	<!-- List items render as a single flex row (marker + body). Horizontal
	     alignment of the whole group is applied by the wrapper around the
	     list group in `Document.svelte`, so markers stay vertically aligned
	     in column 1 while the group as a whole shifts left/center/right. -->
	<div
		bind:this={outerEl}
		class="flex w-full"
		style:padding-left="{listIndentPt}pt"
		style:margin-top={listGroupFirst && !suppressAbove ? `${listAboveEm}em` : undefined}
		style:margin-bottom={listHasNext ? `${listItemGapEm}em` : `${listBelowEm}em`}
		style:text-indent="0"
	>
		<span
			class="pointer-events-none shrink-0 select-none"
			style:font-family={`"${typography.fontFamily}", serif`}
			style:font-size="{fontSizePx}px"
			style:font-weight={fontWeight}
			style:line-height={effectiveLineHeight}
			style:color={typography.color}
			aria-hidden="true">{markerText}</span
		>
		<div class="min-w-0 flex-1" style:margin-left="{bodyIndentEm}em">
			{@render editable()}
		</div>
	</div>
{:else if block.heading}
	<div
		bind:this={outerEl}
		class="flex w-full"
		style:margin-top="{suppressAbove ? 0 : headingTopMarginEm}em"
		style:margin-bottom="{headingBottomMarginEm}em"
	>
		{#if headingPrefix}
			<span
				class="pointer-events-none shrink-0 select-none"
				style:font-family={`"${typography.fontFamily}", serif`}
				style:font-size="{fontSizePx}px"
				style:font-weight={fontWeight}
				style:line-height={effectiveLineHeight}
				style:color={typography.color}
				aria-hidden="true">{headingPrefix}</span
			>
		{/if}
		<div class="min-w-0 flex-1">
			{@render editable()}
		</div>
	</div>
{:else}
	{@render editable()}
{/if}

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
