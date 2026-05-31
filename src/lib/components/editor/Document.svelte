<script lang="ts">
    import { tick } from "svelte";
    import Block from "./Block.svelte";
    import { documentStore } from "$lib/document/store.svelte";
    import { formatItem, formatNumbering } from "$lib/document/numbering";
    import { cmToPx, ptToPx } from "$lib/document/units";
    import {
        caretAtEnd,
        caretAtStart,
        getCaretOffset,
        measureOffset,
        setCaretOffset,
        setCaretRange,
    } from "./caret";

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

    // List marker text per block (computed across contiguous groups).
    const listMarkers = $derived.by(() => {
        const map = new Map<string, string>();
        let i = 0;
        while (i < blocks.length) {
            const b = blocks[i];
            if (!b.list) {
                i++;
                continue;
            }
            const first = b.list;
            const kind = first.kind;
            // Gather contiguous block IDs in this list group.
            const ids: string[] = [];
            let j = i;
            while (j < blocks.length && blocks[j].list?.kind === kind) {
                ids.push(blocks[j].id);
                j++;
            }
            if (kind === "bullet") {
                for (const id of ids) map.set(id, first.marker ?? "•");
            } else {
                const pattern = first.marker ?? "1.";
                // When reversed and no explicit start, count down from the total.
                const start = first.start ?? (first.reversed ? ids.length : 1);
                for (let k = 0; k < ids.length; k++) {
                    const n = first.reversed ? start - k : start + k;
                    map.set(ids[k], formatItem(pattern, n));
                }
            }
            i = j;
        }
        return map;
    });

    // Heading number prefixes (e.g. "1.", "1.2") from outline counters.
    const headingNumbers = $derived.by(() => {
        const map = new Map<string, string>();
        const counters = [0, 0, 0, 0, 0];
        for (const b of blocks) {
            if (!b.heading || b.heading.level === 0) continue;
            const level = b.heading.level;
            const pattern = documentStore.resolveHeadingStyle(level).numbering;
            if (!pattern) continue;
            counters[level] += 1;
            for (let l = level + 1; l <= 4; l++) counters[l] = 0;
            const nums = counters.slice(1, level + 1);
            const label = formatNumbering(pattern, nums);
            map.set(b.id, label.length > 0 ? `${label} ` : "");
        }
        return map;
    });

    // Per list item: tight spacing flag and whether another item follows in the group.
    const listItemLayout = $derived.by(() => {
        const map = new Map<string, { tight: boolean; hasNext: boolean; isFirst: boolean }>();
        let i = 0;
        while (i < blocks.length) {
            const b = blocks[i];
            if (!b.list) {
                i++;
                continue;
            }
            const kind = b.list.kind;
            const ids: string[] = [];
            let j = i;
            while (j < blocks.length && blocks[j].list?.kind === kind) {
                ids.push(blocks[j].id);
                j++;
            }
            const tight = blocks[i].list?.tight !== false;
            for (let k = 0; k < ids.length; k++) {
                map.set(ids[k], { tight, hasNext: k < ids.length - 1, isFirst: k === 0 });
            }
            i = j;
        }
        return map;
    });

    function isListBlock(b: (typeof blocks)[number] | undefined): boolean {
        return !!b?.list;
    }

    function isEmbedBlock(b: (typeof blocks)[number] | undefined): boolean {
        return !!(b && (b.image || b.line || b.rect || b.outline));
    }

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
            if (b.continuation || b.text !== "" || isEmbedBlock(b)) {
                roles.set(b.id, "text");
            } else {
                const prev = i > 0 ? blocks[i - 1] : undefined;
                const next = i < blocks.length - 1 ? blocks[i + 1] : undefined;
                // Blanks after headings/lists keep linebreak height — those elements
                // carry their own visual spacing via margin-top/bottom.
                // Otherwise: parbreak when something follows this blank (another blank
                // or text), linebreak when this blank is terminal (end of doc, or the
                // next element is a heading/list that handles its own spacing).
                // A parbreak only makes visual sense when real content sandwiches
                // this blank on both sides. With nothing above or below (the doc
                // is entirely empty / leading or trailing blanks), Enter should
                // act like a plain newline.
                let hasContentAbove = false;
                for (let j = i - 1; j >= 0; j--) {
                    const bb = blocks[j];
                    if (bb.text !== "" || isEmbedBlock(bb) || bb.heading || bb.list) {
                        hasContentAbove = true;
                        break;
                    }
                }
                let hasContentBelow = false;
                for (let j = i + 1; j < blocks.length; j++) {
                    const bb = blocks[j];
                    if (bb.text !== "" || isEmbedBlock(bb) || bb.heading || bb.list) {
                        hasContentBelow = true;
                        break;
                    }
                }
                if (prev?.heading || isListBlock(prev)) {
                    roles.set(b.id, "linebreak");
                } else if (!hasContentAbove || !hasContentBelow) {
                    roles.set(b.id, "linebreak");
                } else if (next == null || next.heading || isListBlock(next) || next.continuation) {
                    roles.set(b.id, "linebreak");
                } else {
                    roles.set(b.id, "parbreak");
                }
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
                if ((blocks[j].text !== "" || isEmbedBlock(blocks[j])) && !blocks[j].continuation) {
                    prev = documentStore.resolveParagraph(blocks[j]).spacing;
                    break;
                }
            }
            for (let j = i + 1; j < blocks.length; j++) {
                if ((blocks[j].text !== "" || isEmbedBlock(blocks[j])) && !blocks[j].continuation) {
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

    // First non-continuation block on each page. These suppress their `above`
    // spacing — Typst collapses block(above: …) at the top of a page since
    // there is nothing above it to push away from.
    const pageTopIds = $derived.by(() => {
        const set = new Set<string>();
        const seen = new Set<number>();
        for (const b of blocks) {
            if (b.continuation) continue;
            const pg = layout.items.get(b.id)?.page ?? 0;
            if (seen.has(pg)) continue;
            seen.add(pg);
            set.add(b.id);
        }
        return set;
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

    /**
     * Group a page's blocks into a flat list of render items. Contiguous list
     * blocks of the same kind become a single `listGroup` item so the renderer
     * can wrap them in one alignment container — that's what keeps markers in
     * the same vertical column when the group is centered/right-aligned.
     */
    type RenderItem =
        | { kind: "block"; block: (typeof blocks)[number]; index: number }
        | {
              kind: "listGroup";
              items: (typeof blocks)[number][];
              alignment: "left" | "center" | "right";
          };

    function buildRenderItems(pageBlocks: (typeof blocks)[number][]): RenderItem[] {
        const out: RenderItem[] = [];
        let i = 0;
        while (i < pageBlocks.length) {
            const b = pageBlocks[i];
            if (b.list) {
                const kind = b.list.kind;
                const group: (typeof blocks)[number][] = [];
                while (i < pageBlocks.length && pageBlocks[i].list?.kind === kind) {
                    group.push(pageBlocks[i]);
                    i++;
                }
                out.push({
                    kind: "listGroup",
                    items: group,
                    alignment: (group[0].alignment ?? "left") as "left" | "center" | "right",
                });
            } else {
                out.push({ kind: "block", block: b, index: i });
                i++;
            }
        }
        return out;
    }

    const totalHeightPx = $derived(
        layout.pageCount * pageHeightPx + (layout.pageCount - 1) * PAGE_GAP_PX,
    );

    // --- Cross-block selection detection -------------------------------------
    //
    // The browser allows drag-selecting across separate contenteditable divs.
    // We watch selectionchange and record which block IDs are covered so the
    // store can apply formatting to all of them.
    $effect(() => {
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

    async function focusPending(): Promise<void> {
        const pending = pendingCaret;
        pendingCaret = null;
        if (!pending) return;
        await tick();
        const el = blockEls.get(pending.id);
        if (el) {
            el.focus();
            setCaretOffset(el, pending.offset);
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

        // Pressing Enter on an empty list item exits the list; on an empty
        // heading converts it to a plain block. Caret stays in the same block.
        if (text === "" && block.list) {
            documentStore.setList(id, undefined);
            block.placeholder = undefined;
            const el = blockEls.get(id);
            if (el) syncBlockDom(el, "");
            pendingCaret = { id, offset: 0 };
            focusPending();
            return;
        }
        if (text === "" && block.heading) {
            documentStore.setHeading(id, undefined);
            block.placeholder = undefined;
            const el = blockEls.get(id);
            if (el) syncBlockDom(el, "");
            return;
        }

        const before = text.slice(0, caretOffset);
        const after = text.slice(caretOffset);
        documentStore.setBlockText(id, before);
        const el = blockEls.get(id);
        if (el) {
            el.textContent = before;
            if (before === "") el.append(document.createElement("br"));
        }
        // List items continue the list; headings end and the next block is plain.
        let newId: string;
        if (block.list) {
            newId = documentStore.insertBlockObjectAfter(id, {
                text: after,
                list: { ...block.list },
                placeholder: "Item",
            });
        } else {
            newId = documentStore.insertBlockAfter(id, after);
        }
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
        // A trailing <br> keeps an empty contenteditable from collapsing, but
        // it also defeats the `:empty::before` rule that paints the placeholder.
        // Only add the <br> when the block has no placeholder to fall back on.
        const placeholder = el.dataset.placeholder;
        const hasTrailingBr = el.lastChild?.nodeName === "BR";
        if (text === "" && !placeholder && !hasTrailingBr) {
            el.append(document.createElement("br"));
        } else if ((text !== "" || placeholder) && hasTrailingBr) {
            el.lastChild?.remove();
        }
    }

    function onMergePrev(id: string): void {
        // Special case: Backspace at the start of an empty text block whose
        // previous block is an embed → delete the embed and place the caret
        // at the end of the block above it (see store.embedAwaitingDelete).
        const idx = blocks.findIndex((b) => b.id === id);
        if (idx > 0 && blocks[idx]?.text === "") {
            const prev = blocks[idx - 1];
            if (prev && (prev.image || prev.line || prev.rect || prev.outline)) {
                const result = documentStore.deleteEmbed(prev.id);
                if (result) {
                    pendingCaret = result;
                    focusPending();
                }
                return;
            }
        }
        const result = documentStore.mergeWithPrevious(id);
        if (!result) return;
        // Update active block right away so the toolbar reflects the new target,
        // even when the focus target is an embed with no editable element.
        documentStore.activeBlockId = result.id;
        pendingCaret = result;
        focusPending();
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
                const offset = getCaretOffset(active);
                const text = blocks[idx].text;
                const isCont = blocks[idx].continuation;

                if (offset === 0) {
                    if (isCont) {
                        event.preventDefault();
                        event.stopPropagation();
                        onMergePrev(id);
                    }
                    // Non-continuation at offset 0: let Block.svelte handle via bubble phase.
                    return;
                }

                // Mirror enterOffset: backspace at inline boundaries often needs two presses.
                // For non-continuation blocks only — continuation blocks are fully handled below.
                if (!isCont && offset === 1 && text.length >= 1) {
                    event.preventDefault();
                    event.stopPropagation();
                    const newText = text.slice(1);
                    documentStore.setBlockText(id, newText);
                    syncBlockDom(active, newText);
                    if (newText === "") {
                        // setBlockText("") may strip heading/list metadata causing a remount;
                        // pendingCaret handles focus on the new element after Svelte's update.
                        pendingCaret = { id, offset: 0 };
                        focusPending();
                    } else {
                        setCaretOffset(active, 0);
                    }
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
                    setCaretOffset(active, enterOffset(newText.length, false));
                    return;
                }

                // Take over all backspace events inside continuation blocks to prevent
                // browsers from jumping the cursor out of inline contenteditable spans.
                // Merge immediately when the block becomes empty (no two-step dance).
                if (isCont) {
                    event.preventDefault();
                    event.stopPropagation();
                    const newText = text.slice(0, offset - 1) + text.slice(offset);
                    if (newText === "") {
                        documentStore.setBlockText(id, "");
                        onMergePrev(id);
                    } else {
                        documentStore.setBlockText(id, newText);
                        syncBlockDom(active, newText);
                        setCaretOffset(active, offset - 1);
                    }
                    return;
                }
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
                    setCaretOffset(nextEl, enterOffset(next.text.length, true));
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
                    setCaretOffset(prevEl, enterOffset(prev.text.length, false));
                }
            }
        }

        window.addEventListener("keydown", onKeydownCapture, true);
        return () =>
            window.removeEventListener("keydown", onKeydownCapture, true);
    });

    // Focus a block requested by an external action (e.g. inserting from a popup).
    $effect(() => {
        const id = documentStore.pendingFocus;
        if (!id) return;
        documentStore.pendingFocus = null;
        tick().then(() => {
            const el = blockEls.get(id);
            if (!el) return;
            el.focus();
            setCaretOffset(el, el.textContent?.length ?? 0);
        });
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
            setCaretRange(el, start, end);
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
            {@const pageBlocks = blocksByPage.get(pageIdx) ?? []}
            {@const renderItems = buildRenderItems(pageBlocks)}
            <!-- Content area for this page (margins are per-page) -->
            <div
                class="absolute"
                style:top="{pageTop + mp.top}px"
                style:left="{mp.left}px"
                style:width="{pageWidthPx - mp.left - mp.right}px"
            >
                {#each renderItems as item, ri (ri)}
                    {#if item.kind === "listGroup"}
                        {@const justifyClass =
                            item.alignment === "center"
                                ? "justify-center"
                                : item.alignment === "right"
                                    ? "justify-end"
                                    : "justify-start"}
                        <!-- The group is `inline-flex flex-col items-stretch` so it
                             shrinks to the widest item but stretches each row to
                             the group width, keeping markers in column 1. -->
                        <div class={["flex w-full", justifyClass]}>
                            <div class="inline-flex max-w-full flex-col items-stretch">
                                {#each item.items as block (block.id)}
                                    <Block
                                        {block}
                                        scale={RENDER_SCALE}
                                        role={blockRoles.get(block.id)}
                                        spacingEm={parbreakSpacings.get(block.id)}
                                        renderInline={renderInlineIds.has(block.id)}
                                        marker={listMarkers.get(block.id)}
                                        headingPrefix={headingNumbers.get(block.id)}
                                        listTight={listItemLayout.get(block.id)?.tight}
                                        listHasNext={listItemLayout.get(block.id)?.hasNext}
                                        listGroupFirst={listItemLayout.get(block.id)?.isFirst}
                                        suppressAbove={pageTopIds.has(block.id)}
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
                    {:else}
                        {@const block = item.block}
                        <Block
                            {block}
                            scale={RENDER_SCALE}
                            role={blockRoles.get(block.id)}
                            spacingEm={parbreakSpacings.get(block.id)}
                            renderInline={renderInlineIds.has(block.id)}
                            marker={listMarkers.get(block.id)}
                            headingPrefix={headingNumbers.get(block.id)}
                            listTight={listItemLayout.get(block.id)?.tight}
                            listHasNext={listItemLayout.get(block.id)?.hasNext}
                            listGroupFirst={listItemLayout.get(block.id)?.isFirst}
                            suppressAbove={pageTopIds.has(block.id)}
                            placeholder={pageIdx === 0 &&
                            item.index === 0 &&
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
                    {/if}
                {/each}
            </div>
        {/each}
    </div>
</div>
