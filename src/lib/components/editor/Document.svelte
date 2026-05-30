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
    const blocks = $derived(model.blocks);

    // Paper size comes from the default page (we assume uniform paper across all pages).
    const defaultPage = $derived(documentStore.defaultPage);
    const sizePt = $derived(
        defaultPage.landscape
            ? { width: defaultPage.size.height, height: defaultPage.size.width }
            : defaultPage.size,
    );
    const pageWidthPx = $derived(ptToPx(sizePt.width) * RENDER_SCALE);
    const pageHeightPx = $derived(ptToPx(sizePt.height) * RENDER_SCALE);

    function resolveMarginsPx(pageIdx: number) {
        const { margins } = documentStore.pageSectionSource(pageIdx, "margin");
        return {
            left: cmToPx(margins.left) * RENDER_SCALE,
            right: cmToPx(margins.right) * RENDER_SCALE,
            top: cmToPx(margins.top) * RENDER_SCALE,
            bottom: cmToPx(margins.bottom) * RENDER_SCALE,
        };
    }

    function resolvePageFill(pageIdx: number): string {
        return documentStore.pageSectionSource(pageIdx, "color").fill;
    }

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

    // Non-continuation blocks that directly precede a continuation block must
    // also render inline so all segments flow on one visual line.
    const renderInlineIds = $derived.by(() => {
        const set = new Set<string>();
        for (let i = 0; i < blocks.length - 1; i++) {
            if (!blocks[i].continuation && blocks[i + 1].continuation) {
                set.add(blocks[i].id);
            }
        }
        return set;
    });

    // Classify each block based on its neighbours so Block can render empty
    // blocks at the correct height (parbreak gap vs regular linebreak advance).
    // Continuation blocks are always "text" regardless of content.
    const blockRoles = $derived.by(() => {
        const roles = new Map<string, "text" | "parbreak" | "linebreak">();
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b.continuation || b.text !== "") {
                roles.set(b.id, "text");
            } else {
                const nextHasText =
                    i < blocks.length - 1 &&
                    blocks[i + 1].text !== "" &&
                    !blocks[i + 1].continuation;
                roles.set(b.id, nextHasText ? "parbreak" : "linebreak");
            }
        }
        return roles;
    });

    // For each parbreak empty block: the visual gap should reflect the maximum
    // paragraph spacing of the adjacent content blocks (matching Typst's model).
    const parbreakSpacings = $derived.by(() => {
        const spacings = new Map<string, number>();
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b.text !== "" || b.continuation) continue;
            if (blockRoles.get(b.id) !== "parbreak") continue;
            let prev = model.paragraph.spacing;
            let next = model.paragraph.spacing;
            for (let j = i - 1; j >= 0; j--) {
                if (blocks[j].text !== "" && !blocks[j].continuation) {
                    prev = documentStore.resolveParagraph(blocks[j]).spacing;
                    break;
                }
            }
            for (let j = i + 1; j < blocks.length; j++) {
                if (blocks[j].text !== "" && !blocks[j].continuation) {
                    next = documentStore.resolveParagraph(blocks[j]).spacing;
                    break;
                }
            }
            spacings.set(b.id, Math.max(prev, next));
        }
        return spacings;
    });

    // Measured block heights (id -> internal px). Continuation blocks report 0.
    let heights = $state<Record<string, number>>({});

    // Walk blocks, assigning each to a page using per-page content heights.
    // Continuation blocks don't contribute to height and inherit the current page.
    const layout = $derived.by(() => {
        const items = new Map<string, { page: number }>();
        let pageIndex = 0;
        let y = 0;
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b.continuation) {
                items.set(b.id, { page: pageIndex });
                continue;
            }
            const h = heights[b.id] ?? 0;
            const mp = resolveMarginsPx(pageIndex);
            const chPx = pageHeightPx - mp.top - mp.bottom;
            if (i > 0 && y > 0 && y + h > chPx) {
                pageIndex += 1;
                y = 0;
            }
            items.set(b.id, { page: pageIndex });
            y += h;
        }
        return { items, pageCount: pageIndex + 1 };
    });

    $effect(() => {
        documentStore.pageCount = layout.pageCount;
        // Identify which block IDs start each new page (first block of pages 1+).
        const ids: string[] = [];
        let lastPage = 0;
        for (const b of blocks) {
            const pg = layout.items.get(b.id)?.page ?? 0;
            if (pg > lastPage) {
                ids.push(b.id);
                lastPage = pg;
            }
        }
        documentStore.pageBreakBlockIds = ids;
    });

    // Group blocks by page for per-page rendering.
    const blocksByPage = $derived.by(() => {
        const groups = new Map<number, (typeof blocks)[number][]>();
        for (const b of blocks) {
            const pg = layout.items.get(b.id)?.page ?? 0;
            if (!groups.has(pg)) groups.set(pg, []);
            groups.get(pg)!.push(b);
        }
        return groups;
    });

    const totalHeightPx = $derived(
        layout.pageCount * pageHeightPx + (layout.pageCount - 1) * PAGE_GAP_PX,
    );

    // --- Cross-block selection detection -------------------------------------
    //
    // The browser allows drag-selecting across separate contenteditable divs.
    // We watch selectionchange and record which block IDs are covered so the
    // store can apply formatting to all of them.
    $effect(() => {
        function measureOffset(
            el: HTMLElement,
            container: Node,
            offset: number,
        ): number {
            try {
                const r = document.createRange();
                r.selectNodeContents(el);
                r.setEnd(container, offset);
                return r.toString().length;
            } catch {
                return 0;
            }
        }

        function onSelectionChange(): void {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
                documentStore.selectionBlockIds = [];
                documentStore.intraBlockSelection = null;
                return;
            }
            const range = sel.getRangeAt(0);
            const covered = blocks
                .filter((b) => {
                    const el = blockEls.get(b.id);
                    return el != null && range.intersectsNode(el);
                })
                .map((b) => b.id);

            if (covered.length > 1) {
                documentStore.selectionBlockIds = covered;
                documentStore.intraBlockSelection = null;
            } else if (covered.length === 1) {
                documentStore.selectionBlockIds = [];
                // Track the partial selection within this single block.
                const el = blockEls.get(covered[0]);
                if (
                    el &&
                    el.contains(range.startContainer) &&
                    el.contains(range.endContainer)
                ) {
                    const start = measureOffset(
                        el,
                        range.startContainer,
                        range.startOffset,
                    );
                    const end = measureOffset(
                        el,
                        range.endContainer,
                        range.endOffset,
                    );
                    documentStore.intraBlockSelection =
                        start < end
                            ? { blockId: covered[0], start, end }
                            : null;
                } else {
                    documentStore.intraBlockSelection = null;
                }
            } else {
                documentStore.selectionBlockIds = [];
                documentStore.intraBlockSelection = null;
            }
        }

        document.addEventListener("selectionchange", onSelectionChange);
        return () => {
            document.removeEventListener("selectionchange", onSelectionChange);
            documentStore.selectionBlockIds = [];
            documentStore.intraBlockSelection = null;
        };
    });

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
        for (const line of lines)
            prevId = documentStore.insertBlockAfter(prevId, line);
        const lastLine = lines[lines.length - 1] ?? "";
        pendingCaret = { id: prevId, offset: lastLine.length };
        focusPending();
    }

    function syncBlockDom(el: HTMLElement, text: string): void {
        el.textContent = text;
        const hasTrailingBr = el.lastChild?.nodeName === "BR";
        if (text === "" && !hasTrailingBr) {
            el.append(document.createElement("br"));
        } else if (text !== "" && hasTrailingBr) {
            el.lastChild?.remove();
        }
    }

    function onMergePrev(id: string): void {
        const result = documentStore.mergeWithPrevious(id);
        if (!result) return;
        const merged = documentStore.findBlock(result.id);
        const el = blockEls.get(result.id);
        if (!el || !merged) return;
        documentStore.activeBlockId = result.id;
        syncBlockDom(el, merged.text);
        el.focus();
        setCaret(el, result.offset);
    }

    function caretOffsetIn(el: HTMLElement): number {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return 0;
        const range = sel.getRangeAt(0);
        const pre = document.createRange();
        pre.selectNodeContents(el);
        pre.setEnd(range.endContainer, range.endOffset);
        return pre.toString().length;
    }

    function caretAtEnd(el: HTMLElement, textLen: number): boolean {
        return (
            !!window.getSelection()?.isCollapsed && caretOffsetIn(el) >= textLen
        );
    }

    function caretAtStart(el: HTMLElement): boolean {
        return !!window.getSelection()?.isCollapsed && caretOffsetIn(el) === 0;
    }

    /** Offset after crossing into a sibling inline segment (skips a dead keypress at 0 / length). */
    function enterOffset(textLen: number, fromRight: boolean): number {
        if (textLen === 0) return 0;
        return fromRight ? 1 : textLen - 1;
    }

    // Capture-phase: cross inline segments before the browser's default (which
    // often cannot move between adjacent contenteditable elements).
    $effect(() => {
        if (!viewportEl) return;
        const root = viewportEl;

        function onKeydownCapture(event: KeyboardEvent): void {
            if (
                event.key !== "ArrowLeft" &&
                event.key !== "ArrowRight" &&
                event.key !== "Backspace"
            )
                return;
            const active = document.activeElement;
            if (
                !(active instanceof HTMLElement) ||
                !active.matches(".doc-block[contenteditable]")
            )
                return;
            if (!root.contains(active)) return;

            const id = active.dataset.blockId;
            if (!id) return;
            const idx = blocks.findIndex((b) => b.id === id);
            if (idx < 0) return;

            if (event.key === "Backspace") {
                if (!window.getSelection()?.isCollapsed) return;
                const offset = caretOffsetIn(active);
                const text = blocks[idx].text;

                // Mirror enterOffset: backspace at inline boundaries often needs two presses.
                if (offset === 1 && text.length >= 1) {
                    event.preventDefault();
                    event.stopPropagation();
                    const newText = text.slice(1);
                    documentStore.setBlockText(id, newText);
                    syncBlockDom(active, newText);
                    setCaret(active, 0);
                    return;
                }

                if (
                    offset === text.length - 1 &&
                    text.length > 1 &&
                    idx < blocks.length - 1 &&
                    blocks[idx + 1].continuation
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    const newText = text.slice(0, offset - 1) + text.slice(offset);
                    documentStore.setBlockText(id, newText);
                    syncBlockDom(active, newText);
                    setCaret(active, enterOffset(newText.length, false));
                    return;
                }

                if (offset === 0 && blocks[idx].continuation) {
                    event.preventDefault();
                    event.stopPropagation();
                    onMergePrev(id);
                }
                return;
            }

            if (event.key === "ArrowRight") {
                if (idx >= blocks.length - 1 || !blocks[idx + 1].continuation)
                    return;
                if (!caretAtEnd(active, blocks[idx].text.length)) return;
                event.preventDefault();
                event.stopPropagation();
                const next = blocks[idx + 1];
                const nextEl = blockEls.get(next.id);
                if (nextEl) {
                    documentStore.activeBlockId = next.id;
                    nextEl.focus();
                    setCaret(nextEl, enterOffset(next.text.length, true));
                }
            } else {
                if (!blocks[idx].continuation) return;
                if (!caretAtStart(active)) return;
                event.preventDefault();
                event.stopPropagation();
                const prev = blocks[idx - 1];
                const prevEl = blockEls.get(prev.id);
                if (prevEl) {
                    documentStore.activeBlockId = prev.id;
                    prevEl.focus();
                    setCaret(prevEl, enterOffset(prev.text.length, false));
                }
            }
        }

        window.addEventListener("keydown", onKeydownCapture, true);
        return () =>
            window.removeEventListener("keydown", onKeydownCapture, true);
    });

    // Restore selection after a block split (e.g. inline unlink).
    $effect(() => {
        const ps = documentStore.pendingSelection;
        if (!ps) return;
        documentStore.pendingSelection = null;
        const { blockId, start, end } = ps;
        tick().then(() => {
            const el = blockEls.get(blockId);
            if (!el) return;
            el.focus();
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const textNode = walker.nextNode();
            const range = document.createRange();
            if (textNode) {
                range.setStart(textNode, start);
                range.setEnd(textNode, end);
            } else {
                range.selectNodeContents(el);
            }
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });
    });

    function onHeight(id: string, px: number): void {
        const b = blocks.find((b) => b.id === id);
        const h = b?.continuation ? 0 : px;
        if (heights[id] !== h) heights[id] = h;
    }
</script>

<div
    bind:this={viewportEl}
    class="relative w-full max-w-[1240px]"
    style:height="{totalHeightPx * scale}px"
>
    <div
        class="absolute top-0 left-0"
        style:width="{pageWidthPx}px"
        style:height="{totalHeightPx}px"
        style:transform="scale({scale})"
        style:transform-origin="top left"
    >
        {#each Array(layout.pageCount) as _, pageIdx (pageIdx)}
            {@const mp = resolveMarginsPx(pageIdx)}
            {@const pageTop = pageIdx * (pageHeightPx + PAGE_GAP_PX)}
            <!-- Page sheet -->
            <div
                class="absolute left-0 shadow-page"
                style:top="{pageTop}px"
                style:width="{pageWidthPx}px"
                style:height="{pageHeightPx}px"
                style:background-color={resolvePageFill(pageIdx)}
                aria-hidden="true"
            ></div>
            <!-- Content area for this page (margins are per-page) -->
            <div
                class="absolute"
                style:top="{pageTop + mp.top}px"
                style:left="{mp.left}px"
                style:width="{pageWidthPx - mp.left - mp.right}px"
            >
                {#each blocksByPage.get(pageIdx) ?? [] as block, i (block.id)}
                    <Block
                        {block}
                        scale={RENDER_SCALE}
                        role={blockRoles.get(block.id)}
                        spacingEm={parbreakSpacings.get(block.id)}
                        renderInline={renderInlineIds.has(block.id)}
                        placeholder={pageIdx === 0 &&
                        i === 0 &&
                        blocks.length === 1
                            ? "Start writing…"
                            : undefined}
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
        {/each}
    </div>
</div>
