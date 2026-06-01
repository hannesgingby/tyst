import type {
	Block,
	BlockSpacing,
	DocumentModel,
	EmbedKind,
	HeadingLevel,
	HeadingNumberingSettings,
	HeadingSettings,
	HorizontalAlignment,
	ImageSettings,
	LineSettings,
	ListKind,
	ListSettings,
	FootnotePageSettings,
	OutlineSettings,
	PageSection,
	PageSettings,
	ParagraphSettings,
	PaperPreset,
	RectSettings,
	StrokeSettings,
	TypographySettings,
} from "./types";
import { resolveHeadingSpacing, resolveListSpacing } from "./blockSpacing";
import {
	hasBlockHeadingNumberingOverride,
	hasBlockHeadingSpacingOverride,
	hasBlockListSpacingOverride,
	resolveBlockHeadingNumbering,
	resolveBlockHeadingSpacing,
	resolveBlockListSpacing,
} from "./blockLevelStyle";
import { listGroupBlockIds, listGroupFirstBlock } from "./listGroup";
import { isHeadingLevelLinked, resolveHeadingLevelStyle } from "./headingStyle";
import { PAPER_SIZES, matchPreset } from "./paperSizes";
import { serializeDocument } from "./serialize";

function newId(): string {
	return crypto.randomUUID();
}

export function defaultFootnotePageSettings(): FootnotePageSettings {
	return { numbering: "1", clearance: 1, gap: 0.5, indent: 1 };
}

function defaultPage(): PageSettings {
	return {
		preset: "A4",
		size: { ...PAPER_SIZES.A4 },
		landscape: false,
		margins: { x: null, y: null, left: 2.5, right: 2.5, top: 2.5, bottom: 2.5 },
		fill: "#FFFFFF",
		linked: { paper: true, margin: true, color: true },
		footnote: defaultFootnotePageSettings(),
	};
}

function defaultModel(): DocumentModel {
	return {
		name: "Document name",
		pages: [defaultPage()],
		activePageIndex: 0,
		typography: {
			fontFamily: "Libertinus Serif",
			weight: "Regular",
			size: 11,
			leading: 0.65,
			tracking: 0,
			color: "#000000",
		},
		paragraph: {
			spacing: 1.2,
			justify: false,
			firstLineIndent: null,
			hangingIndent: 0,
		},
		headings: { outlined: true },
		headingLinks: { 1: true, 2: true, 3: true, 4: true },
		headingLevels: {},
		headingSpacingShared: { above: 1.2, below: 0.35 },
		headingSpacingLinks: { 0: true, 1: true, 2: true, 3: true, 4: true },
		headingSpacing: {
			0: { above: 1.4, below: 0.5 },
			1: { above: 1.5, below: 0.5 },
			2: { above: 1.2, below: 0.35 },
			3: { above: 1.0, below: 0.25 },
			4: { above: 0.85, below: 0.2 },
		},
		listSpacingShared: { above: 0.8, below: 0.8 },
		listSpacingLinks: { bullet: true, numbered: true },
		listSpacing: {
			bullet: { above: 0.8, below: 0.8 },
			numbered: { above: 0.8, below: 0.8 },
		},
		imageSpacingShared: { above: 1.2, below: 0.35 },
		lineSpacingShared: { above: 1.2, below: 0.35 },
		rectSpacingShared: { above: 1.2, below: 0.35 },
		outlineSpacingShared: { above: 1.2, below: 0.35 },
		blocks: [{ id: newId(), text: "" }],
	};
}

function clonePage(page: PageSettings): PageSettings {
	return {
		...page,
		size: { ...page.size },
		margins: { ...page.margins },
		linked: { ...page.linked },
	};
}

/**
 * The reactive, app-wide document state. Implemented as a runes-powered class
 * and exported as a singleton so every component shares the same instance.
 */
class DocumentStore {
	model = $state<DocumentModel>(defaultModel());

	/** Editor UI state (not part of the serialized document). */
	activeBlockId = $state<string | null>(null);

	/**
	 * Block IDs currently covered by the user's text selection (may span
	 * multiple blocks). Empty means only the active block is the target.
	 */
	selectionBlockIds = $state<string[]>([]);

	/**
	 * A partial (intra-block) text selection: start and end character offsets
	 * within a single block. Used for inline-range formatting (splitting a
	 * block at the selection boundary to apply overrides to just that range).
	 * Null when there is no partial selection, or the selection spans multiple
	 * blocks (which is handled via selectionBlockIds instead).
	 */
	intraBlockSelection = $state<{ blockId: string; start: number; end: number } | null>(null);

	/** Block IDs that start a new page (derived from layout, set by Document). */
	pageBreakBlockIds = $state<string[]>([]);

	/** Pending text-range selection to restore after a DOM update (e.g. after split). */
	pendingSelection = $state<{ blockId: string; start: number; end: number } | null>(null);

	/** Block to focus after a DOM update (e.g. after inserting from a toolbar popup). */
	pendingFocus = $state<string | null>(null);

	/** Caret position to restore after the target block's contenteditable mounts. */
	pendingCaret = $state<{ blockId: string; offset: number } | null>(null);

	/** Heading level currently shown in the headings popup (1–4). */
	headingMenuLevel = $state<HeadingLevel>(1);

	/** True when the title entry is selected in the headings popup. */
	headingMenuIsTitle = $state(false);

	/** List kind shown in the list popup when not on a list block (insert preview). */
	listMenuKind = $state<ListKind>("bullet");

	/** Number of laid-out pages, reported by the paginating editor. */
	pageCount = $state(1);

	/**
	 * Which embed-block popup the toolbar should keep "tied" open. Derived from
	 * the active block's embed kind — when the user focuses an image / line /
	 * rect block, the corresponding toolbar popup appears anchored to the
	 * matching toolbar tool. Cleared when focus moves to a plain text block.
	 */
	readonly tiedPopup = $derived.by((): EmbedKind | null => {
		const b = this.activeBlock;
		if (b.image) return "image";
		if (b.footnoteSeparator) return "footnote";
		if (b.line) return "line";
		if (b.rect) return "rect";
		if (b.outline) return "outline";
		if (b.footnote || b.footnoteMarker) return "footnote";
		return null;
	});

	/**
	 * Set by the toolbar when the user clicks outside the tied popup. Suppresses
	 * the popup until either the active block changes or the user re-clicks the
	 * matching embed (which calls `activateEmbed` to clear this).
	 */
	popupDismissed = $state<EmbedKind | null>(null);

	/** Make `id` the active block and clear any popup dismissal for it. */
	activateEmbed(id: string): void {
		this.popupDismissed = null;
		this.activeBlockId = id;
	}

	/** Select an inline footnote marker and open the footnote popup. */
	activateFootnoteMarker(markerBlockId: string): void {
		const m = this.findBlock(markerBlockId);
		if (!m?.footnoteMarker) return;
		this.popupDismissed = null;
		this.activeBlockId = markerBlockId;
	}

	blockPageIndex(blockId: string): number {
		const idx = this.blockIndex(blockId);
		if (idx < 0) return 0;
		let page = 0;
		for (const breakId of this.pageBreakBlockIds) {
			const breakIdx = this.blockIndex(breakId);
			if (breakIdx >= 0 && breakIdx <= idx) page += 1;
		}
		return page;
	}

	readonly activeBlockPageIndex = $derived(this.blockPageIndex(this.activeBlock.id));

	resolveFootnoteSettings(pageIndex: number): FootnotePageSettings {
		const def = this.model.pages[0]?.footnote ?? defaultFootnotePageSettings();
		const page = this.model.pages[pageIndex];
		if (!page || pageIndex === 0) return page?.footnote ?? def;
		if (page.footnoteLinked !== false) return def;
		return page.footnote ?? def;
	}

	footnoteSettingsLinked(pageIndex: number): boolean {
		if (pageIndex === 0) return true;
		return this.model.pages[pageIndex]?.footnoteLinked !== false;
	}

	setFootnoteSettingsLinked(pageIndex: number, linked: boolean): void {
		if (pageIndex === 0) return;
		const page = this.ensurePageSettings(pageIndex);
		page.footnoteLinked = linked;
		if (linked) page.footnote = undefined;
	}

	updateFootnoteSettings(pageIndex: number, patch: Partial<FootnotePageSettings>): void {
		if (pageIndex === 0) {
			const page = this.model.pages[0];
			page.footnote = { ...(page.footnote ?? defaultFootnotePageSettings()), ...patch };
			return;
		}
		const page = this.ensurePageSettings(pageIndex);
		if (page.footnoteLinked !== false) {
			const def = this.model.pages[0].footnote ?? defaultFootnotePageSettings();
			this.model.pages[0].footnote = { ...def, ...patch };
		} else {
			page.footnote = {
				...(page.footnote ?? this.resolveFootnoteSettings(pageIndex)),
				...patch,
			};
		}
	}

	private ensurePageSettings(index: number): PageSettings {
		while (this.model.pages.length <= index) {
			this.model.pages.push(clonePage(this.model.pages[0]));
		}
		return this.model.pages[index];
	}

	footnoteNumber(blockId: string): number {
		const page = this.blockPageIndex(blockId);
		let n = 0;
		for (const b of this.model.blocks) {
			if (this.blockPageIndex(b.id) !== page) continue;
			if (b.footnoteMarker) {
				n += 1;
				if (b.id === blockId) return n;
			}
		}
		return n;
	}

	footnoteNumberForBody(bodyBlockId: string): number {
		const body = this.findBlock(bodyBlockId);
		const fid = body?.footnote?.footnoteId;
		if (!fid) return 1;
		const marker = this.model.blocks.find((b) => b.footnoteMarker?.footnoteId === fid);
		return marker ? this.footnoteNumber(marker.id) : 1;
	}

	/**
	 * The embed block that's currently "armed" for deletion via Backspace:
	 * either the user clicked the embed (image / line / rect, or an outline
	 * with an empty title), or they're in an empty text block directly after
	 * an embed. Used for the "Backspace to delete" indicator and deletion.
	 */
	readonly embedAwaitingDelete = $derived.by((): string | null => {
		const active = this.activeBlock;
		if (!active) return null;

		if (active.image || active.line || active.rect) return active.id;
		if (active.footnote && active.text === "") return active.id;
		if (active.footnoteSeparator && active.line) return active.id;
		if (active.outline && active.text === "") return active.id;

		if (
			active.text !== "" ||
			active.continuation ||
			active.heading ||
			active.list
		)
			return null;
		const idx = this.blockIndex(active.id);
		if (idx <= 0) return null;
		const prev = this.model.blocks[idx - 1];
		if (prev.image || prev.line || prev.rect || prev.outline || prev.footnote)
			return prev.id;
		return null;
	});

	/**
	 * Remove an embed block from the document. Returns the caret target the
	 * editor should focus afterwards — preferring the block immediately above
	 * the embed, otherwise the first remaining block.
	 */
	deleteEmbed(id: string): { id: string; offset: number } | null {
		const idx = this.blockIndex(id);
		if (idx < 0) return null;
		const b = this.model.blocks[idx];
		if (
			!(
				b.image ||
				b.line ||
				b.rect ||
				b.outline ||
				b.footnote ||
				b.footnoteSeparator
			)
		)
			return null;

		if (b.footnote) {
			const footnoteId = b.footnote.footnoteId;
			const pageIndex = this.blockPageIndex(id);
			// Record caret target before splicing — multiple removals invalidate idx arithmetic.
			const markerIdx = this.model.blocks.findIndex(
				(bb) => bb.footnoteMarker?.footnoteId === footnoteId,
			);
			const caretBlock = markerIdx > 0 ? this.model.blocks[markerIdx - 1] : null;
			this.model.blocks.splice(idx, 1);
			for (let j = this.model.blocks.length - 1; j >= 0; j--) {
				const bb = this.model.blocks[j];
				if (bb.footnoteMarker?.footnoteId === footnoteId) {
					this.model.blocks.splice(j, 1);
					// Merge or remove the continuation block that was after the marker.
					// insertFootnote always creates a trailing continuation (empty or split text).
					const afterMarker = this.model.blocks[j];
					if (
						afterMarker?.continuation &&
						!afterMarker.typography &&
						!afterMarker.paragraph &&
						!afterMarker.footnoteMarker &&
						!afterMarker.footnote
					) {
						const beforeMarker = j > 0 ? this.model.blocks[j - 1] : null;
						if (beforeMarker) beforeMarker.text += afterMarker.text;
						this.model.blocks.splice(j, 1);
					}
					break;
				}
			}
			// If no footnote bodies remain on this page, remove the separator too.
			const hasMoreFootnotes = this.model.blocks.some(
				(bb) => bb.footnote && this.blockPageIndex(bb.id) === pageIndex,
			);
			if (!hasMoreFootnotes) {
				const sepIdx = this.model.blocks.findIndex(
					(bb) =>
						bb.footnoteSeparator && this.blockPageIndex(bb.id) === pageIndex,
				);
				if (sepIdx >= 0) this.model.blocks.splice(sepIdx, 1);
			}
			if (caretBlock) return { id: caretBlock.id, offset: caretBlock.text.length };
		} else {
			this.model.blocks.splice(idx, 1);
		}
		if (this.model.blocks.length === 0) {
			const fresh: Block = { id: newId(), text: "" };
			this.model.blocks.push(fresh);
			return { id: fresh.id, offset: 0 };
		}
		if (idx > 0 && idx <= this.model.blocks.length) {
			const before = this.model.blocks[idx - 1];
			if (before) return { id: before.id, offset: before.text.length };
		}
		return { id: this.model.blocks[0].id, offset: 0 };
	}

	readonly typ = $derived.by(() =>
		serializeDocument(this.model, this.pageBreakBlockIds),
	);

	/** The document's default page (index 0). */
	readonly defaultPage = $derived(this.model.pages[0]);

	// --- Linked-state getters/setters -----------------------------------------
	//
	// "Linked" means the selection/active block inherits the global default.
	// The state is derived from whether the target blocks carry overrides.

	/** IDs of the blocks to consider when reading/writing linked state. */
	private get targetBlockIds(): string[] {
		return this.selectionBlockIds.length > 0
			? this.selectionBlockIds
			: [this.activeBlock.id];
	}

	findBlock(id: string): Block | undefined {
		return this.model.blocks.find((b) => b.id === id);
	}

	private isOverrideEmpty(key: "typography" | "paragraph", id: string): boolean {
		const b = this.findBlock(id);
		return !b?.[key] || Object.keys(b[key]!).length === 0;
	}

	get typographyLinked(): boolean {
		return this.targetBlockIds.every((id) => this.isOverrideEmpty("typography", id));
	}

	set typographyLinked(value: boolean) {
		// Unlinking a partial selection splits the block first so only the
		// selected range gets the override.
		if (!value && this.intraBlockSelection) {
			const { blockId, start, end } = this.intraBlockSelection;
			const midId = this.splitBlockAtSelection(blockId, start, end);
			if (midId) {
				const mid = this.findBlock(midId);
				if (mid) {
					mid.typography = { ...this.resolveTypography(mid) };
					this.pendingSelection = { blockId: midId, start: 0, end: mid.text.length };
				}
				return;
			}
		}
		for (const id of this.targetBlockIds) {
			const b = this.findBlock(id);
			if (!b) continue;
			b.typography = value ? undefined : { ...this.resolveTypography(b) };
		}
	}

	get paragraphLinked(): boolean {
		return this.targetBlockIds.every((id) => this.isOverrideEmpty("paragraph", id));
	}

	set paragraphLinked(value: boolean) {
		for (const id of this.targetBlockIds) {
			const b = this.findBlock(id);
			if (!b) continue;
			b.paragraph = value ? undefined : { ...this.resolveParagraph(b) };
		}
	}

	get activeBlock(): Block {
		return this.findBlock(this.activeBlockId ?? "") ?? this.model.blocks[0];
	}

	readonly isEditingHeadingBlock = $derived(this.activeBlock.heading !== undefined);

	readonly isEditingListBlock = $derived(this.activeBlock.list !== undefined);

	/** Row index for the headings list (0 = title, 1–4 = heading levels). */
	readonly headingMenuIndex = $derived.by((): 0 | HeadingLevel => {
		const level = this.activeBlock.heading?.level;
		if (level !== undefined) return level;
		if (this.headingMenuIsTitle) return 0;
		return this.headingMenuLevel;
	});

	/**
	 * Level used by the headings popup's right-hand panel. Always follows the
	 * hovered/selected row so the user can configure any level without leaving
	 * their current heading block.
	 */
	readonly headingEditLevel = $derived.by((): HeadingLevel => this.headingMenuLevel);

	/** List kind for spacing tags / insert preview. */
	readonly listSpacingKind = $derived(
		(): ListKind => this.activeBlock.list?.kind ?? this.listMenuKind,
	);

	resolveHeadingStyle(level: HeadingLevel): HeadingNumberingSettings {
		return resolveHeadingLevelStyle(this.model, level);
	}

	private get headingNumberingTargetBlock(): Block | null {
		// Only treat the active block as the override target when the popup's
		// hovered level matches it — otherwise the user is configuring a
		// different level entirely.
		const block = this.activeBlock;
		if (!block.heading || block.heading.level === 0) return null;
		if (this.headingMenuIsTitle) return null;
		if (block.heading.level !== this.headingMenuLevel) return null;
		return block;
	}

	get headingNumberingLinked(): boolean {
		const block = this.headingNumberingTargetBlock;
		if (block) return !hasBlockHeadingNumberingOverride(block);
		return isHeadingLevelLinked(this.model, this.headingEditLevel);
	}

	set headingNumberingLinked(value: boolean) {
		const block = this.headingNumberingTargetBlock;
		const level = this.headingEditLevel;
		if (block) {
			if (value) {
				delete block.headingNumbering;
			} else {
				block.headingNumbering = {
					...resolveHeadingLevelStyle(this.model, block.heading!.level as HeadingLevel),
				};
			}
			return;
		}
		if (value) {
			this.model.headingLinks[level] = true;
			delete this.model.headingLevels[level];
		} else {
			this.model.headingLinks[level] = false;
			this.model.headingLevels[level] = { ...this.resolveHeadingStyle(level) };
		}
	}

	readonly popupHeadingStyle = $derived.by((): HeadingNumberingSettings => {
		const block = this.activeBlock;
		if (
			block.heading &&
			block.heading.level !== 0 &&
			!this.headingMenuIsTitle &&
			block.heading.level === this.headingMenuLevel
		) {
			return (
				resolveBlockHeadingNumbering(this.model, block) ??
				this.resolveHeadingStyle(block.heading.level as HeadingLevel)
			);
		}
		return this.resolveHeadingStyle(this.headingEditLevel);
	});

	get popupHeadingNumbering(): string {
		return this.popupHeadingStyle.numbering ?? "";
	}

	set popupHeadingNumbering(value: string) {
		const numbering = value.trim() || undefined;
		const level = this.headingEditLevel;
		const block = this.headingNumberingTargetBlock;
		if (block && !this.headingNumberingLinked) {
			(block.headingNumbering ??= {}).numbering = numbering;
			return;
		}
		if (this.headingNumberingLinked) {
			this.model.headings.numbering = numbering;
		} else {
			(this.model.headingLevels[level] ??= {}).numbering = numbering;
		}
	}

	get popupHeadingOutlined(): boolean {
		return this.popupHeadingStyle.outlined !== false;
	}

	set popupHeadingOutlined(value: boolean) {
		const level = this.headingEditLevel;
		const block = this.headingNumberingTargetBlock;
		if (block && !this.headingNumberingLinked) {
			(block.headingNumbering ??= {}).outlined = value;
			return;
		}
		if (this.headingNumberingLinked) {
			this.model.headings.outlined = value;
		} else {
			(this.model.headingLevels[level] ??= {}).outlined = value;
		}
	}

	/** Level key used for spacing — includes 0 (title) unlike headingEditLevel. */
	get headingSpacingLevel(): 0 | HeadingLevel {
		if (this.headingMenuIsTitle) return 0;
		return this.headingMenuLevel;
	}

	private get headingSpacingTargetBlock(): Block | null {
		const block = this.activeBlock;
		if (!block.heading) return null;
		const blockLevel = block.heading.level as 0 | HeadingLevel;
		const menuLevel: 0 | HeadingLevel = this.headingMenuIsTitle ? 0 : this.headingMenuLevel;
		if (blockLevel !== menuLevel) return null;
		return block;
	}

	private ensureHeadingSpacing(level: 0 | HeadingLevel): BlockSpacing {
		if (!this.model.headingSpacing) this.model.headingSpacing = {};
		const resolved = resolveHeadingSpacing(this.model, level);
		return (this.model.headingSpacing[level] ??= {
			above: resolved?.above ?? 1.0,
			below: resolved?.below ?? 0.3,
		});
	}

	get headingSpacingLinked(): boolean {
		// "Linked" now reflects whether the active block follows its level's
		// document-default spacing. With no heading block on the relevant level,
		// nothing can be overridden so the tag stays linked.
		const block = this.headingSpacingTargetBlock;
		if (block) return !hasBlockHeadingSpacingOverride(block);
		return true;
	}

	set headingSpacingLinked(value: boolean) {
		const block = this.headingSpacingTargetBlock;
		if (!block) return;
		if (value) {
			delete block.headingSpacing;
			return;
		}
		const level = block.heading!.level as 0 | HeadingLevel;
		const resolved = resolveHeadingSpacing(this.model, level);
		block.headingSpacing = {
			above: resolved?.above ?? 1.0,
			below: resolved?.below ?? 0.3,
		};
	}

	get popupHeadingSpacingAbove(): number {
		const block = this.headingSpacingTargetBlock;
		if (block) {
			return resolveBlockHeadingSpacing(this.model, block)?.above ?? 1.0;
		}
		return resolveHeadingSpacing(this.model, this.headingSpacingLevel)?.above ?? 1.0;
	}

	set popupHeadingSpacingAbove(value: number) {
		const level = this.headingSpacingLevel;
		const block = this.headingSpacingTargetBlock;
		if (block && !this.headingSpacingLinked) {
			(block.headingSpacing ??= { above: 1.0, below: 0.3 }).above = value;
			return;
		}
		this.ensureHeadingSpacing(level).above = value;
	}

	get popupHeadingSpacingBelow(): number {
		const block = this.headingSpacingTargetBlock;
		if (block) {
			return resolveBlockHeadingSpacing(this.model, block)?.below ?? 0.3;
		}
		return resolveHeadingSpacing(this.model, this.headingSpacingLevel)?.below ?? 0.3;
	}

	set popupHeadingSpacingBelow(value: number) {
		const level = this.headingSpacingLevel;
		const block = this.headingSpacingTargetBlock;
		if (block && !this.headingSpacingLinked) {
			(block.headingSpacing ??= { above: 1.0, below: 0.3 }).below = value;
			return;
		}
		this.ensureHeadingSpacing(level).below = value;
	}

	private ensureListSpacing(kind: ListKind): BlockSpacing {
		if (!this.model.listSpacing) this.model.listSpacing = {};
		const resolved = resolveListSpacing(this.model, kind);
		return (this.model.listSpacing[kind] ??= {
			above: resolved?.above ?? 0.8,
			below: resolved?.below ?? 0.8,
		});
	}

	private listSpacingTargetBlock(kind: ListKind): Block | null {
		const block = this.activeBlock;
		if (block.list?.kind !== kind) return null;
		return listGroupFirstBlock(this.model, block, this.pageBreakBlockIds);
	}

	private clearListSpacingFromGroup(kind: ListKind, keepBlockId?: string): void {
		const first = this.listSpacingTargetBlock(kind);
		if (!first) return;
		for (const id of listGroupBlockIds(this.model, first.id, this.pageBreakBlockIds)) {
			if (id === keepBlockId) continue;
			const b = this.findBlock(id);
			if (b) delete b.listSpacing;
		}
	}

	isListSpacingLinkedFor(kind: ListKind): boolean {
		const block = this.activeBlock;
		if (block.list?.kind === kind) {
			return !hasBlockListSpacingOverride(this.model, block, this.pageBreakBlockIds);
		}
		return true;
	}

	setListSpacingLinkedFor(kind: ListKind, value: boolean): void {
		const block = this.listSpacingTargetBlock(kind);
		if (!block) return;
		if (value) {
			delete block.listSpacing;
			this.clearListSpacingFromGroup(kind);
			return;
		}
		const resolved = resolveListSpacing(this.model, kind);
		block.listSpacing = {
			above: resolved?.above ?? 0.8,
			below: resolved?.below ?? 0.8,
		};
		this.clearListSpacingFromGroup(kind, block.id);
	}

	get bulletListSpacingLinked(): boolean {
		return this.isListSpacingLinkedFor("bullet");
	}

	set bulletListSpacingLinked(value: boolean) {
		this.setListSpacingLinkedFor("bullet", value);
	}

	get numberedListSpacingLinked(): boolean {
		return this.isListSpacingLinkedFor("numbered");
	}

	set numberedListSpacingLinked(value: boolean) {
		this.setListSpacingLinkedFor("numbered", value);
	}

	private popupListSpacingAbove(kind: ListKind): number {
		const active = this.activeBlock;
		if (active.list?.kind === kind) {
			return (
				resolveBlockListSpacing(this.model, active, this.pageBreakBlockIds)?.above ?? 0.8
			);
		}
		return resolveListSpacing(this.model, kind)?.above ?? 0.8;
	}

	private setPopupListSpacingAbove(kind: ListKind, value: number): void {
		const block = this.listSpacingTargetBlock(kind);
		if (block && !this.isListSpacingLinkedFor(kind)) {
			(block.listSpacing ??= { above: 0.8, below: 0.8 }).above = value;
			this.clearListSpacingFromGroup(kind, block.id);
			return;
		}
		this.ensureListSpacing(kind).above = value;
	}

	private popupListSpacingBelow(kind: ListKind): number {
		const active = this.activeBlock;
		if (active.list?.kind === kind) {
			return (
				resolveBlockListSpacing(this.model, active, this.pageBreakBlockIds)?.below ?? 0.8
			);
		}
		return resolveListSpacing(this.model, kind)?.below ?? 0.8;
	}

	private setPopupListSpacingBelow(kind: ListKind, value: number): void {
		const block = this.listSpacingTargetBlock(kind);
		if (block && !this.isListSpacingLinkedFor(kind)) {
			(block.listSpacing ??= { above: 0.8, below: 0.8 }).below = value;
			this.clearListSpacingFromGroup(kind, block.id);
			return;
		}
		this.ensureListSpacing(kind).below = value;
	}

	get popupBulletListSpacingAbove(): number {
		return this.popupListSpacingAbove("bullet");
	}

	set popupBulletListSpacingAbove(value: number) {
		this.setPopupListSpacingAbove("bullet", value);
	}

	get popupBulletListSpacingBelow(): number {
		return this.popupListSpacingBelow("bullet");
	}

	set popupBulletListSpacingBelow(value: number) {
		this.setPopupListSpacingBelow("bullet", value);
	}

	get popupNumberedListSpacingAbove(): number {
		return this.popupListSpacingAbove("numbered");
	}

	set popupNumberedListSpacingAbove(value: number) {
		this.setPopupListSpacingAbove("numbered", value);
	}

	get popupNumberedListSpacingBelow(): number {
		return this.popupListSpacingBelow("numbered");
	}

	set popupNumberedListSpacingBelow(value: number) {
		this.setPopupListSpacingBelow("numbered", value);
	}

	// --- Blocks ---------------------------------------------------------------

	blockIndex(id: string): number {
		return this.model.blocks.findIndex((b) => b.id === id);
	}

	setBlockText(id: string, text: string): void {
		const block = this.findBlock(id);
		if (!block) return;
		if (text === "" && block.heading) {
			block.heading = undefined;
			block.placeholder = undefined;
		}
		block.text = text;
	}

	/** Insert a new (override-free) block before `id`, returning its id. */
	insertBlockBefore(id: string, text: string): string {
		const index = this.blockIndex(id);
		const created: Block = { id: newId(), text };
		this.model.blocks.splice(Math.max(0, index), 0, created);
		return created.id;
	}

	/** Insert a new (override-free) block after `id`, returning its id. */
	insertBlockAfter(id: string, text: string): string {
		const index = this.blockIndex(id);
		const created: Block = { id: newId(), text };
		this.model.blocks.splice(index + 1, 0, created);
		return created.id;
	}

	/** Insert a fully-built block after `id`, returning its id. */
	insertBlockObjectAfter(id: string, block: Omit<Block, "id">): string {
		const index = this.blockIndex(id);
		const created: Block = { ...block, id: newId() };
		this.model.blocks.splice(index + 1, 0, created);
		return created.id;
	}

	/**
	 * Insert an embed block (image / line / rect) at the active block, plus an
	 * empty text block immediately after it so the user can continue writing
	 * by clicking below the embed. Returns the new embed block's id.
	 */
	insertEmbed(block: Omit<Block, "id">): string {
		const active = this.activeBlock;
		const isEmptyDefault =
			active.text === "" &&
			!active.continuation &&
			!active.heading &&
			!active.list &&
			!active.image &&
			!active.line &&
			!active.rect &&
			!active.alignment;

		let id: string;
		if (isEmptyDefault) {
			// Replace the empty placeholder block with the embed in-place.
			Object.assign(active, block);
			id = active.id;
		} else {
			id = this.insertBlockObjectAfter(active.id, block);
		}
		// Always ensure there's a writable text block after the embed.
		const nextIndex = this.blockIndex(id) + 1;
		const next = this.model.blocks[nextIndex];
		if (!next || next.continuation || next.image || next.line || next.rect || next.outline) {
			this.insertBlockObjectAfter(id, { text: "" });
		}
		this.activeBlockId = id;
		return id;
	}

	/** Default settings for a freshly-inserted image embed. */
	defaultImageSettings(fileName: string, ext: string): ImageSettings {
		return {
			fileName,
			ext,
			fit: "cover",
			scaling: "auto",
		};
	}

	private defaultStroke(): StrokeSettings {
		return {
			color: "#000000",
			thickness: 1,
			cap: "butt",
			join: "miter",
			dash: "solid",
		};
	}

	/** Default settings for a freshly-inserted line embed. */
	defaultLineSettings(): LineSettings {
		return {
			startX: 0,
			startY: 0,
			length: 100,
			lengthUnit: "%",
			angle: 0,
			stroke: this.defaultStroke(),
		};
	}

	/** Default settings for a freshly-inserted outline embed. */
	defaultOutlineSettings(): OutlineSettings {
		return { target: "heading" };
	}

	/** Default settings for a freshly-inserted rectangle embed (60×30 px in pt). */
	defaultRectSettings(): RectSettings {
		return {
			// 60px = 45pt, 30px = 22.5pt. The popup displays in px by default.
			width: 45,
			height: 22.5,
			fillEnabled: false,
			fillColor: "#000000",
			radius: 0,
			inset: 5,
			stroke: this.defaultStroke(),
		};
	}

	private isFootnoteZoneBlock(b: Block): boolean {
		return !!(b.footnote || b.footnoteSeparator);
	}

	/** Index after the last block on `pageIndex` (append to page). */
	private footnoteBodyInsertIndex(pageIndex: number): number {
		let lastOnPage = -1;
		for (let i = 0; i < this.model.blocks.length; i++) {
			if (this.blockPageIndex(this.model.blocks[i].id) === pageIndex) lastOnPage = i;
		}
		return lastOnPage + 1;
	}

	/** Insert separator before the first footnote-zone block on the page. */
	private footnoteSeparatorInsertIndex(pageIndex: number): number {
		for (let i = 0; i < this.model.blocks.length; i++) {
			const b = this.model.blocks[i];
			if (this.blockPageIndex(b.id) !== pageIndex) continue;
			if (this.isFootnoteZoneBlock(b)) return i;
		}
		return this.footnoteBodyInsertIndex(pageIndex);
	}

	/** Same stroke weight as a newly inserted line embed; 30% length per Typst default. */
	defaultFootnoteSeparatorLine(): LineSettings {
		return {
			startX: 0,
			startY: 0,
			length: 30,
			lengthUnit: "%",
			angle: 0,
			stroke: this.defaultStroke(),
		};
	}

	private findFootnoteSeparatorOnPage(pageIndex: number): Block | undefined {
		return this.model.blocks.find(
			(b) =>
				b.footnoteSeparator &&
				b.line &&
				this.blockPageIndex(b.id) === pageIndex,
		);
	}

	private ensureFootnoteSeparator(pageIndex: number): void {
		if (this.findFootnoteSeparatorOnPage(pageIndex)) return;
		this.insertBlockObjectAt(this.footnoteSeparatorInsertIndex(pageIndex), {
			text: "",
			line: this.defaultFootnoteSeparatorLine(),
			footnoteSeparator: true,
		});
	}

	private insertBlockObjectAt(index: number, block: Omit<Block, "id">): string {
		const created: Block = { ...block, id: newId() };
		this.model.blocks.splice(index, 0, created);
		return created.id;
	}

	/** Insert inline marker + footnote body at the bottom of the active page. */
	insertFootnote(): string {
		const active = this.activeBlock;
		const footnoteId = newId();
		const pageIndex = this.blockPageIndex(active.id);

		const canMark =
			!active.image &&
			!active.line &&
			!active.rect &&
			!active.outline &&
			!active.footnote &&
			!active.footnoteMarker;

		const insertTrailingText = (markerBlockId: string): void => {
			this.insertBlockObjectAfter(markerBlockId, {
				text: "",
				continuation: true,
			});
		};

		if (canMark) {
			const sel = this.intraBlockSelection;
			const caret =
				sel && sel.blockId === active.id ? sel.end : active.text.length;
			const text = active.text;
			if (caret > 0 && caret < text.length) {
				const before = text.slice(0, caret);
				const after = text.slice(caret);
				active.text = before;
				const markerId = newId();
				const marker: Block = {
					id: markerId,
					text: "",
					continuation: true,
					footnoteMarker: { footnoteId },
				};
				this.model.blocks.splice(this.blockIndex(active.id) + 1, 0, marker);
				if (after) {
					this.model.blocks.splice(this.blockIndex(active.id) + 2, 0, {
						id: newId(),
						text: after,
						continuation: true,
					});
				} else {
					insertTrailingText(markerId);
				}
			} else {
				const markerId = this.insertBlockObjectAfter(active.id, {
					text: "",
					continuation: true,
					footnoteMarker: { footnoteId },
				});
				insertTrailingText(markerId);
			}
		}

		this.ensureFootnoteSeparator(pageIndex);

		const bodyId = this.insertBlockObjectAt(this.footnoteBodyInsertIndex(pageIndex), {
			text: "",
			footnote: { footnoteId },
			placeholder: "Footnote",
		});

		this.popupDismissed = null;
		this.activeBlockId = bodyId;
		this.pendingCaret = { blockId: bodyId, offset: 0 };
		return bodyId;
	}

	// --- Embed spacing (shared default + per-block override) ------------------
	//
	// Pattern mirrors the headings/lists model: a single document-level shared
	// value drives all blocks of that kind whose own `spacing` is undefined.
	// Editing the popup while "linked" writes to the shared value; clicking
	// unlink copies the resolved value to the block.

	private embedSharedKey(kind: EmbedKind):
		| "imageSpacingShared"
		| "lineSpacingShared"
		| "rectSpacingShared"
		| "outlineSpacingShared" {
		return kind === "image"
			? "imageSpacingShared"
			: kind === "line"
				? "lineSpacingShared"
				: kind === "rect"
					? "rectSpacingShared"
					: "outlineSpacingShared";
	}

	embedSharedSpacing(kind: EmbedKind): BlockSpacing {
		const key = this.embedSharedKey(kind);
		return (this.model[key] ??= { above: 1.2, below: 0.35 });
	}

	/** Spacing in effect for a block (its own override, falling back to shared). */
	resolveEmbedSpacing(block: Block): BlockSpacing | null {
		if (block.image) return block.image.spacing ?? this.embedSharedSpacing("image");
		if (block.line) return block.line.spacing ?? this.embedSharedSpacing("line");
		if (block.rect) return block.rect.spacing ?? this.embedSharedSpacing("rect");
		if (block.outline) return block.outline.spacing ?? this.embedSharedSpacing("outline");
		return null;
	}

	embedSpacingLinked(block: Block): boolean {
		if (block.image) return block.image.spacing == null;
		if (block.line) return block.line.spacing == null;
		if (block.rect) return block.rect.spacing == null;
		if (block.outline) return block.outline.spacing == null;
		return true;
	}

	private embedKind(block: Block): EmbedKind | null {
		if (block.image) return "image";
		if (block.line) return "line";
		if (block.rect) return "rect";
		if (block.outline) return "outline";
		return null;
	}

	/** Set above/below spacing for an embed block, honouring its linked state. */
	setEmbedSpacing(
		block: Block,
		patch: { above?: number; below?: number },
	): void {
		const linked = this.embedSpacingLinked(block);
		if (linked) {
			const kind = this.embedKind(block);
			if (!kind) return;
			const shared = this.embedSharedSpacing(kind);
			if (patch.above !== undefined) shared.above = patch.above;
			if (patch.below !== undefined) shared.below = patch.below;
			return;
		}
		const target = block.image ?? block.line ?? block.rect ?? block.outline;
		if (!target?.spacing) return;
		if (patch.above !== undefined) target.spacing.above = patch.above;
		if (patch.below !== undefined) target.spacing.below = patch.below;
	}

	/** Toggle the linked state of an embed block's spacing. */
	setEmbedSpacingLinked(block: Block, linked: boolean): void {
		if (linked) {
			if (block.image) block.image.spacing = undefined;
			else if (block.line) block.line.spacing = undefined;
			else if (block.rect) block.rect.spacing = undefined;
			else if (block.outline) block.outline.spacing = undefined;
			return;
		}
		// Unlinking: copy the resolved value onto the block.
		const resolved = this.resolveEmbedSpacing(block);
		const copy: BlockSpacing = { above: resolved?.above ?? 1.2, below: resolved?.below ?? 0.35 };
		if (block.image) block.image.spacing = copy;
		else if (block.line) block.line.spacing = copy;
		else if (block.rect) block.rect.spacing = copy;
		else if (block.outline) block.outline.spacing = copy;
	}

	/** Update settings of an embed block in place; no-op if kind mismatches. */
	updateImage(id: string, patch: Partial<ImageSettings>): void {
		const b = this.findBlock(id);
		if (!b?.image) return;
		b.image = { ...b.image, ...patch };
	}

	updateLine(id: string, patch: Partial<LineSettings>): void {
		const b = this.findBlock(id);
		if (!b?.line) return;
		b.line = { ...b.line, ...patch };
	}

	updateRect(id: string, patch: Partial<RectSettings>): void {
		const b = this.findBlock(id);
		if (!b?.rect) return;
		b.rect = { ...b.rect, ...patch };
	}

	updateOutline(id: string, patch: Partial<OutlineSettings>): void {
		const b = this.findBlock(id);
		if (!b?.outline) return;
		b.outline = { ...b.outline, ...patch };
	}

	/**
	 * Either turn the active block into the given configuration (if it is
	 * empty), or insert a new configured block after it.
	 */
	insertOrTransformActive(block: Omit<Block, "id">): string {
		const active = this.activeBlock;
		// Empty default block? Reuse it so we don't leave an orphan above.
		let id: string;
		if (
			active.text === "" &&
			!active.continuation &&
			!active.heading &&
			!active.list &&
			!active.alignment
		) {
			Object.assign(active, block);
			id = active.id;
		} else {
			id = this.insertBlockObjectAfter(active.id, block);
		}
		this.activeBlockId = id;
		this.pendingFocus = id;
		return id;
	}

	setHeading(id: string, heading: HeadingSettings | undefined): void {
		const b = this.findBlock(id);
		if (!b) return;
		if (heading && b.continuation) return;
		b.heading = heading;
		if (heading) b.list = undefined;
	}

	setList(id: string, list: ListSettings | undefined): void {
		const b = this.findBlock(id);
		if (!b) return;
		if (list && b.continuation) return;
		b.list = list;
		if (list) b.heading = undefined;
	}

	/** First block of the list group containing the active block, if any. */
	listGroupFirstForActive(): Block | null {
		const block = this.activeBlock;
		if (!block.list) return null;
		return listGroupFirstBlock(this.model, block, this.pageBreakBlockIds);
	}

	/** Apply list settings to every item in the group anchored at `anchorBlockId`. */
	applyListGroupSettings(anchorBlockId: string, settings: ListSettings): void {
		const anchor = this.findBlock(anchorBlockId);
		if (!anchor?.list) return;
		for (const id of listGroupBlockIds(
			this.model,
			anchorBlockId,
			this.pageBreakBlockIds,
		)) {
			const b = this.findBlock(id);
			if (!b?.list) continue;
			b.list = { ...settings };
		}
	}

	setAlignment(id: string, alignment: HorizontalAlignment | undefined): void {
		const b = this.findBlock(id);
		if (!b) return;
		// Alignment on a list item applies to the whole list group (marker + body
		// across all items) so the user can't end up with mixed-alignment lists.
		if (b.list) {
			for (const groupId of listGroupBlockIds(this.model, id, this.pageBreakBlockIds)) {
				const gb = this.findBlock(groupId);
				if (gb) gb.alignment = alignment;
			}
			return;
		}
		b.alignment = alignment;
	}

	/**
	 * Merge a block into its predecessor. Returns the previous block's id and the
	 * caret offset (join point), or `null` if there is no predecessor.
	 */
	mergeWithPrevious(id: string): { id: string; offset: number } | null {
		const index = this.blockIndex(id);
		if (index < 0) return null;
		const block = this.model.blocks[index];
		// Footnote zone blocks (body, separator, marker) are managed as a unit —
		// never merge them into or from regular content.
		if (block.footnote || block.footnoteSeparator || block.footnoteMarker) return null;
		// First block: nothing to merge backwards into. If it's an empty plain
		// block and another block follows, drop it so the next block becomes the
		// new top of the document (mirrors Backspace behaviour in other editors).
		if (index === 0) {
			if (
				block.text === "" &&
				!block.heading &&
				!block.list &&
				!block.image &&
				!block.line &&
				!block.rect &&
				!block.outline &&
				this.model.blocks.length > 1
			) {
				this.model.blocks.splice(0, 1);
				const next = this.model.blocks[0];
				return { id: next.id, offset: 0 };
			}
			return null;
		}
		const prev = this.model.blocks[index - 1];
		if (prev.footnote || prev.footnoteSeparator || prev.footnoteMarker) return null;
		if (prev.image || prev.line || prev.rect || prev.outline) return null;
		const offset = prev.text.length;
		prev.text += block.text;
		this.model.blocks.splice(index, 1);
		return { id: prev.id, offset };
	}

	// --- Typography / paragraph (with "body" tag scoping) ---------------------

	resolveTypography(block: Block): TypographySettings {
		return { ...this.model.typography, ...(block.typography ?? {}) };
	}

	resolveParagraph(block: Block): ParagraphSettings {
		const p = { ...this.model.paragraph, ...(block.paragraph ?? {}) };
		return { ...p, hangingIndent: p.hangingIndent ?? 0 };
	}

	/**
	 * Values shown in the typography popup. When linked, shows the global
	 * default. When unlinked, shows the resolved style of the first target block.
	 */
	readonly popupTypography = $derived.by(() => {
		if (this.typographyLinked) return this.model.typography;
		const b = this.findBlock(this.targetBlockIds[0]) ?? this.activeBlock;
		return this.resolveTypography(b);
	});

	readonly popupParagraph = $derived.by(() => {
		if (this.paragraphLinked) return this.model.paragraph;
		const b = this.findBlock(this.targetBlockIds[0]) ?? this.activeBlock;
		return this.resolveParagraph(b);
	});

	setTypography<K extends keyof TypographySettings>(key: K, value: TypographySettings[K]): void {
		if (this.typographyLinked) {
			this.model.typography[key] = value;
		} else {
			for (const id of this.targetBlockIds) {
				const b = this.findBlock(id);
				if (!b) continue;
				(b.typography ??= {})[key] = value;
			}
		}
		if (key === "leading") this.syncSpacingToLeadingIfLinked();
	}

	setParagraph<K extends keyof ParagraphSettings>(
		key: K,
		value: ParagraphSettings[K],
		opts?: { fromLeadingSync?: boolean },
	): void {
		if (key === "spacing" && !opts?.fromLeadingSync) {
			this.setSpacingFollowsLeading(false);
		}
		if (this.paragraphLinked) {
			this.model.paragraph[key] = value;
			return;
		}
		for (const id of this.targetBlockIds) {
			const b = this.findBlock(id);
			if (!b) continue;
			(b.paragraph ??= {})[key] = value;
		}
	}

	/** Set or clear first-line indent; links paragraph spacing to leading when enabled. */
	setFirstLineIndent(value: number | null): void {
		if (value == null) {
			const wasLinked = this.popupSpacingFollowsLeading();
			this.setParagraph("firstLineIndent", null);
			this.setSpacingFollowsLeading(false);
			if (wasLinked) {
				this.setParagraph("spacing", 1.2, { fromLeadingSync: true });
			}
			return;
		}
		const wasUnset = this.popupParagraph.firstLineIndent == null;
		this.setParagraph("firstLineIndent", value);
		if (wasUnset) {
			this.setSpacingFollowsLeading(true);
			this.syncSpacingToLeadingIfLinked();
		}
	}

	private popupSpacingFollowsLeading(): boolean {
		return this.popupParagraph.spacingFollowsLeading === true;
	}

	private setSpacingFollowsLeading(value: boolean): void {
		if (this.paragraphLinked) {
			if (value) this.model.paragraph.spacingFollowsLeading = true;
			else delete this.model.paragraph.spacingFollowsLeading;
			return;
		}
		for (const id of this.targetBlockIds) {
			const b = this.findBlock(id);
			if (!b) continue;
			const p = (b.paragraph ??= {});
			if (value) p.spacingFollowsLeading = true;
			else delete p.spacingFollowsLeading;
		}
	}

	private syncSpacingToLeadingIfLinked(): void {
		if (!this.popupSpacingFollowsLeading()) return;
		this.setParagraph("spacing", this.popupTypography.leading, {
			fromLeadingSync: true,
		});
	}

	readonly isBold = $derived(this.resolveTypography(this.activeBlock).weight === "Bold");
	readonly isItalic = $derived(this.resolveTypography(this.activeBlock).italic === true);
	readonly isUnderline = $derived(this.resolveTypography(this.activeBlock).underline === true);

	private toggleInlineFormat(
		caretOffset: number,
		getter: (t: ReturnType<DocumentStore["resolveTypography"]>) => boolean,
		setter: (t: NonNullable<Block["typography"]>, v: boolean) => void,
	): void {
		const block = this.activeBlock;
		const currentOn = getter(this.resolveTypography(block));
		const newValue = !currentOn;

		if (this.intraBlockSelection) {
			const { blockId, start, end } = this.intraBlockSelection;
			const block = this.findBlock(blockId);
			if (block && start === 0 && end === block.text.length) {
				// Entire block selected — apply directly, no split needed
				block.typography = { ...this.resolveTypography(block) };
				setter(block.typography, newValue);
				this.pendingSelection = { blockId: block.id, start: 0, end: block.text.length };
				return;
			}
			const midId = this.splitBlockAtSelection(blockId, start, end);
			if (midId) {
				const mid = this.findBlock(midId)!;
				mid.typography = { ...this.resolveTypography(mid) };
				setter(mid.typography, newValue);
				this.pendingSelection = { blockId: midId, start: 0, end: mid.text.length };
				return;
			}
		}

		// When the block already has text, don't change existing text's format.
		// Split at the caret so only future typing gets the new format.
		if (
			block.text !== "" &&
			caretOffset > 0 &&
			!block.heading && !block.list &&
			!block.image && !block.line && !block.rect && !block.outline
		) {
			const newTypo: NonNullable<Block["typography"]> = block.typography
				? { ...block.typography }
				: {};
			setter(newTypo, newValue);

			if (caretOffset >= block.text.length) {
				// Caret at end: append new empty continuation — no text change needed
				const newId = this.insertBlockObjectAfter(block.id, {
					text: "",
					continuation: true,
					typography: Object.keys(newTypo).length > 0 ? newTypo : undefined,
				});
				this.activeBlockId = newId;
				this.pendingCaret = { blockId: newId, offset: 0 };
			} else {
				// Caret in middle: split text, remaining text moves to new continuation
				const newId = this.insertBlockObjectAfter(block.id, {
					text: block.text.slice(caretOffset),
					continuation: true,
					typography: Object.keys(newTypo).length > 0 ? newTypo : undefined,
				});
				block.text = block.text.slice(0, caretOffset);
				this.activeBlockId = newId;
				this.pendingCaret = { blockId: newId, offset: 0 };
			}
			return;
		}

		for (const id of this.targetBlockIds) {
			const b = this.findBlock(id);
			if (!b) continue;
			if (!b.typography) b.typography = {};
			setter(b.typography, newValue);
		}
	}

	toggleBold(caretOffset = 0): void {
		this.toggleInlineFormat(
			caretOffset,
			(t) => t.weight === "Bold",
			(t, v) => { t.weight = v ? "Bold" : "Regular"; },
		);
	}

	toggleItalic(caretOffset = 0): void {
		this.toggleInlineFormat(
			caretOffset,
			(t) => t.italic === true,
			(t, v) => { if (v) t.italic = true; else delete t.italic; },
		);
	}

	toggleUnderline(caretOffset = 0): void {
		this.toggleInlineFormat(
			caretOffset,
			(t) => t.underline === true,
			(t, v) => { if (v) t.underline = true; else delete t.underline; },
		);
	}

	/**
	 * Split block `id` at `startOffset`..`endOffset`, turning the selected
	 * range into its own block (with any typography/paragraph overrides from the
	 * original) so that inline-range formatting can be applied to it.
	 * Returns the ID of the middle (selected) block.
	 */
	splitBlockAtSelection(
		id: string,
		startOffset: number,
		endOffset: number,
	): string | null {
		const index = this.blockIndex(id);
		if (index < 0) return null;
		const block = this.model.blocks[index];
		if (block.heading || block.list || block.image || block.line || block.rect || block.outline) return null;
		const text = block.text;
		if (startOffset >= endOffset || startOffset < 0 || endOffset > text.length) return null;

		const before = text.slice(0, startOffset);
		const selected = text.slice(startOffset, endOffset);
		const after = text.slice(endOffset);

		// Update original block to hold only the "before" text.
		block.text = before;

		// Middle block (the selection) inherits the original block's overrides.
		const midId = newId();
		const midBlock: Block = {
			id: midId,
			text: selected,
			continuation: true,
			typography: block.typography ? { ...block.typography } : undefined,
			paragraph: block.paragraph ? { ...block.paragraph } : undefined,
		};

		// Trailing block continues on the same line with no overrides.
		const afterId = newId();
		const afterBlock: Block = {
			id: afterId,
			text: after,
			continuation: true,
		};

		this.model.blocks.splice(index + 1, 0, midBlock, afterBlock);
		return midId;
	}

	// --- Pages (with per-section "default" tag scoping) -----------------------

	setActivePage(index: number): void {
		if (index < 0) return;
		this.ensurePage(index);
		this.model.activePageIndex = index;
	}

	/** Make sure a `PageSettings` entry exists for `index` (linked to default). */
	ensurePage(index: number): void {
		while (this.model.pages.length <= index) {
			this.model.pages.push({
				...clonePage(this.model.pages[0]),
				linked: { paper: true, margin: true, color: true },
			});
		}
	}

	/** Resolve which `PageSettings` object governs `section` on a given page. */
	pageSectionSource(pageIndex: number, section: PageSection): PageSettings {
		const def = this.model.pages[0];
		const page = this.model.pages[pageIndex] ?? def;
		return pageIndex > 0 && page.linked[section] ? def : page;
	}

	/** Same, defaulting to the active page. */
	sectionSource(section: PageSection): PageSettings {
		return this.pageSectionSource(this.model.activePageIndex, section);
	}

	readonly activePaperSource = $derived.by(() => this.sectionSource("paper"));
	readonly activeMarginSource = $derived.by(() => this.sectionSource("margin"));
	readonly activeColorSource = $derived.by(() => this.sectionSource("color"));

	/** Is the active page's section linked to the default? */
	isSectionLinked(section: PageSection): boolean {
		const index = this.model.activePageIndex;
		return index === 0 || (this.model.pages[index]?.linked[section] ?? true);
	}

	toggleSectionLink(section: PageSection): void {
		const index = this.model.activePageIndex;
		if (index === 0) return;
		const page = this.model.pages[index];
		if (!page) return;
		if (page.linked[section]) {
			// Diverge: seed the page's own values from the current default.
			const def = this.model.pages[0];
			if (section === "paper") {
				page.preset = def.preset;
				page.size = { ...def.size };
				page.landscape = def.landscape;
			} else if (section === "margin") {
				page.margins = { ...def.margins };
			} else {
				page.fill = def.fill;
			}
			page.linked[section] = false;
		} else {
			page.linked[section] = true;
		}
	}

	setPaperPreset(preset: PaperPreset): void {
		const page = this.activePaperSource;
		page.preset = preset;
		if (preset !== "Custom") page.size = { ...PAPER_SIZES[preset] };
	}

	setDimension(axis: "width" | "height", value: number): void {
		const page = this.activePaperSource;
		page.size[axis] = value;
		page.preset = matchPreset(page.size);
	}

	/** Quick page-size change from the topbar; targets the default page. */
	setDefaultPreset(preset: PaperPreset): void {
		const page = this.model.pages[0];
		page.preset = preset;
		if (preset !== "Custom") page.size = { ...PAPER_SIZES[preset] };
	}

	load(model: DocumentModel): void {
		this.model = model;
	}
}

export const documentStore = new DocumentStore();
