import type {
	Block,
	DocumentModel,
	HeadingSettings,
	HorizontalAlignment,
	ListSettings,
	PageSection,
	PageSettings,
	ParagraphSettings,
	PaperPreset,
	TypographySettings,
} from "./types";
import { PAPER_SIZES, matchPreset } from "./paperSizes";
import { serializeDocument } from "./serialize";

function newId(): string {
	return crypto.randomUUID();
}

function defaultPage(): PageSettings {
	return {
		preset: "A4",
		size: { ...PAPER_SIZES.A4 },
		landscape: false,
		margins: { x: null, y: null, left: 2.5, right: 2.5, top: 2.5, bottom: 2.5 },
		fill: "#FFFFFF",
		linked: { paper: true, margin: true, color: true },
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
			hangingIndent: null,
		},
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

	/** Number of laid-out pages, reported by the paginating editor. */
	pageCount = $state(1);

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

	// --- Blocks ---------------------------------------------------------------

	blockIndex(id: string): number {
		return this.model.blocks.findIndex((b) => b.id === id);
	}

	setBlockText(id: string, text: string): void {
		const block = this.findBlock(id);
		if (block) block.text = text;
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
		b.heading = heading;
		if (heading) b.list = undefined;
	}

	setHeadingNumbering(id: string, numbering: string | undefined): void {
		const b = this.findBlock(id);
		if (!b?.heading) return;
		b.heading.numbering = numbering && numbering.length > 0 ? numbering : undefined;
	}

	setList(id: string, list: ListSettings | undefined): void {
		const b = this.findBlock(id);
		if (!b) return;
		b.list = list;
		if (list) b.heading = undefined;
	}

	setAlignment(id: string, alignment: HorizontalAlignment | undefined): void {
		const b = this.findBlock(id);
		if (!b) return;
		b.alignment = alignment;
	}

	/**
	 * Merge a block into its predecessor. Returns the previous block's id and the
	 * caret offset (join point), or `null` if there is no predecessor.
	 */
	mergeWithPrevious(id: string): { id: string; offset: number } | null {
		const index = this.blockIndex(id);
		if (index <= 0) return null;
		const prev = this.model.blocks[index - 1];
		const block = this.model.blocks[index];
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
		return { ...this.model.paragraph, ...(block.paragraph ?? {}) };
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
			return;
		}
		for (const id of this.targetBlockIds) {
			const b = this.findBlock(id);
			if (!b) continue;
			(b.typography ??= {})[key] = value;
		}
	}

	setParagraph<K extends keyof ParagraphSettings>(key: K, value: ParagraphSettings[K]): void {
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
