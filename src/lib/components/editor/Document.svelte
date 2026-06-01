<script lang="ts">
    import { tick } from "svelte";
    import Block from "./Block.svelte";
    import PageZonePopup from "./PageZonePopup.svelte";
    import {
        resolveBlockHeadingSpacing,
        resolveBlockListSpacing,
    } from "$lib/document/blockLevelStyle";
    import { documentStore } from "$lib/document/store.svelte";
    import { formatItem, formatNumbering } from "$lib/document/numbering";
    import { parbreakGapEm } from "$lib/document/lineMetrics";
    import { marginInsetPx } from "$lib/document/pageZoneInset";
    import { cmToPx, ptToPx } from "$lib/document/units";
    import {
        caretAtEnd,
        caretAtStart,
        getCaretOffset,
        measureOffset,
        setCaretOffset,
        setCaretRange,
    } from "./caret";
    import { zoomStore } from "$lib/document/zoom.svelte";

    // Render the page at a higher internal pixel density and scale it *down* to
    // fit the viewport: layout matches the PDF, and the caret renders crisp/thin.
    const RENDER_SCALE = 2;
    // Visual gap between page sheets, in internal render pixels.
    const PAGE_GAP_PX = 40;

    interface Props {
        scaledPageWidthPx?: number;
    }
    let { scaledPageWidthPx = $bindable(0) }: Props = $props();

    const model = $derived(documentStore.model);
    // Zone blocks (header/footer) are stored in the main blocks array but excluded
    // from the body layout. They are rendered separately in the page margin areas.
    const allBlocks = $derived(model.blocks);
    const blocks = $derived(allBlocks.filter((b) => !b.zoneKind));
    const headerBlocks = $derived(documentStore.headerBlocks);
    const footerBlocks = $derived(documentStore.footerBlocks);

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
    let headerZoneAnchorEl = $state<HTMLElement | null>(null);
    let footerZoneAnchorEl = $state<HTMLElement | null>(null);
    let zonePopupEl = $state<HTMLDivElement | null>(null);
    let zonePopupStyle = $state<{
        left: string;
        top: string;
        transform: string;
    } | null>(null);

    /** Extra downward offset so the header popup sits closer to the page body. */
    const HEADER_ZONE_POPUP_OFFSET = -40;
    /** Offset above the footer margin edge (popup anchor). */
    const FOOTER_ZONE_POPUP_OFFSET = -40;

    function headerZoneAnchor(
        node: HTMLElement,
        active: boolean,
    ): { destroy: () => void } | void {
        if (!active) return;
        headerZoneAnchorEl = node;
        return {
            destroy: () => {
                if (headerZoneAnchorEl === node) headerZoneAnchorEl = null;
            },
        };
    }

    function footerZoneAnchor(
        node: HTMLElement,
        active: boolean,
    ): { destroy: () => void } | void {
        if (!active) return;
        footerZoneAnchorEl = node;
        return {
            destroy: () => {
                if (footerZoneAnchorEl === node) footerZoneAnchorEl = null;
            },
        };
    }

    $effect(() => {
        if (!viewportEl) return;
        const observer = new ResizeObserver((entries) => {
            viewportWidth = entries[0].contentRect.width;
        });
        observer.observe(viewportEl);
        return () => observer.disconnect();
    });

    const scale = $derived(viewportWidth > 0 ? (viewportWidth / pageWidthPx) * zoomStore.value : 1);
    const centerOffsetPx = $derived((viewportWidth - pageWidthPx * scale) / 2);
    $effect(() => { scaledPageWidthPx = pageWidthPx * scale; });

    $effect(() => {
        const zone = documentStore.activeZone;
        if (zone) documentStore.zoneSettingsKind = zone;
    });

    $effect(() => {
        const kind = documentStore.zoneSettingsKind;
        model.headerAscent;
        model.footerDescent;
        scale;
        headerZoneAnchorEl;
        footerZoneAnchorEl;

        if (!kind) {
            zonePopupStyle = null;
            return;
        }

        const update = (): void => {
            const el = kind === "header" ? headerZoneAnchorEl : footerZoneAnchorEl;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            if (kind === "header") {
                zonePopupStyle = {
                    left: `${centerX}px`,
                    top: `${rect.bottom + HEADER_ZONE_POPUP_OFFSET}px`,
                    transform: "translate(-50%, 0)",
                };
            } else {
                zonePopupStyle = {
                    left: `${centerX}px`,
                    top: `${rect.top - FOOTER_ZONE_POPUP_OFFSET}px`,
                    transform: "translate(-50%, -100%)",
                };
            }
        };

        update();
        const scroller = viewportEl?.closest("main");
        scroller?.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);

        const ro = new ResizeObserver(update);
        if (headerZoneAnchorEl) ro.observe(headerZoneAnchorEl);
        if (footerZoneAnchorEl) ro.observe(footerZoneAnchorEl);

        return () => {
            scroller?.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
            ro.disconnect();
        };
    });

    function onZoneSettingsPointerDown(event: PointerEvent): void {
        if (!documentStore.zoneSettingsKind) return;
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (zonePopupEl?.contains(target)) return;
        if (target instanceof Element && target.closest("[data-page-zone]")) return;
        documentStore.zoneSettingsKind = null;
    }

    $effect(() => {
        if (!documentStore.zoneSettingsKind) return;
        document.addEventListener("pointerdown", onZoneSettingsPointerDown, true);
        return () =>
            document.removeEventListener("pointerdown", onZoneSettingsPointerDown, true);
    });

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
        const map = new Map<
            string,
            { tight: boolean; hasNext: boolean; isFirst: boolean }
        >();
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
                map.set(ids[k], {
                    tight,
                    hasNext: k < ids.length - 1,
                    isFirst: k === 0,
                });
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

    function aboveContribution(b: (typeof blocks)[number]): number {
        if (b.heading) {
            return (
                resolveBlockHeadingSpacing(documentStore.model, b)?.above ?? 0
            );
        }
        if (b.list) {
            return (
                resolveBlockListSpacing(
                    documentStore.model,
                    b,
                    documentStore.pageBreakBlockIds,
                )?.above ?? 0
            );
        }
        if (isEmbedBlock(b)) {
            return documentStore.resolveEmbedSpacing(b)?.above ?? 0;
        }
        return 0;
    }

    function paragraphGapEm(b: (typeof blocks)[number]): number {
        return parbreakGapEm(
            documentStore.resolveParagraph(b),
            documentStore.resolveTypography(b),
        );
    }

    function belowContribution(b: (typeof blocks)[number]): number {
        if (b.heading) {
            return (
                resolveBlockHeadingSpacing(documentStore.model, b)?.below ?? 0
            );
        }
        if (b.list) {
            return (
                resolveBlockListSpacing(
                    documentStore.model,
                    b,
                    documentStore.pageBreakBlockIds,
                )?.below ?? 0
            );
        }
        if (isEmbedBlock(b)) {
            return documentStore.resolveEmbedSpacing(b)?.below ?? 0;
        }
        return 0;
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
                // Parbreak only when this blank sits between real content on at
                // least one side. With nothing anywhere (entirely empty doc)
                // Enter should just advance a line. And the blank immediately
                // before a heading/list/embed reverts to linebreak, since the
                // block-level element supplies its own explicit `above`.
                let hasContentAbove = false;
                for (let j = i - 1; j >= 0; j--) {
                    const bb = blocks[j];
                    if (isFootnoteZoneBlock(bb)) continue;
                    if (bb.text !== "" || isEmbedBlock(bb) || bb.heading || bb.list) {
                        hasContentAbove = true;
                        break;
                    }
                }
                let hasContentBelow = false;
                for (let j = i + 1; j < blocks.length; j++) {
                    const bb = blocks[j];
                    if (isFootnoteZoneBlock(bb)) continue;
                    if (bb.text !== "" || isEmbedBlock(bb) || bb.heading || bb.list) {
                        hasContentBelow = true;
                        break;
                    }
                }
                const prevIsBlank =
                    prev != null &&
                    !prev.continuation &&
                    prev.text === "" &&
                    !prev.heading &&
                    !prev.list &&
                    !isEmbedBlock(prev);
                if (prev?.heading || isListBlock(prev)) {
                    roles.set(b.id, "linebreak");
                } else if (prevIsBlank) {
                    // Only the first blank after real content pays the parbreak
                    // gap; subsequent blanks in the run advance one line each.
                    roles.set(b.id, "linebreak");
                } else if (next == null || next.continuation) {
                    roles.set(b.id, "linebreak");
                } else if (next.heading || next.list || isEmbedBlock(next)) {
                    roles.set(b.id, "linebreak");
                } else if (!hasContentAbove && !hasContentBelow) {
                    roles.set(b.id, "linebreak");
                } else {
                    roles.set(b.id, "parbreak");
                }
            }
        }
        return roles;
    });

    // Match Typst: first-line indent applies to consecutive paragraphs only,
    // not the first paragraph in the document or after block-level content.
    const skipsFirstLineIndent = $derived.by(() => {
        const map = new Map<string, boolean>();
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (
                b.continuation ||
                b.heading ||
                b.list ||
                isEmbedBlock(b) ||
                b.text === ""
            ) {
                map.set(b.id, true);
                continue;
            }
            let sawParbreak = false;
            let skip = true;
            for (let j = i - 1; j >= 0; j--) {
                const prev = blocks[j];
                if (prev.continuation || isFootnoteZoneBlock(prev)) continue;
                if (prev.heading || prev.list || isEmbedBlock(prev)) break;
                if (prev.text !== "") {
                    skip = !sawParbreak;
                    break;
                }
                if (blockRoles.get(prev.id) === "parbreak") {
                    sawParbreak = true;
                }
            }
            map.set(b.id, skip);
        }
        return map;
    });

    // For each parbreak empty block: the visual gap should reflect the maximum
    // paragraph spacing of the adjacent content blocks (matching Typst's model).
    const parbreakSpacings = $derived.by(() => {
        const spacings = new Map<string, number>();
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b.text !== "" || b.continuation) continue;
            if (blockRoles.get(b.id) !== "parbreak") continue;
            const defaultGap = parbreakGapEm(model.paragraph, model.typography);
            let prev = defaultGap;
            let next = defaultGap;
            for (let j = i - 1; j >= 0; j--) {
                const pb = blocks[j];
                if (isFootnoteZoneBlock(pb) || pb.continuation) continue;
                if (pb.text !== "" || isEmbedBlock(pb)) {
                    prev = Math.max(paragraphGapEm(pb), belowContribution(pb));
                    break;
                }
            }
            for (let j = i + 1; j < blocks.length; j++) {
                const nb = blocks[j];
                if (isFootnoteZoneBlock(nb) || nb.continuation) continue;
                if (nb.text !== "" || isEmbedBlock(nb)) {
                    next = Math.max(paragraphGapEm(nb), aboveContribution(nb));
                    break;
                }
            }
            spacings.set(b.id, prev);
        }
        return spacings;
    });

    // Measured block heights (id -> internal px). Continuation/zone blocks report 0
    // so they don't participate in page-break detection.
    let heights = $state<Record<string, number>>({});

    // Actual measured heights of footnote zone blocks (separator + bodies).
    // Kept separate from `heights` so the layout algorithm can use them for
    // computing reserved space without affecting non-zone block measurements.
    let zoneHeights = $state<Record<string, number>>({});

    // Walk blocks, assigning each to a page using per-page content heights.
    // Continuation and footnote zone blocks don't contribute to height and
    // inherit the current page index.
    //
    // Two-pass approach: pass 1 assigns pages naively; pass 2 reserves space
    // at the bottom of each page for its footnote zone (clearance + separator
    // + gap-per-body + body heights) and re-runs the assignment.
    const layout = $derived.by(() => {
        const emPx = ptToPx(model.typography.size) * RENDER_SCALE;

        function pass(reserved: Map<number, number>): Map<string, { page: number }> {
            const items = new Map<string, { page: number }>();
            let pageIndex = 0;
            let y = 0;

            // First pass: assign all non-zone blocks (content + continuation/markers).
            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                if (b.footnote || b.footnoteSeparator) continue;
                if (b.continuation) {
                    items.set(b.id, { page: pageIndex });
                    continue;
                }
                if (b.pageBreak) {
                    items.set(b.id, { page: pageIndex });
                    pageIndex += 1;
                    y = 0;
                    continue;
                }
                const h = heights[b.id] ?? 0;
                const mp = resolveMarginsPx(pageIndex);
                const chPx =
                    pageHeightPx - mp.top - mp.bottom - (reserved.get(pageIndex) ?? 0);
                if (i > 0 && y > 0 && y + h > chPx) {
                    pageIndex += 1;
                    y = 0;
                }
                items.set(b.id, { page: pageIndex });
                y += h;
            }

            // Second pass: pin footnote zone blocks to the page of their marker.
            // Footnote bodies go to the page where their footnoteMarker lives.
            // The separator goes to the same page as the footnote bodies that follow
            // it in the blocks array.
            for (const b of blocks) {
                if (!b.footnote) continue;
                const marker = blocks.find(
                    (m) => m.footnoteMarker?.footnoteId === b.footnote!.footnoteId,
                );
                const pg = marker ? (items.get(marker.id)?.page ?? 0) : pageIndex;
                items.set(b.id, { page: pg });
            }
            for (let i = 0; i < blocks.length; i++) {
                if (!blocks[i].footnoteSeparator) continue;
                // Find the first footnote body after this separator.
                let pg = pageIndex;
                for (let j = i + 1; j < blocks.length; j++) {
                    if (blocks[j].footnote) {
                        pg = items.get(blocks[j].id)?.page ?? pageIndex;
                        break;
                    }
                }
                items.set(blocks[i].id, { page: pg });
            }

            return items;
        }

        // Pass 1: no footnote reservation.
        const pass1 = pass(new Map());

        // Compute footnote zone reserved height for each page based on pass 1.
        const reserved = new Map<number, number>();
        for (const b of blocks) {
            if (!b.footnote && !b.footnoteSeparator) continue;
            const pg = pass1.get(b.id)?.page ?? 0;
            if (!reserved.has(pg)) reserved.set(pg, 0);
        }
        for (const [pg] of reserved) {
            const settings = documentStore.resolveFootnoteSettings(pg);
            const clearancePx = settings.clearance * emPx;
            const gapPx = settings.gap * emPx;
            const sep = blocks.find(
                (b) => b.footnoteSeparator && (pass1.get(b.id)?.page ?? 0) === pg,
            );
            const bodies = blocks.filter(
                (b) => b.footnote && (pass1.get(b.id)?.page ?? 0) === pg,
            );
            const sepH = sep ? (zoneHeights[sep.id] ?? 0) : 0;
            const bodiesH = bodies.reduce((s, b) => s + (zoneHeights[b.id] ?? 0), 0);
            reserved.set(pg, clearancePx + sepH + gapPx * bodies.length + bodiesH);
        }

        // Pass 2: re-run with reserved space per page.
        const items = pass(reserved);
        let pageCount = 1;
        for (const { page } of items.values()) pageCount = Math.max(pageCount, page + 1);
        return { items, pageCount };
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
              kind: "inlineLine";
              items: (typeof blocks)[number][];
              index: number;
          }
        | {
              kind: "listGroup";
              items: (typeof blocks)[number][];
              alignment: "left" | "center" | "right";
          };

    function buildRenderItems(
        pageBlocks: (typeof blocks)[number][],
    ): RenderItem[] {
        const out: RenderItem[] = [];
        let i = 0;
        while (i < pageBlocks.length) {
            const b = pageBlocks[i];
            if (b.list) {
                const kind = b.list.kind;
                const group: (typeof blocks)[number][] = [];
                while (
                    i < pageBlocks.length &&
                    pageBlocks[i].list?.kind === kind
                ) {
                    group.push(pageBlocks[i]);
                    i++;
                }
                out.push({
                    kind: "listGroup",
                    items: group,
                    alignment: (group[0].alignment ?? "left") as
                        | "left"
                        | "center"
                        | "right",
                });
            } else if (!b.continuation) {
                const line: (typeof blocks)[number][] = [b];
                let j = i + 1;
                while (
                    j < pageBlocks.length &&
                    pageBlocks[j].continuation
                ) {
                    line.push(pageBlocks[j]);
                    j++;
                }
                if (line.length > 1) {
                    out.push({ kind: "inlineLine", items: line, index: i });
                } else {
                    out.push({ kind: "block", block: b, index: i });
                }
                i = j;
            } else {
                out.push({ kind: "block", block: b, index: i });
                i++;
            }
        }
        return out;
    }

    // Stable per-item key for the render loop. Keying by block id (rather than
    // position index) is essential: when blocks are spliced out, an index key
    // would make Svelte reuse a slot's DOM/component for a *different* block,
    // and Block.svelte skips DOM text sync for the focused block — leaving the
    // reused element showing the previous block's stale (often empty) text.
    function renderItemKey(item: RenderItem): string {
        if (item.kind === "block") return item.block.id;
        return item.items[0].id;
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
                documentStore.selection = null;
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
                documentStore.selection = { kind: "multiBlock", blockIds: covered };
            } else if (covered.length === 1) {
                const el = blockEls.get(covered[0]);
                if (
                    el &&
                    el.contains(range.startContainer) &&
                    el.contains(range.endContainer)
                ) {
                    const start = measureOffset(el, range.startContainer, range.startOffset);
                    const end = measureOffset(el, range.endContainer, range.endOffset);
                    documentStore.selection = start < end
                        ? { kind: "intraBlock", blockId: covered[0], start, end }
                        : null;
                } else {
                    documentStore.selection = null;
                }
            } else {
                documentStore.selection = null;
            }
        }

        document.addEventListener("selectionchange", onSelectionChange);
        return () => {
            document.removeEventListener("selectionchange", onSelectionChange);
            documentStore.selection = null;
        };
    });

    // --- Block element registry + focus management --------------------------
    const blockEls = new Map<string, HTMLElement>();

    function registerEl(id: string, el: HTMLElement | null): void {
        if (el) blockEls.set(id, el);
        else blockEls.delete(id);
    }

    function onFocusBlock(id: string): void {
        documentStore.activeBlockId = id;
    }

    /** Empty continuation segment whose previous block is an inline embed (h-spacing, footnote marker, reference, citation). */
    function isEmptyTailAfterInlineEmbed(idx: number): boolean {
        const block = blocks[idx];
        if (!block?.continuation || block.text !== "") return false;
        const prev = idx > 0 ? blocks[idx - 1] : undefined;
        return !!(prev?.hSpacing || prev?.footnoteMarker || prev?.reference || prev?.citation || prev?.link);
    }

    /** Empty text block whose previous block is vertical spacing (two-step delete). */
    function isEmptyBlockAfterVSpacing(idx: number): boolean {
        const block = blocks[idx];
        if (!block || block.text !== "" || block.continuation) return false;
        const prev = idx > 0 ? blocks[idx - 1] : undefined;
        return !!prev?.vSpacing;
    }

    /** Clicks in the gap after an inline embed focus the empty tail segment. */
    function onInlineLineMouseDown(
        event: MouseEvent,
        items: (typeof blocks)[number][],
    ): void {
        const lineEl = event.currentTarget as HTMLElement;
        const target = event.target as Node;

        for (let i = 0; i < items.length - 1; i++) {
            const anchor = items[i];
            const tail = items[i + 1];
            if (!tail?.continuation || tail.text !== "" || tail.footnoteMarker || tail.reference || tail.citation || tail.link) continue;
            if (!anchor.footnoteMarker && !anchor.hSpacing && !anchor.reference && !anchor.citation && !anchor.link) continue;

            const anchorEl = lineEl.querySelector(
                `[data-block-id="${anchor.id}"]`,
            ) as HTMLElement | null;
            if (!anchorEl) continue;
            if (anchorEl.contains(target)) continue;

            const tailEl = blockEls.get(tail.id);
            if (!tailEl) continue;
            if (tailEl.contains(target)) continue;

            const { right } = anchorEl.getBoundingClientRect();
            if (event.clientX <= right) continue;

            event.preventDefault();
            documentStore.activeBlockId = tail.id;
            tailEl.focus();
            requestAnimationFrame(() =>
                setCaretOffset(tailEl, enterOffset(tail.text.length, true)),
            );
            return;
        }
    }

    function onInputBlock(id: string, text: string): void {
        documentStore.setBlockText(id, text);
    }

    function onSplit(id: string, caretOffset: number): void {
        const block = allBlocks.find((b) => b.id === id);
        if (!block) return;
        // Footnote zone blocks and header/footer zone blocks are not splittable.
        if (block.footnote || block.footnoteSeparator || block.zoneKind) return;
        const text = block.text;

        // Pressing Enter on an empty list item exits the list; on an empty
        // heading converts it to a plain block. Caret stays in the same block.
        if (text === "" && block.list) {
            documentStore.setList(id, undefined);
            block.placeholder = undefined;
            const el = blockEls.get(id);
            if (el) syncBlockDom(el, "");
            documentStore.pendingFocusAction = { kind: "caret", blockId: id, offset: 0 };
            return;
        }
        if (text === "" && block.heading) {
            documentStore.setHeading(id, undefined);
            block.placeholder = undefined;
            const el = blockEls.get(id);
            if (el) syncBlockDom(el, "");
            documentStore.pendingFocusAction = { kind: "caret", blockId: id, offset: 0 };
            return;
        }

        // Enter at the very start of a heading or list item: insert an empty
        // plain block above and leave the original (with its metadata + text)
        // untouched, caret pinned where it was.
        if (caretOffset === 0 && (block.heading || block.list)) {
            documentStore.insertBlockBefore(id, "");
            documentStore.pendingFocusAction = { kind: "caret", blockId: id, offset: 0 };
            return;
        }

        const before = text.slice(0, caretOffset);
        const after = text.slice(caretOffset);
        // Insert the "after" block first so the document is never transiently
        // all-empty, which would trigger normalizeInlineStructure and collapse it.
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
        documentStore.setBlockText(id, before);
        const el = blockEls.get(id);
        if (el) {
            el.textContent = before;
            if (before === "") el.append(document.createElement("br"));
        }
        documentStore.pendingFocusAction = { kind: "caret", blockId: newId, offset: 0 };
    }

    function onPasteLines(id: string, lines: string[]): void {
        // Zone blocks are single-line; don't create additional body blocks from paste.
        if (allBlocks.find((b) => b.id === id)?.zoneKind) return;
        // The first pasted line was inserted into `id`; turn the rest into blocks.
        let prevId = id;
        for (const line of lines)
            prevId = documentStore.insertBlockAfter(prevId, line);
        const lastLine = lines[lines.length - 1] ?? "";
        documentStore.pendingFocusAction = { kind: "caret", blockId: prevId, offset: lastLine.length };
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
        // Handle zone block backspace: remove zone when primary block is empty.
        const zoneBlock = allBlocks.find((b) => b.id === id && b.zoneKind);
        if (zoneBlock) {
            const zoneKind = zoneBlock.zoneKind!;
            const firstZone = allBlocks.find((b) => b.zoneKind === zoneKind);
            if (firstZone?.id === id && zoneBlock.text === "") {
                documentStore.removeZone(zoneKind);
            }
            return;
        }

        const idx = blocks.findIndex((b) => b.id === id);
        const block = idx >= 0 ? blocks[idx] : undefined;

        // Backspace on an empty heading/list block: strip the metadata so the
        // block becomes a plain empty paragraph. User can press Backspace again
        // to merge with whatever sits above. Mirrors the Enter-on-empty rule.
        if (block && block.text === "" && (block.heading || block.list)) {
            if (block.heading) documentStore.setHeading(id, undefined);
            if (block.list) documentStore.setList(id, undefined);
            block.placeholder = undefined;
            const el = blockEls.get(id);
            if (el) syncBlockDom(el, "");
            documentStore.pendingFocusAction = { kind: "caret", blockId: id, offset: 0 };
            return;
        }

        // Backspace at the start of a block whose predecessor is an embed → delete
        // the embed. This applies regardless of whether the current block has text:
        // merging text into an embed block would corrupt it.
        if (idx > 0) {
            const prev = blocks[idx - 1];
            if (
                prev &&
                    (prev.image ||
                    prev.line ||
                    prev.rect ||
                    prev.outline ||
                    prev.footnote ||
                    prev.footnoteSeparator ||
                    prev.vSpacing ||
                    prev.hSpacing ||
                    prev.pageBreak)
            ) {
                const result = documentStore.deleteEmbed(prev.id);
                if (result) {
                    documentStore.pendingFocusAction = { kind: "caret", blockId: result.id, offset: result.offset };
                }
                return;
            }
        }

        // Backspacing into a footnote marker removes the whole footnote.
        // The marker block is not a contenteditable, so normal merging would
        // leave the caret stuck on a non-editable element.
        if (idx > 0 && blocks[idx - 1]?.footnoteMarker) {
            const markerBlock = blocks[idx - 1];
            const bodyBlock = blocks.find(
                (bb) => bb.footnote?.footnoteId === markerBlock.footnoteMarker!.footnoteId,
            );
            if (bodyBlock) {
                const result = documentStore.deleteEmbed(bodyBlock.id);
                if (result) {
                    documentStore.pendingFocusAction = { kind: "caret", blockId: result.id, offset: result.offset };
                }
            }
            return;
        }

        // Backspacing into a reference or citation chip removes it.
        if (idx > 0 && (blocks[idx - 1]?.reference || blocks[idx - 1]?.citation || blocks[idx - 1]?.link)) {
            const result = documentStore.deleteEmbed(blocks[idx - 1].id);
            if (result) {
                documentStore.pendingFocusAction = { kind: "caret", blockId: result.id, offset: result.offset };
            }
            return;
        }

        const result = documentStore.mergeWithPrevious(id);
        if (!result) return;
        // Update active block right away so the toolbar reflects the new target.
        documentStore.activeBlockId = result.id;
        // Eagerly sync DOM: Block.svelte's $effect skips updates when activeBlockId
        // already matches, so after a merge the merged text won't re-render without this.
        const targetEl = blockEls.get(result.id);
        const mergedBlock = documentStore.findBlock(result.id);
        if (targetEl && mergedBlock) syncBlockDom(targetEl, mergedBlock.text);
        documentStore.pendingFocusAction = { kind: "caret", blockId: result.id, offset: result.offset };
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
            // Formatting shortcuts: ⌘B / ⌘I / ⌘U (or Ctrl on non-Mac)
            if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
                const key = event.key.toLowerCase();
                if (key === "b" || key === "i" || key === "u") {
                    const active = document.activeElement;
                    if (
                        active instanceof HTMLElement &&
                        active.matches(".doc-block[contenteditable]") &&
                        root.contains(active)
                    ) {
                        event.preventDefault();
                        event.stopPropagation();
                        const caretOffset = getCaretOffset(active);
                        const oldBlockId = documentStore.activeBlock.id;
                        if (key === "b") documentStore.toggleBold(caretOffset);
                        else if (key === "i") documentStore.toggleItalic(caretOffset);
                        else documentStore.toggleUnderline(caretOffset);
                        // When the block text was truncated (caret-in-middle split),
                        // Block.svelte skips the DOM update while the element is focused.
                        // Only sync the DOM element that actually belongs to oldBlockId.
                        // If activeBlockId changed (a split happened), active may belong to
                        // a different block, and syncing it against oldBlock.text would corrupt DOM.
                        const oldBlock = documentStore.findBlock(oldBlockId);
                        if (
                            oldBlock &&
                            active.dataset.blockId === oldBlockId &&
                            active.textContent !== oldBlock.text
                        ) {
                            syncBlockDom(active, oldBlock.text);
                        }
                        return;
                    }
                }
            }

            if (
                event.key !== "ArrowLeft" &&
                event.key !== "ArrowRight" &&
                event.key !== "Backspace"
            )
                return;

            // Click-selected embed: delete on Backspace even when focus is not
            // in a contenteditable (e.g. focus on the embed wrapper or a prior block).
            if (
                event.key === "Backspace" &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
            ) {
                const focused = document.activeElement;
                const inInputField =
                    focused instanceof HTMLInputElement ||
                    focused instanceof HTMLTextAreaElement ||
                    focused instanceof HTMLSelectElement ||
                    (focused instanceof HTMLElement &&
                        focused.isContentEditable &&
                        !focused.matches(".doc-block[contenteditable]"));
                if (inInputField) return;

                const awaiting = documentStore.embedAwaitingDelete;
                const activeBlock = documentStore.activeBlock;
                const activeIdx = activeBlock
                    ? blocks.findIndex((b) => b.id === activeBlock.id)
                    : -1;
                const prevForActive =
                    activeIdx > 0 ? blocks[activeIdx - 1] : undefined;
                const deleteAwaitingEmbed =
                    awaiting &&
                    (awaiting === activeBlock?.id ||
                        (activeBlock?.text === "" &&
                            prevForActive?.id === awaiting &&
                            (prevForActive.hSpacing ||
                                prevForActive.footnoteMarker ||
                                prevForActive.image ||
                                prevForActive.line ||
                                prevForActive.rect ||
                                prevForActive.outline ||
                                prevForActive.footnote ||
                                prevForActive.footnoteSeparator ||
                                prevForActive.vSpacing ||
                                prevForActive.pageBreak)));
                if (deleteAwaitingEmbed) {
                    event.preventDefault();
                    event.stopPropagation();
                    const result = documentStore.deleteEmbed(awaiting);
                    if (result) {
                        documentStore.pendingFocusAction = { kind: "caret", blockId: result.id, offset: result.offset };
                    }
                    return;
                }
            }

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

                // Ctrl/Cmd+Backspace: delete the word to the left of the caret.
                // Take it over so we can merge with the previous block in the
                // same stroke when the block becomes empty (matches the holding-
                // backspace behaviour: empty + one more press removes the block).
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    let start = offset;
                    while (start > 0 && /\s/.test(text[start - 1])) start--;
                    while (start > 0 && !/\s/.test(text[start - 1])) start--;
                    const newText = text.slice(0, start) + text.slice(offset);
                    documentStore.setBlockText(id, newText);
                    syncBlockDom(active, newText);
                    if (newText === "") {
                        if (
                            isEmptyTailAfterInlineEmbed(idx) ||
                            isEmptyBlockAfterVSpacing(idx)
                        ) {
                            syncBlockDom(active, "");
                            documentStore.pendingFocusAction = { kind: "caret", blockId: id, offset: 0 };
                        } else if (idx === 0 && blocks.length === 1) {
                            // First and only block — nothing to merge into.
                            // Refocus so the DOM settles and the placeholder shows.
                            documentStore.pendingFocusAction = { kind: "caret", blockId: id, offset: 0 };
                        } else {
                            onMergePrev(id);
                        }
                    } else {
                        setCaretOffset(active, start);
                    }
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
                        // pending focus handles focus on the new element after Svelte's update.
                        documentStore.pendingFocusAction = { kind: "caret", blockId: id, offset: 0 };
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
                    const newText =
                        text.slice(0, offset - 1) + text.slice(offset);
                    documentStore.setBlockText(id, newText);
                    syncBlockDom(active, newText);
                    setCaretOffset(active, enterOffset(newText.length, false));
                    return;
                }

                // Take over all backspace events inside continuation blocks to prevent
                // browsers from jumping the cursor out of inline contenteditable spans.
                if (isCont) {
                    event.preventDefault();
                    event.stopPropagation();
                    const newText =
                        text.slice(0, offset - 1) + text.slice(offset);
                    if (newText === "") {
                        documentStore.setBlockText(id, "");
                        syncBlockDom(active, "");
                        if (
                            isEmptyTailAfterInlineEmbed(idx) ||
                            isEmptyBlockAfterVSpacing(idx)
                        ) {
                            documentStore.pendingFocusAction = {
                                kind: "caret",
                                blockId: id,
                                offset: 0,
                            };
                        } else {
                            onMergePrev(id);
                        }
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
                // Skip non-editable inline segments (footnote markers, reference chips, citation chips).
                let nextIdx = idx + 1;
                while (nextIdx < blocks.length && (blocks[nextIdx].footnoteMarker || blocks[nextIdx].reference || blocks[nextIdx].citation || blocks[nextIdx].link)) nextIdx++;
                if (nextIdx >= blocks.length || !blocks[nextIdx].continuation) return;
                const next = blocks[nextIdx];
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
                // Skip non-editable inline segments (footnote markers, reference chips, citation chips).
                let prevIdx = idx - 1;
                while (prevIdx >= 0 && (blocks[prevIdx].footnoteMarker || blocks[prevIdx].reference || blocks[prevIdx].citation || blocks[prevIdx].link)) prevIdx--;
                if (prevIdx < 0) return;
                const prev = blocks[prevIdx];
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

    // Single unified focus-after-mutation handler. All store operations that
    // need to move focus set pendingFocusAction; this effect applies it after
    // Svelte has committed the resulting DOM changes.
    $effect(() => {
        const action = documentStore.pendingFocusAction;
        if (!action) return;
        documentStore.pendingFocusAction = null;
        tick().then(() => {
            const el = blockEls.get(action.blockId);
            if (!el) return;
            el.focus();
            if (action.kind === "caret") {
                setCaretOffset(el, action.offset);
            } else if (action.kind === "selection") {
                setCaretRange(el, action.start, action.end);
            } else {
                setCaretOffset(el, el.textContent?.length ?? 0);
            }
        });
    });

    function onHeight(id: string, px: number): void {
        const b = allBlocks.find((b) => b.id === id);
        if (!b) return;
        // Zone blocks (header/footer) don't affect body layout.
        if (b.zoneKind) { if (heights[id] !== 0) heights[id] = 0; return; }
        if (b.footnote || b.footnoteSeparator) {
            if (zoneHeights[id] !== px) zoneHeights[id] = px;
            if (heights[id] !== 0) heights[id] = 0;
            return;
        }
        const h = b.continuation ? 0 : px;
        if (heights[id] !== h) heights[id] = h;
    }

    function isFootnoteZoneBlock(b: (typeof blocks)[number] | undefined): boolean {
        return !!(b && (b.footnote || b.footnoteSeparator));
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
        style:transform="translateX({centerOffsetPx}px) scale({scale})"
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
            {@const footnoteZoneBlocks = pageBlocks
                .filter(isFootnoteZoneBlock)
                .sort((a, b) => {
                    if (a.footnoteSeparator === b.footnoteSeparator) return 0;
                    return a.footnoteSeparator ? -1 : 1;
                })}
            {@const mainPageBlocks = pageBlocks.filter(
                (b) => !isFootnoteZoneBlock(b),
            )}
            {@const renderItems = buildRenderItems(mainPageBlocks)}
            {@const contentHeightPx = pageHeightPx - mp.top - mp.bottom}
            {@const zoneWidth = pageWidthPx - mp.left - mp.right}
            {@const headerInsetPx = marginInsetPx(
                model.headerAscent,
                mp.top,
                RENDER_SCALE,
            )}
            {@const footerInsetPx = marginInsetPx(
                model.footerDescent,
                mp.bottom,
                RENDER_SCALE,
            )}

            <!-- Header zone (bottom-aligned in top margin, offset by header-ascent) -->
            {#if headerBlocks.length > 0}
                <div
                    class="absolute flex flex-col justify-end"
                    data-page-zone="header"
                    style:top="{pageTop}px"
                    style:left="{mp.left}px"
                    style:width="{zoneWidth}px"
                    style:height="{mp.top}px"
                    use:headerZoneAnchor={pageIdx === 0}
                >
                    <div
                        class={["w-full flex items-baseline", headerBlocks.some(b => b.hSpacing?.amount.unit === "fr") ? "flex" : ""]}
                        style:margin-bottom="{headerInsetPx}px"
                        style:text-align="left"
                    >
                        {#each headerBlocks as block (block.id)}
                            <Block
                                {block}
                                scale={RENDER_SCALE}
                                role={blockRoles.get(block.id)}
                                renderInline={true}
                                spacingEm={undefined}
                                marker={undefined}
                                headingPrefix={undefined}
                                suppressAbove={true}
                                skipsFirstLineIndent={true}
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
            {/if}

            <!-- Footer zone (top-aligned in bottom margin, offset by footer-descent) -->
            {#if footerBlocks.length > 0}
                <div
                    class="absolute flex flex-col justify-start"
                    data-page-zone="footer"
                    style:top="{pageTop + pageHeightPx - mp.bottom}px"
                    style:left="{mp.left}px"
                    style:width="{zoneWidth}px"
                    style:height="{mp.bottom}px"
                    use:footerZoneAnchor={pageIdx === 0}
                >
                    <div
                        class="w-full flex items-baseline"
                        style:margin-top="{footerInsetPx}px"
                    >
                        {#each footerBlocks as block (block.id)}
                            <Block
                                {block}
                                scale={RENDER_SCALE}
                                role={blockRoles.get(block.id)}
                                renderInline={true}
                                spacingEm={undefined}
                                marker={undefined}
                                headingPrefix={undefined}
                                suppressAbove={true}
                                skipsFirstLineIndent={true}
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
            {/if}

            <!-- Content area for this page (margins are per-page) -->
            <div
                class="absolute flex flex-col"
                style:top="{pageTop + mp.top}px"
                style:left="{mp.left}px"
                style:width="{pageWidthPx - mp.left - mp.right}px"
                style:min-height="{contentHeightPx}px"
            >
                <div class="flex min-h-0 flex-1 flex-col">
                {#each renderItems as item (renderItemKey(item))}
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
                            <div
                                class="inline-flex max-w-full flex-col items-stretch"
                            >
                                {#each item.items as block (block.id)}
                                    <Block
                                        {block}
                                        scale={RENDER_SCALE}
                                        role={blockRoles.get(block.id)}
                                        spacingEm={parbreakSpacings.get(
                                            block.id,
                                        )}
                                        renderInline={renderInlineIds.has(
                                            block.id,
                                        )}
                                        marker={listMarkers.get(block.id)}
                                        headingPrefix={headingNumbers.get(
                                            block.id,
                                        )}
                                        listTight={listItemLayout.get(block.id)
                                            ?.tight}
                                        listHasNext={listItemLayout.get(
                                            block.id,
                                        )?.hasNext}
                                        listGroupFirst={listItemLayout.get(
                                            block.id,
                                        )?.isFirst}
                                        suppressAbove={pageTopIds.has(block.id)}
                                        skipsFirstLineIndent={skipsFirstLineIndent.get(
                                            block.id,
                                        ) ?? true}
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
                    {:else if item.kind === "inlineLine"}
                        {@const lineAlign = item.items[0].alignment ?? "left"}
                        {@const hasFrHSpace = item.items.some(b => b.hSpacing?.amount.unit === "fr")}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            class={["inline-line w-full", hasFrHSpace ? "flex items-baseline" : ""]}
                            style:text-align={hasFrHSpace ? undefined : lineAlign}
                            style:justify-content={hasFrHSpace ? (lineAlign === "right" ? "flex-end" : lineAlign === "center" ? "center" : "flex-start") : undefined}
                            onmousedown={(e) =>
                                onInlineLineMouseDown(e, item.items)}
                        >
                            {#each item.items as block (block.id)}
                                <Block
                                    {block}
                                    scale={RENDER_SCALE}
                                    role={blockRoles.get(block.id)}
                                    spacingEm={parbreakSpacings.get(
                                        block.id,
                                    )}
                                    renderInline={true}
                                    marker={listMarkers.get(block.id)}
                                    headingPrefix={headingNumbers.get(
                                        block.id,
                                    )}
                                    listTight={listItemLayout.get(block.id)
                                        ?.tight}
                                    listHasNext={listItemLayout.get(
                                        block.id,
                                    )?.hasNext}
                                    listGroupFirst={listItemLayout.get(
                                        block.id,
                                    )?.isFirst}
                                    suppressAbove={pageTopIds.has(block.id)}
                                    skipsFirstLineIndent={skipsFirstLineIndent.get(
                                        block.id,
                                    ) ?? true}
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
                            listGroupFirst={listItemLayout.get(block.id)
                                ?.isFirst}
                            suppressAbove={pageTopIds.has(block.id)}
                            skipsFirstLineIndent={skipsFirstLineIndent.get(
                                block.id,
                            ) ?? true}
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
                {#if footnoteZoneBlocks.length > 0}
                    {@const fnSettings =
                        documentStore.resolveFootnoteSettings(pageIdx)}
                    {@const fnEmPx = ptToPx(model.typography.size) * RENDER_SCALE}
                    <div
                        class="footnote-zone mt-auto w-full shrink-0"
                        style:padding-top="{fnSettings.clearance * fnEmPx}px"
                    >
                        {#each footnoteZoneBlocks as block, fnIdx (block.id)}
                            {#if block.footnoteSeparator}
                                <Block
                                    {block}
                                    scale={RENDER_SCALE}
                                    role={blockRoles.get(block.id)}
                                    spacingEm={parbreakSpacings.get(
                                        block.id,
                                    )}
                                    renderInline={false}
                                    marker={listMarkers.get(block.id)}
                                    headingPrefix={headingNumbers.get(
                                        block.id,
                                    )}
                                    listTight={listItemLayout.get(block.id)
                                        ?.tight}
                                    listHasNext={listItemLayout.get(
                                        block.id,
                                    )?.hasNext}
                                    listGroupFirst={listItemLayout.get(
                                        block.id,
                                    )?.isFirst}
                                    suppressAbove={pageTopIds.has(block.id)}
                                    skipsFirstLineIndent={skipsFirstLineIndent.get(
                                        block.id,
                                    ) ?? true}
                                    registerel={registerEl}
                                    onheight={onHeight}
                                    onfocusblock={onFocusBlock}
                                    oninputblock={onInputBlock}
                                    onsplit={onSplit}
                                    onmergeprev={onMergePrev}
                                    onpastelines={onPasteLines}
                                />
                            {:else}
                                {@const prevZone =
                                    fnIdx > 0
                                        ? footnoteZoneBlocks[fnIdx - 1]
                                        : undefined}
                                <div
                                    style:padding-left="{fnSettings.indent * fnEmPx}px"
                                    style:margin-top={fnIdx > 0 ||
                                    prevZone?.footnoteSeparator
                                        ? `${fnSettings.gap * fnEmPx}px`
                                        : undefined}
                                >
                                    <Block
                                        {block}
                                        scale={RENDER_SCALE}
                                        role={blockRoles.get(block.id)}
                                        spacingEm={parbreakSpacings.get(
                                            block.id,
                                        )}
                                        renderInline={renderInlineIds.has(
                                            block.id,
                                        )}
                                        marker={listMarkers.get(block.id)}
                                        headingPrefix={headingNumbers.get(
                                            block.id,
                                        )}
                                        listTight={listItemLayout.get(
                                            block.id,
                                        )?.tight}
                                        listHasNext={listItemLayout.get(
                                            block.id,
                                        )?.hasNext}
                                        listGroupFirst={listItemLayout.get(
                                            block.id,
                                        )?.isFirst}
                                        suppressAbove={pageTopIds.has(
                                            block.id,
                                        )}
                                        skipsFirstLineIndent={skipsFirstLineIndent.get(
                                            block.id,
                                        ) ?? true}
                                        registerel={registerEl}
                                        onheight={onHeight}
                                        onfocusblock={onFocusBlock}
                                        oninputblock={onInputBlock}
                                        onsplit={onSplit}
                                        onmergeprev={onMergePrev}
                                        onpastelines={onPasteLines}
                                    />
                                </div>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>

<!-- Fixed to viewport so scroll does not carry it over the toolbar (z-50) -->
{#if documentStore.zoneSettingsKind !== null && zonePopupStyle}
    <div
        bind:this={zonePopupEl}
        class="pointer-events-none fixed z-40"
        data-zone-settings-popup
        style:left={zonePopupStyle.left}
        style:top={zonePopupStyle.top}
        style:transform={zonePopupStyle.transform}
    >
        <div class="pointer-events-auto">
            <PageZonePopup kind={documentStore.zoneSettingsKind} />
        </div>
    </div>
{/if}
