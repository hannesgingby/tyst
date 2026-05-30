<script lang="ts">
	import { tick } from "svelte";
	import Block from "./Block.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import { cmToPx, ptToPx } from "$lib/document/units";

	// Render the page at a higher internal pixel density and scale it *down* to
	// fit the viewport: layout matches the PDF, and the caret renders crisp/thin.
	const RENDER_SCALE = 2;
	// Visual gap between page sheets, in internal render pixels.
	const PAGE_GAP_PX = 40;

	const model = $derived(documentStore.model);
	// Live layout uses the document's default page geometry for all sheets.
	const page = $derived(documentStore.defaultPage);
	const blocks = $derived(model.blocks);

	const sizePt = $derived(
		page.landscape
			? { width: page.size.height, height: page.size.width }
			: page.size,
	);

	const pageWidthPx = $derived(ptToPx(sizePt.width) * RENDER_SCALE);
	const pageHeightPx = $derived(ptToPx(sizePt.height) * RENDER_SCALE);

	const marginsPx = $derived({
		left: cmToPx(page.margins.left) * RENDER_SCALE,
		right: cmToPx(page.margins.right) * RENDER_SCALE,
		top: cmToPx(page.margins.top) * RENDER_SCALE,
		bottom: cmToPx(page.margins.bottom) * RENDER_SCALE,
	});

	const contentWidthPx = $derived(pageWidthPx - marginsPx.left - marginsPx.right);
	const contentHeightPx = $derived(pageHeightPx - marginsPx.top - marginsPx.bottom);

	let viewportEl = $state<HTMLDivElement | null>(null);
	let viewportWidth = $state(0);

	$effect(() => {
		if (!viewportEl) return;
		const observer = new ResizeObserver((entries) => {
			viewportWidth = entries[0].contentRect.width;
		});
		observer.observe(viewportEl);
		return () => observer.disconnect();
	});

	const scale = $derived(viewportWidth > 0 ? viewportWidth / pageWidthPx : 1);

	// Classify each block based on its neighbours so Block can render empty
	// blocks at the correct height (parbreak gap vs regular linebreak advance).
	const blockRoles = $derived.by(() => {
		const roles = new Map<string, "text" | "parbreak" | "linebreak">();
		for (let i = 0; i < blocks.length; i++) {
			const b = blocks[i];
			if (b.text !== "") {
				roles.set(b.id, "text");
			} else {
				const prevHasText = i > 0 && blocks[i - 1].text !== "";
				roles.set(b.id, prevHasText ? "parbreak" : "linebreak");
			}
		}
		return roles;
	});

	// Measured block heights (id -> internal px).
	let heights = $state<Record<string, number>>({});

	// Walk the blocks, assigning each to a page. A block that doesn't fit in the
	// remaining space on the current page is pushed to the top of the next page.
	const layout = $derived.by(() => {
		// Distance from one page's content bottom to the next page's content top.
		const interPageGap = marginsPx.bottom + PAGE_GAP_PX + marginsPx.top;
		const items = new Map<string, { page: number; marginTop: number }>();
		let pageIndex = 0;
		let y = 0;
		for (let i = 0; i < blocks.length; i++) {
			const id = blocks[i].id;
			const h = heights[id] ?? 0;
			let marginTop = 0;
			if (i > 0 && y > 0 && y + h > contentHeightPx) {
				pageIndex += 1;
				// Fill the leftover space on the current page *plus* the gap, so the
				// block lands exactly at the next page's content top — never above
				// the paper edge.
				marginTop = contentHeightPx - y + interPageGap;
				y = 0;
			}
			items.set(id, { page: pageIndex, marginTop });
			y += h;
		}
		return { items, pageCount: pageIndex + 1 };
	});

	$effect(() => {
		documentStore.pageCount = layout.pageCount;
	});

	const totalHeightPx = $derived(
		layout.pageCount * pageHeightPx + (layout.pageCount - 1) * PAGE_GAP_PX,
	);

	// --- Block element registry + caret handling -----------------------------
	const blockEls = new Map<string, HTMLElement>();
	let pendingCaret: { id: string; offset: number } | null = null;

	function registerEl(id: string, el: HTMLElement | null): void {
		if (el) blockEls.set(id, el);
		else blockEls.delete(id);
	}

	function setCaret(el: HTMLElement, offset: number): void {
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		let node = walker.nextNode();
		const sel = window.getSelection();
		if (!sel) return;
		const range = document.createRange();
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

	async function focusPending(): Promise<void> {
		const pending = pendingCaret;
		pendingCaret = null;
		if (!pending) return;
		await tick();
		const el = blockEls.get(pending.id);
		if (el) {
			el.focus();
			setCaret(el, pending.offset);
		}
	}

	function onFocusBlock(id: string): void {
		documentStore.activeBlockId = id;
	}

	function onInputBlock(id: string, text: string): void {
		documentStore.setBlockText(id, text);
	}

	function onSplit(id: string, caretOffset: number): void {
		const block = blocks.find((b) => b.id === id);
		if (!block) return;
		const text = block.text;
		const before = text.slice(0, caretOffset);
		const after = text.slice(caretOffset);
		documentStore.setBlockText(id, before);
		const el = blockEls.get(id);
		if (el) {
			el.textContent = before;
			// Resetting textContent drops the sentinel <br>; an emptied block needs
			// it back to keep a line box (and consistent caret height).
			if (before === "") el.append(document.createElement("br"));
		}
		const newId = documentStore.insertBlockAfter(id, after);
		pendingCaret = { id: newId, offset: 0 };
		focusPending();
	}

	function onPasteLines(id: string, lines: string[]): void {
		// The first pasted line was inserted into `id`; turn the rest into blocks.
		let prevId = id;
		for (const line of lines) prevId = documentStore.insertBlockAfter(prevId, line);
		const lastLine = lines[lines.length - 1] ?? "";
		pendingCaret = { id: prevId, offset: lastLine.length };
		focusPending();
	}

	function onMergePrev(id: string): void {
		const result = documentStore.mergeWithPrevious(id);
		if (!result) return;
		pendingCaret = result;
		focusPending();
	}

	function onHeight(id: string, px: number): void {
		if (heights[id] !== px) heights[id] = px;
	}
</script>

<div bind:this={viewportEl} class="relative w-full max-w-[1240px]" style:height="{totalHeightPx * scale}px">
	<div
		class="absolute top-0 left-0"
		style:width="{pageWidthPx}px"
		style:height="{totalHeightPx}px"
		style:transform="scale({scale})"
		style:transform-origin="top left"
	>
		<!-- Page sheets -->
		{#each Array(layout.pageCount) as _, i (i)}
			<div
				class="absolute left-0 shadow-page"
				style:top="{i * (pageHeightPx + PAGE_GAP_PX)}px"
				style:width="{pageWidthPx}px"
				style:height="{pageHeightPx}px"
				style:background-color={page.fill}
				aria-hidden="true"
			></div>
		{/each}

		<!-- Continuous content flow (positioned over the first page's content area) -->
		<div
			class="absolute"
			style:top="{marginsPx.top}px"
			style:left="{marginsPx.left}px"
			style:width="{contentWidthPx}px"
		>
			{#each blocks as block, index (block.id)}
				<Block
					{block}
					scale={RENDER_SCALE}
					role={blockRoles.get(block.id)}
					marginTopPx={layout.items.get(block.id)?.marginTop ?? 0}
					placeholder={index === 0 && blocks.length === 1 ? "Start writing…" : undefined}
					registerel={registerEl}
					onheight={onHeight}
					onfocusblock={onFocusBlock}
					oninputblock={onInputBlock}
					onsplit={onSplit}
					onmergeprev={onMergePrev}
					onpastelines={onPasteLines}
				/>
			{/each}
		</div>
	</div>
</div>
