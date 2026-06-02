<script lang="ts">
    import { untrack, onDestroy } from "svelte";
    import {
        resolveBlockHeadingSpacing,
        resolveBlockListSpacing,
    } from "$lib/document/blockLevelStyle";
    import { documentStore } from "$lib/document/store.svelte";
    import { formatNumbering } from "$lib/document/numbering";
    import {
        bodyLineHeightEm,
        parbreakGapEm,
        parSpacingMatchesLeading,
    } from "$lib/document/lineMetrics";
    import { ptToPx } from "$lib/document/units";
    import type { Block, StrokeDash } from "$lib/document/types";
    import { imageCache } from "$lib/system/imageCache.svelte";
    import { isUrl, normalizeUrl } from "$lib/document/url";
    import { getDocLocale, resolveBlockPlaceholder } from "$lib/document/docLocale";
    import {
        isSpellcheckableBlock,
        spellcheckStore,
        setBlockHighlights,
        clearBlockHighlights,
    } from "$lib/document/spellcheck.svelte";
    import { getCaretOffset, setCaretOffset } from "./caret";

    const WEIGHT_CSS: Record<string, number> = {
        Regular: 400,
        Medium: 500,
        Bold: 700,
    };

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
        /** Omit first-line indent (first paragraph in doc / after block-level). */
        skipsFirstLineIndent?: boolean;
        registerel: (id: string, el: HTMLElement | null) => void;
        onheight: (id: string, px: number) => void;
        onfocusblock: (id: string) => void;
        oninputblock: (id: string, text: string) => void;
        onsplit: (id: string, caretOffset: number, sourceText: string) => string | undefined;
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
        skipsFirstLineIndent = true,
        registerel,
        onheight,
        onfocusblock,
        oninputblock,
        onsplit,
        onmergeprev,
        onpastelines,
    }: Props = $props();

    // resolveTypography now applies heading/title/outline-title scale, so no
    // separate multiplier is needed here. HEADING_TOP_MARGIN_EM_FALLBACK is kept
    // only for the heading spacing fallback (not font size).
    const HEADING_TOP_MARGIN_EM_FALLBACK: Record<number, number> = {
        0: 1.4,
        1: 1.2,
        2: 1.0,
        3: 0.8,
        4: 0.6,
    };

    const typography = $derived(documentStore.resolveTypography(block));
    const paragraph = $derived(documentStore.resolveParagraph(block));

    const fontSizePx = $derived(ptToPx(typography.size) * scale);
    /** Typst footnote listing body size (`footnote.entry`). */
    const footnoteFontSizePx = $derived(fontSizePx * 0.85);
    const lineHeight = $derived(
        block.heading ? 1.2 : bodyLineHeightEm(typography.leading),
    );
    const letterSpacingPx = $derived((typography.tracking / 100) * fontSizePx);
    const fontWeight = $derived(
        block.heading ? 700 : (WEIGHT_CSS[typography.weight] ?? 400),
    );
    const firstLineIndentPx = $derived(
        block.heading || block.list || block.outline || skipsFirstLineIndent
            ? 0
            : ptToPx(paragraph.firstLineIndent ?? 0) * scale,
    );

    const parbreakGap = $derived(
        role === "parbreak"
            ? parbreakGapEm(paragraph, typography, spacingEm)
            : 0,
    );
    const collapsedParbreak = $derived(
        role === "parbreak" && parSpacingMatchesLeading(paragraph, typography),
    );

    const effectiveLineHeight = $derived(
        role === "parbreak" ? parbreakGap : lineHeight,
    );

    const textAlign = $derived(
        block.alignment ?? (paragraph.justify ? "justify" : "left"),
    );

    const headingTopMarginEm = $derived.by(() => {
        if (!block.heading) return 0;
        const level = block.heading.level;
        const spacing = resolveBlockHeadingSpacing(documentStore.model, block);
        return spacing?.above ?? HEADING_TOP_MARGIN_EM_FALLBACK[level] ?? 0;
    });

    const headingBottomMarginEm = $derived.by(() => {
        if (!block.heading) return 0;
        return (
            resolveBlockHeadingSpacing(documentStore.model, block)?.below ?? 0
        );
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

    const isReference = $derived(!!block.reference);
    const isCitation = $derived(!!block.citation);
    const isLink = $derived(!!block.link);
    const isBibliography = $derived(!!block.bibliography);
    const isPageCounter = $derived(!!block.pageCounter);
    const isInline = $derived(
        block.continuation || renderInline || !!block.footnoteMarker || isReference || isCitation || isLink || isPageCounter,
    );
    const isList = $derived(!!block.list);
    const isEmbed = $derived(!!(block.image || block.line || block.rect));
    const isOutline = $derived(!!block.outline);
    const isVSpacing = $derived(!!block.vSpacing);
    const isHSpacing = $derived(!!block.hSpacing);
    const isPageBreak = $derived(!!block.pageBreak);
    const isFootnoteMarker = $derived(!!block.footnoteMarker);
    const isFootnoteBody = $derived(!!block.footnote);

    /** Whether the bibliography style is numeric (e.g. IEEE) vs author-date (e.g. APA). */
    function styleIsNumeric(styleId: string): boolean {
        return (
            styleId === "ieee" ||
            styleId === "alphanumeric" ||
            styleId.includes("numeric") ||
            styleId.includes("vancouver") ||
            styleId === "american-physics-society" ||
            styleId === "american-institute-of-physics" ||
            styleId === "american-institute-of-aeronautics-and-astronautics"
        );
    }

    /** Inline label for a citation chip — mirrors how Typst renders it. */
    const citationInlineLabel = $derived.by(() => {
        if (!block.citation) return "";
        const bib = documentStore.bibliographySettings;
        const styleId = bib.citationStyleId;
        const sourceId = block.citation.sourceId;
        if (styleIsNumeric(styleId)) {
            // Number = 1-based order of first appearance
            let n = 0;
            const seen = new Set<string>();
            for (const b of documentStore.model.blocks) {
                if (!b.citation) continue;
                if (!seen.has(b.citation.sourceId)) {
                    seen.add(b.citation.sourceId);
                    n++;
                }
                if (b.citation.sourceId === sourceId) break;
            }
            const sup = block.citation.supplement ? `, ${block.citation.supplement}` : "";
            return `[${n}${sup}]`;
        }
        // Author-date styles
        const source = bib.sources.find(s => s.id === sourceId);
        const author = source?.authors?.split(/[,;]/)[0]?.trim() ?? sourceId;
        const year = source?.date?.slice(0, 4) ?? "";
        const sup = block.citation.supplement ? `, ${block.citation.supplement}` : "";
        return year ? `(${author}, ${year}${sup})` : `(${author}${sup})`;
    });

    /** Inline label for a cross-reference chip — mirrors how Typst renders it. */
    const referenceInlineLabel = $derived.by(() => {
        if (!block.reference) return "";
        if (block.reference.displayText) return block.reference.displayText;
        const locale = getDocLocale(documentStore.model.lang);
        if (block.reference.pageForm) {
            const pageIndex = documentStore.blockPageIndex(block.reference.targetBlockId);
            return `${locale.page} ${pageIndex + 1}`;
        }
        const target = documentStore.findBlock(block.reference.targetBlockId);
        if (!target) return "?";
        if (target.heading) return target.text || locale.heading;
        if (target.image) {
            // Count which figure this is
            let n = 0;
            for (const b of documentStore.model.blocks) {
                if (b.image) n++;
                if (b.id === target.id) break;
            }
            return `${locale.figure} ${n}`;
        }
        return "Reference";
    });

    /** Inline label for a link chip — custom text or the URL. */
    const linkInlineLabel = $derived.by(() => {
        if (!block.link) return "";
        if (block.link.displayText?.trim()) return block.link.displayText.trim();
        return block.link.url;
    });

    const footnoteMarkerNumber = $derived(
        isFootnoteMarker ? documentStore.footnoteNumber(block.id) : 0,
    );
    const footnoteBodyNumber = $derived(
        isFootnoteBody ? documentStore.footnoteNumberForBody(block.id) : 0,
    );
    const pageCounterPreviewText = $derived.by(() => {
        if (!block.pageCounter) return "";
        const p = block.pageCounter.pattern;
        if (p === "1/1") return "1/5";
        if (p === "I") return "I";
        if (p === "i") return "i";
        if (p === "A") return "A";
        if (p === "a") return "a";
        return "1";
    });

    /** Empty tail segment after an inline embed — needs a hit target and caret. */
    const trailAfterInlineEmbed = $derived.by(() => {
        if (!isInline || block.footnoteMarker || block.reference || block.citation || block.link || block.pageCounter || block.text !== "")
            return false;
        const i = documentStore.blockIndex(block.id);
        if (i <= 0) return false;
        const prev = documentStore.model.blocks[i - 1];
        return !!(prev?.footnoteMarker || prev?.hSpacing || prev?.reference || prev?.citation || prev?.link || prev?.pageCounter);
    });

    // Outline body entries: walk all blocks, count outlined headings, and pick
    // the page each heading falls on so the rendered TOC matches Typst's PDF.
    const outlineEntries = $derived.by(() => {
        if (!block.outline)
            return [] as {
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

    const docLocale = $derived(getDocLocale(documentStore.model.lang));
    const effectivePlaceholder = $derived(
        resolveBlockPlaceholder(docLocale, block, placeholder),
    );

    let el = $state<HTMLElement | null>(null);
    let outerEl = $state<HTMLElement | null>(null);
    let embedEl = $state<HTMLElement | null>(null);

    // ── Spell / grammar check ────────────────────────────────────────────────

    const isSpellcheckable = $derived(isSpellcheckableBlock(block) && !isEmbed && !isVSpacing && !isHSpacing && !isPageBreak);


    // Re-check on mount, language change, or when this block becomes non-checkable.
    // Everything else is untracked so store updates from typing do not re-run this
    // effect — onInput calls check() per keystroke. Avoid calling check("") here:
    // a stale empty block.text during re-runs would cancel the onInput timer via
    // check()'s early return without scheduling a replacement.
    $effect(() => {
        const lang = documentStore.model.lang;
        const spellable = isSpellcheckable;
        untrack(() => {
            const id = block.id;
            if (!spellable) {
                spellcheckStore.clear(id);
                return;
            }
            const text = block.text;
            if (text.trim()) spellcheckStore.check(id, text, lang);
        });
    });
    onDestroy(() => spellcheckStore.clear(block.id));

    // Tracks childList mutations on el so we rebuild ranges when the text node
    // is replaced (e.g. by el.textContent = text in a sync effect).
    let elChildVersion = $state(0);
    $effect(() => {
        if (!el) return;
        const mo = new MutationObserver(() => { elChildVersion++; });
        mo.observe(el, { childList: true });
        return () => mo.disconnect();
    });

    // Apply CSS Custom Highlights when matches change or the text node is replaced.
    // Does NOT track block.text — live Range objects reposition themselves as the
    // user types, so rebuilding from (possibly stale) API offsets on every keystroke
    // would shift squiggles to wrong positions.
    const blockMatches = $derived(spellcheckStore.matches[block.id] ?? []);

    $effect(() => {
        void el; // re-run when contenteditable binds (e.g. block created by Enter)
        void elChildVersion; // re-run when text node is replaced (el.textContent = …)

        if (!el || blockMatches.length === 0) {
            clearBlockHighlights(block.id);
            return;
        }
        let textNode: Text | null = null;
        for (const child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) { textNode = child as Text; break; }
        }
        if (!textNode) {
            clearBlockHighlights(block.id);
            return;
        }
        const textLen = textNode.length;
        const spell: Range[] = [];
        const grammar: Range[] = [];
        for (const m of blockMatches) {
            if (m.offset < 0 || m.offset + m.length > textLen) continue;
            const r = document.createRange();
            r.setStart(textNode, m.offset);
            r.setEnd(textNode, m.offset + m.length);
            (m.type === "spell" ? spell : grammar).push(r);
        }
        setBlockHighlights(block.id, spell, grammar);
        return () => clearBlockHighlights(block.id);
    });

    function onSpellCheckClick(e: MouseEvent): void {
        const blockMatches = spellcheckStore.matches[block.id];
        if (!blockMatches?.length || !el) return;

        const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
        if (!range) return;

        let textNode: Text | null = null;
        for (const child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) { textNode = child as Text; break; }
        }
        if (!textNode || range.startContainer !== textNode) return;

        const offset = range.startOffset;
        const match = blockMatches.find(
            (m) => offset >= m.offset && offset < m.offset + m.length,
        );
        if (!match) return;

        const matchRange = document.createRange();
        matchRange.setStart(textNode, match.offset);
        matchRange.setEnd(textNode, Math.min(match.offset + match.length, textNode.length));
        spellcheckStore.activePopup = { blockId: block.id, match, anchorRect: matchRange.getBoundingClientRect() };
    }

    // ── End spell / grammar check ────────────────────────────────────────────

    function reportHeight(): void {
        const target = embedEl ?? outerEl ?? el;
        if (target) onheight(block.id, target.offsetHeight);
    }

    // Embed blocks (and vSpacing): register the wrapper for layout/height, but
    // skip all contenteditable wiring. Click activates the block so the toolbar
    // can tie the matching popup.
    $effect(() => {
        if (!isEmbed && !isVSpacing && !isPageBreak) return;
        const node = embedEl;
        if (!node) return;
        const observer = new ResizeObserver(() => reportHeight());
        observer.observe(node);
        reportHeight();
        return () => observer.disconnect();
    });

    function ensureTrailingBr(): void {
        if (!el) return;
        // Inline spans (continuation blocks) must never get a sentinel <br> —
        // a <br> inside an inline element creates a visible line break.
        if (isInline) return;
        const isEmpty = (el.textContent ?? "") === "";
        const hasTrailingBr = el.lastChild?.nodeName === "BR";
        if (
            isEmpty &&
            !effectivePlaceholder &&
            !hasTrailingBr &&
            !collapsedParbreak
        ) {
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
        const text = untrack(() => block.text);
        if (
            node.textContent !== text &&
            documentStore.activeBlockId !== block.id
        ) {
            node.textContent = text;
        }
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
        if (!el) return;
        if (
            el.textContent !== text &&
            documentStore.activeBlockId !== block.id
        ) {
            el.textContent = text;
        }
        // Reconcile trailing <br> on every text change, even when the element
        // is focused. Browsers can leave behind sentinel <br>s after a word
        // delete that defeat the `:empty::before` placeholder rule.
        ensureTrailingBr();
    });

    // Toggling the placeholder on an empty block must re-evaluate the sentinel <br>:
    // BR fills the line box when there's no placeholder, but stops :empty from matching.
    $effect(() => {
        void effectivePlaceholder;
        ensureTrailingBr();
    });

    $effect(() => {
        void collapsedParbreak;
        ensureTrailingBr();
    });

    function onInput(): void {
        if (!el) return;
        oninputblock(block.id, el.textContent ?? "");
    }

    function onKeydown(event: KeyboardEvent): void {
        if (!el) return;
        if (event.key === "Enter") {
            event.preventDefault();
            const text = el.textContent ?? "";
            // Capture caret before store/DOM effects run — a detached selection
            // would otherwise read as 0 and move all text to the new line.
            const offset = getCaretOffset(el);
            oninputblock(block.id, text);
            onsplit(block.id, offset, text);
        } else if (event.key === "Backspace") {
            if (
                window.getSelection()?.isCollapsed &&
                getCaretOffset(el) === 0 &&
                (!block.continuation || block.text === "")
            ) {
                event.preventDefault();
                onmergeprev(block.id);
            }
        }
    }

    // A parbreak blank renders the paragraph-spacing gap. Clicking inside that
    // gap shouldn't drop the caret into the empty block — the visual whitespace
    // belongs to the paragraph above. Steal the click and redirect focus to the
    // nearest preceding content block.
    function onParbreakMouseDown(event: MouseEvent): void {
        if (role !== "parbreak") return;
        const idx = documentStore.blockIndex(block.id);
        for (let j = idx - 1; j >= 0; j--) {
            const prev = documentStore.model.blocks[j];
            if (prev.continuation || prev.footnote || prev.footnoteSeparator)
                continue;
            const isBlankText =
                prev.text === "" &&
                !prev.heading &&
                !prev.list &&
                !prev.image &&
                !prev.line &&
                !prev.rect &&
                !prev.outline;
            if (isBlankText) continue;
            // Found a content block above: the parbreak gap belongs to it, so
            // steal the click and redirect the caret there.
            event.preventDefault();
            if (prev.image || prev.line || prev.rect || prev.outline) {
                documentStore.activateEmbed(prev.id);
            } else {
                documentStore.pendingFocusAction = {
                    kind: "focus",
                    blockId: prev.id,
                };
            }
            return;
        }
        // No content block above this gap (e.g. blank lines at the very top of
        // the document). The native click on this spacer-height block doesn't
        // reliably show the caret, so place it explicitly via the standard
        // focus path (same mechanism used after splits/merges).
        event.preventDefault();
        documentStore.activeBlockId = block.id;
        documentStore.pendingFocusAction = {
            kind: "caret",
            blockId: block.id,
            offset: 0,
        };
    }

    function canAutoLinkPaste(): boolean {
        return (
            !block.zoneKind &&
            !block.heading &&
            !block.list &&
            !block.image &&
            !block.line &&
            !block.rect &&
            !block.outline &&
            !block.reference &&
            !block.citation &&
            !block.link &&
            !block.footnoteMarker &&
            !!el
        );
    }

    function onPaste(event: ClipboardEvent): void {
        const raw = event.clipboardData?.getData("text/plain") ?? "";
        const lines = raw.replace(/\r\n/g, "\n").split("\n");
        if (lines.length <= 1 && canAutoLinkPaste()) {
            const trimmed = (lines[0] ?? "").trim();
            if (isUrl(trimmed)) {
                event.preventDefault();
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    sel.getRangeAt(0).deleteContents();
                }
                onInput();
                const offset = getCaretOffset(el!);
                documentStore.insertLinkAtPosition(
                    block.id,
                    offset,
                    normalizeUrl(trimmed),
                );
                return;
            }
        }

        event.preventDefault();
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
        class={[
            "doc-block outline-none",
            !isInline && "w-full",
            trailAfterInlineEmbed && "trail-after-inline-embed",
        ]}
        contenteditable="true"
        spellcheck="false"
        role="textbox"
        tabindex="0"
        aria-multiline="false"
        data-block-id={block.id}
        data-placeholder={effectivePlaceholder}
        style:display={isInline && !trailAfterInlineEmbed ? "inline" : undefined}
        style:font-family={`"${typography.fontFamily}", serif`}
        style:font-size="{isFootnoteBody ? footnoteFontSizePx : fontSizePx}px"
        style:font-weight={fontWeight}
        style:font-style={typography.italic ? "italic" : undefined}
        style:text-decoration={typography.underline ? "underline" : undefined}
        style:line-height={effectiveLineHeight}
        style:height={collapsedParbreak ? "0" : undefined}
        style:min-height={collapsedParbreak ? "0" : undefined}
        style:overflow={collapsedParbreak ? "hidden" : undefined}
        style:padding={collapsedParbreak ? "0" : undefined}
        style:margin={collapsedParbreak ? "0" : undefined}
        style:letter-spacing="{letterSpacingPx}px"
        style:color={typography.color}
        style:text-align={textAlign}
        style:text-indent="{firstLineIndentPx}px"
        style:cursor={role === "parbreak" ? "default" : undefined}
        onmousedown={onParbreakMouseDown}
        onfocus={() => {
            onfocusblock(block.id);
            if (trailAfterInlineEmbed && el) {
                requestAnimationFrame(() => setCaretOffset(el!, 0));
            }
        }}
        oninput={onInput}
        onkeydown={onKeydown}
        onpaste={onPaste}
        onclick={onSpellCheckClick}
    ></svelte:element>
{/snippet}


{#snippet embedView()}
    {@const img = block.image}
    {@const line = block.line}
    {@const rect = block.rect}
    {@const cached = img ? imageCache.get(block.id) : undefined}
    {@const spacing = block.footnoteSeparator
        ? { above: 0, below: 0 }
        : documentStore.resolveEmbedSpacing(block)}
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
        tabindex="-1"
        style:margin-top={suppressAbove ? "0" : `${spacing?.above ?? 1.2}em`}
        style:margin-bottom="{spacing?.below ?? 0.35}em"
        onclick={(e) => {
            e.preventDefault();
            // Goes through the store so any earlier popup-dismissal is cleared,
            // even when the active block id doesn't change.
            documentStore.activateEmbed(block.id);
            onfocusblock(block.id);
            embedEl?.focus({ preventScroll: true });
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
            {@const wPx =
                img.width != null ? ptToPx(img.width) * scale : undefined}
            {@const hPx =
                img.height != null ? ptToPx(img.height) * scale : undefined}
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
                        style:image-rendering={img.scaling === "pixelated"
                            ? "pixelated"
                            : "auto"}
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
            {@const lineWidth =
                line.lengthUnit === "%"
                    ? `${line.length}%`
                    : line.lengthUnit === "em"
                      ? `${line.length * fontSizePx}px`
                      : `${line.length * scale}px`}
            <div
                class="relative my-2"
                style:width={lineWidth}
                style:margin-left="{ptToPx(line.startX) * scale}px"
                style:margin-top="calc(0.5rem + {ptToPx(line.startY) * scale}px)"
                style:transform={line.angle
                    ? `rotate(${line.angle}deg)`
                    : undefined}
                style:transform-origin="left center"
            >
                <div
                    style:border-top-style={dashCss(line.stroke.dash)}
                    style:border-top-width="{line.stroke.thickness * scale}px"
                    style:border-top-color={line.stroke.color}
                ></div>
            </div>
        {:else if rect}
            {@const wPx =
                rect.width != null ? ptToPx(rect.width) * scale : undefined}
            {@const hPx =
                (rect.height != null ? ptToPx(rect.height) : 60) * scale}
            <div
                class="relative"
                style:width={wPx ? `${wPx}px` : "100%"}
                style:height="{hPx}px"
                style:background-color={rect.fillEnabled
                    ? rect.fillColor
                    : "transparent"}
                style:border-style={dashCss(rect.stroke.dash)}
                style:border-width="{rect.stroke.thickness * scale}px"
                style:border-color={rect.stroke.color}
                style:border-radius="{rect.radius * scale}px"
                style:padding="{rect.inset * scale}px"
            ></div>
        {/if}
    </div>
{/snippet}

{#snippet outlineView()}
    {@const outline = block.outline!}
    {@const spacing = documentStore.resolveEmbedSpacing(block)}
    {@const docTypo = documentStore.model.typography}
    {@const baseFontPx = ptToPx(docTypo.size) * scale}
    {@const indentEm =
        outline.indent != null ? outline.indent / docTypo.size : 1.5}
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
            data-placeholder={effectivePlaceholder ?? docLocale.title}
            style:font-family={`"${typography.fontFamily}", serif`}
            style:font-size="{fontSizePx}px"
            style:font-weight={700}
            style:line-height={1.2}
            style:color={typography.color}
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
            tabindex="-1"
            style:font-family={`"${docTypo.fontFamily}", serif`}
            style:font-size="{baseFontPx}px"
            style:line-height={bodyLineHeightEm(docTypo.leading)}
            style:color={docTypo.color}
            onclick={(e) => {
                e.preventDefault();
                documentStore.activateEmbed(block.id);
                onfocusblock(block.id);
                // Put caret at end of title for editing convenience.
                if (el) {
                    el.focus();
                    setCaretOffset(el, el.textContent?.length ?? 0);
                }
            }}
        >
            {#if outlineEntries.length === 0}
                <div class="opacity-30">No outlined headings yet...</div>
            {:else}
                {#each outlineEntries as entry (entry.id)}
                    <div
                        class="flex w-full items-baseline gap-1"
                        style:padding-left="{(entry.level - 1) * indentEm}em"
                    >
                        <span class="whitespace-pre"
                            >{entry.prefix}{entry.text}</span
                        >
                        <span
                            class="min-w-0 flex-1 overflow-hidden"
                            style:letter-spacing="0.1em"
                            style:opacity="0.8"
                            aria-hidden="true">{".".repeat(200)}</span
                        >
                        <span class="shrink-0 tabular-nums">{entry.page}</span>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/snippet}

{#if isVSpacing}
    {@const vsp = block.vSpacing!}
    {@const active = documentStore.activeBlock.id === block.id}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={embedEl}
        class={[
            "doc-embed relative flex w-full cursor-pointer items-center gap-2",
            active && "opacity-100",
        ]}
        data-block-id={block.id}
        tabindex="-1"
        style:height="{vsp.amount.value}{vsp.amount.unit === 'fr'
            ? 'fr'
            : vsp.amount.unit}"
        style:min-height="{8 * scale}px"
        onclick={(e) => {
            e.preventDefault();
            documentStore.activateEmbed(block.id);
            onfocusblock(block.id);
            embedEl?.focus({ preventScroll: true });
        }}
    >
        <div
            class="h-px flex-1 border-t border-dashed opacity-30"
            style:border-color={typography.color}
        ></div>
        <span
            class="font-sans shrink-0 select-none tabular-nums opacity-40"
            style:font-size="{10 * scale}px"
            style:color={typography.color}
            >{vsp.amount.value}{vsp.amount.unit}{vsp.weak ? " weak" : ""}</span
        >
        <div
            class="h-px flex-1 border-t border-dashed opacity-30"
            style:border-color={typography.color}
        ></div>
    </div>
{:else if isHSpacing}
    {@const hsp = block.hSpacing!}
    {@const active = documentStore.activeBlock.id === block.id}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
        bind:this={outerEl}
        class="doc-embed relative cursor-pointer align-baseline"
        class:inline-block={hsp.amount.unit !== 'fr'}
        class:flex-1={hsp.amount.unit === 'fr'}
        data-block-id={block.id}
        tabindex="-1"
        onclick={(e) => {
            e.preventDefault();
            documentStore.activateEmbed(block.id);
            onfocusblock(block.id);
            outerEl?.focus({ preventScroll: true });
        }}
    >
        <span
            class="select-none rounded opacity-40 outline-dashed outline-1"
            class:inline-block={hsp.amount.unit !== 'fr'}
            class:block={hsp.amount.unit === 'fr'}
            style:outline-color={typography.color}
            style:width={hsp.amount.unit === 'fr'
                ? '100%'
                : hsp.amount.unit === '%'
                    ? `${hsp.amount.value}%`
                    : `${hsp.amount.value}${hsp.amount.unit}`}
            style:min-width="{8 * scale}px"
            style:height="{fontSizePx * 0.8}px"
            style:vertical-align={hsp.amount.unit !== 'fr'
                ? `${(fontSizePx * (lineHeight - 0.8)) / 2 - fontSizePx * 0.35}px`
                : undefined}
        ></span>
    </span>
{:else if isPageBreak}
    {@const awaitingDelete = documentStore.embedAwaitingDelete === block.id}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={embedEl}
        class="doc-embed relative flex w-full cursor-pointer items-center gap-2 py-1"
        data-block-id={block.id}
        tabindex="-1"
        onclick={(e) => {
            e.preventDefault();
            documentStore.activateEmbed(block.id);
            onfocusblock(block.id);
            embedEl?.focus({ preventScroll: true });
        }}
    >
        {#if awaitingDelete}
            <span
                class="font-sans text-text-150 pointer-events-none absolute right-0 bottom-full select-none"
                style:font-size="{10 * scale}px"
                style:line-height="1"
                style:padding-bottom="{8 * scale}px"
            >
                Backspace to delete
            </span>
        {/if}
        <div class="h-px flex-1 border-t border-dashed opacity-25" style:border-color={typography.color}></div>
        <span
            class="font-sans shrink-0 select-none opacity-30"
            style:font-size="{9 * scale}px"
            style:color={typography.color}
        >Page break</span>
        <div class="h-px flex-1 border-t border-dashed opacity-25" style:border-color={typography.color}></div>
    </div>
{:else if isOutline}
    {@render outlineView()}
{:else if isEmbed}
    {@render embedView()}
{:else if isFootnoteBody}
    {@const awaitingDelete = documentStore.embedAwaitingDelete === block.id}
    <div
        bind:this={outerEl}
        class="doc-embed relative w-full"
        data-block-id={block.id}
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
        <div class="flex w-full items-baseline gap-1">
            <sup
                class="footnote-body-number pointer-events-none shrink-0 select-none tabular-nums"
                style:font-family={`"${typography.fontFamily}", serif`}
                style:font-size="{fontSizePx * 0.75}px"
                style:line-height="1"
                style:color={typography.color}
                aria-hidden="true">{footnoteBodyNumber}</sup
            >
            <div class="min-w-0 flex-1">
                {@render editable()}
            </div>
        </div>
    </div>
{:else if isList}
    <!-- List items render as a single flex row (marker + body). Horizontal
	     alignment of the whole group is applied by the wrapper around the
	     list group in `Document.svelte`, so markers stay vertically aligned
	     in column 1 while the group as a whole shifts left/center/right. -->
    <div
        bind:this={outerEl}
        class="flex w-full"
        style:padding-left="{listIndentPt}pt"
        style:margin-top={listGroupFirst && !suppressAbove
            ? `${listAboveEm}em`
            : undefined}
        style:margin-bottom={listHasNext
            ? `${listItemGapEm}em`
            : `${listBelowEm}em`}
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
{:else if block.footnoteMarker}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
        bind:this={outerEl}
        data-block-id={block.id}
        class="doc-block-footnote-marker inline cursor-pointer select-none tabular-nums"
        style:font-family={`"${typography.fontFamily}", serif`}
        style:font-size="{fontSizePx * 0.75}px"
        style:vertical-align="super"
        style:line-height="1"
        style:color={typography.color}
        role="button"
        tabindex="0"
        title="Footnote"
        onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            documentStore.activateFootnoteMarker(block.id);
            onfocusblock(block.id);
        }}
        onkeydown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            documentStore.activateFootnoteMarker(block.id);
            onfocusblock(block.id);
        }}>{footnoteMarkerNumber}</span
    >
{:else if isPageCounter}
    <!-- Non-interactive page counter chip. Non-deletable when zone numbering is on. -->
    <span
        bind:this={outerEl}
        data-block-id={block.id}
        class="doc-block-page-counter inline select-none"
        style:font-family={`"${typography.fontFamily}", serif`}
        style:font-size="{fontSizePx}px"
        style:font-weight={fontWeight}
        style:line-height={lineHeight}
        style:color={typography.color}
        style:vertical-align="baseline"
        aria-label="Page number"
    >{pageCounterPreviewText}</span>
{:else if isReference || isCitation || isLink}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
        bind:this={outerEl}
        data-block-id={block.id}
        class={[
            "doc-block-reference relative inline cursor-pointer select-none",
            isLink && "underline",
        ]}
        style:font-family={`"${typography.fontFamily}", serif`}
        style:font-size="{fontSizePx}px"
        style:font-weight={fontWeight}
        style:line-height={lineHeight}
        style:color={typography.color}
        style:text-decoration-thickness="from-font"
        role="button"
        tabindex="0"
        onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            documentStore.activateReference(block.id);
            onfocusblock(block.id);
        }}
        onkeydown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            documentStore.activateReference(block.id);
            onfocusblock(block.id);
        }}
    >{isLink ? linkInlineLabel : isReference ? referenceInlineLabel : citationInlineLabel}</span
    >
{:else if isBibliography}
    {@const awaitingDelete = documentStore.embedAwaitingDelete === block.id}
    {@const bib = documentStore.bibliographySettings}
    {@const spacing = bib.spacing ?? { above: 1.2, below: 0.35 }}
    {@const isNumericStyle = (id: string) =>
        id === "ieee" || id === "alphanumeric" || id.includes("numeric") ||
        id.includes("vancouver") || id === "american-physics-society" ||
        id === "american-institute-of-physics" ||
        id === "american-institute-of-aeronautics-and-astronautics"}
    {@const numeric = isNumericStyle(bib.citationStyleId)}
    {@const titleOption = bib.titleOption}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={outerEl}
        class="relative w-full cursor-pointer"
        data-block-id={block.id}
        style:margin-top={suppressAbove ? "0" : `${spacing.above}em`}
        style:margin-bottom="{spacing.below}em"
        onclick={(e) => {
            e.preventDefault();
            documentStore.activateEmbed(block.id);
            onfocusblock(block.id);
            el?.focus();
            if (el) setCaretOffset(el, el.textContent?.length ?? 0);
        }}
    >
        {#if awaitingDelete}
            <span
                class="font-sans text-text-150 pointer-events-none absolute right-0 bottom-full select-none"
                style:font-size="{10 * scale}px"
                style:line-height="1"
                style:padding-bottom="{8 * scale}px"
            >
                Backspace to delete
            </span>
        {/if}
        <!-- Title: always render el so height reporting always has a node. When
             titleOption is "none", render it as an invisible zero-height element. -->
        <div
            bind:this={el}
            class="doc-block outline-none w-full"
            contenteditable="true"
            spellcheck="false"
            role="textbox"
            tabindex="0"
            aria-multiline="false"
            data-block-id={block.id}
            data-placeholder={titleOption !== "none" ? (effectivePlaceholder ?? docLocale.bibliography) : undefined}
            style:display={titleOption === "none" ? "none" : undefined}
            style:font-family={`"${typography.fontFamily}", serif`}
            style:font-size="{fontSizePx * 1.4}px"
            style:font-weight={700}
            style:line-height={1.2}
            style:color={typography.color}
            style:margin-bottom="0.35em"
            onfocus={() => onfocusblock(block.id)}
            oninput={onInput}
            onkeydown={onKeydown}
            onpaste={onPaste}
        ></div>
        <!-- Bibliography entries preview -->
        {#if bib.sources.length === 0}
            <div
                class="select-none opacity-30"
                style:font-family={`"${typography.fontFamily}", serif`}
                style:font-size="{fontSizePx}px"
                style:font-weight={fontWeight}
                style:line-height={1.5}
                style:color={typography.color}
            >No sources added yet.</div>
        {:else}
            <div
                class="select-none"
                style:font-family={`"${typography.fontFamily}", serif`}
                style:font-size="{fontSizePx}px"
                style:font-weight={fontWeight}
                style:line-height={1.5}
                style:color={typography.color}
            >
                {#each bib.sources as source, i (source.id)}
                    {@const key = numeric ? `[${i + 1}]` : source.id}
                    {@const author = source.authors || ""}
                    {@const year = source.date?.slice(0, 4) || ""}
                    {@const title = source.title || "Untitled"}
                    {@const journal = source.journalName || ""}
                    {@const vol = source.volume ? `, vol. ${source.volume}` : ""}
                    {@const iss = source.issue ? `, no. ${source.issue}` : ""}
                    {@const pages = source.pageRange ? `, pp. ${source.pageRange}` : ""}
                    <div class="flex gap-[1em]" style:margin-bottom="0.25em">
                        {#if numeric}
                            <span class="shrink-0">{key}</span>
                            <span>
                                {#if author}{author}{year ? `, ${year}` : ""}{title ? `. "${title}."` : ""}{journal ? ` ${journal}` : ""}{vol}{iss}{pages}.{/if}
                                {#if !author}"{title}."{year ? ` ${year}.` : ""}{/if}
                            </span>
                        {:else}
                            <span>
                                {#if author}{author}{year ? ` (${year})` : ""}. {/if}<em>{title}.</em>{journal ? ` ${journal}.` : ""}
                            </span>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
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

    /* Zero-width inline tails after an inline embed need a box for clicks/caret. */
    .doc-block.trail-after-inline-embed {
        display: inline-block;
        min-width: 0.25em;
        vertical-align: baseline;
    }
</style>
