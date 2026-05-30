/**
 * The serializable document model.
 *
 * This is the single source of truth that the whole editor reads from and writes
 * to. It maps closely onto a Typst document so that serialization to a `.typ`
 * file is mostly a 1:1 translation (see `serialize.ts`).
 */

export type PaperPreset = "A4" | "A3" | "A5" | "US Letter" | "US Legal" | "Custom";

export interface PageSize {
	/** Page width in points. */
	width: number;
	/** Page height in points. */
	height: number;
}

export interface Margins {
	/**
	 * Symmetric horizontal / vertical overrides in points. `null` means "auto"
	 * (Typst centres the content / uses the per-side values).
	 */
	x: number | null;
	y: number | null;
	/** Per-side margins in centimetres. */
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** Which sections of a page are linked to the document default (page 0). */
export interface PageLinks {
	paper: boolean;
	margin: boolean;
	color: boolean;
}

export type PageSection = keyof PageLinks;

export interface PageSettings {
	preset: PaperPreset;
	size: PageSize;
	landscape: boolean;
	margins: Margins;
	/** Paper (background) colour as a hex string, e.g. "#FFFFFF". */
	fill: string;
	/**
	 * The "default" tags, per section. When a section is linked, it inherits the
	 * document default (page index 0); when unlinked it carries its own value.
	 * All sections are always linked for the default page itself.
	 */
	linked: PageLinks;
}

export type FontWeightName = "Regular" | "Medium" | "Bold";

export interface TypographySettings {
	fontFamily: string;
	weight: FontWeightName;
	/**
	 * Font size in typographic points (Typst's native unit). Serialized directly
	 * as `pt` and converted to CSS pixels for on-page rendering. The UI may
	 * display this value in other units (pt/px/mm), but it is always stored in pt.
	 */
	size: number;
	/** Leading (space between lines) in em — maps to Typst `par(leading)`. */
	leading: number;
	/** Letter spacing in percent of the font size — maps to Typst `text(tracking)`. */
	tracking: number;
	/** Default text colour as a hex string. */
	color: string;
}

export interface ParagraphSettings {
	/** Spacing between paragraphs in em — maps to Typst `par(spacing)`. */
	spacing: number;
	justify: boolean;
	/** First-line indent in em, or `null` for none. */
	firstLineIndent: number | null;
	/** Hanging indent in em, or `null` for none. */
	hangingIndent: number | null;
}

/** Per-block overrides of the document's default typography ("body" tag). */
export type TypographyOverride = Partial<TypographySettings>;

/** Per-block overrides of the document's default paragraph settings. */
export type ParagraphOverride = Partial<ParagraphSettings>;

/** Heading levels that participate in outline numbering (excludes title). */
export type HeadingLevel = 1 | 2 | 3 | 4;

/**
 * Numbering and outline settings for headings. Stored on the document when linked
 * to the "headings" tag, or per-level when unlinked.
 */
export interface HeadingNumberingSettings {
	/** Typst numbering pattern (e.g. "1.a)") — empty/undefined means no numbering. */
	numbering?: string;
	outlined?: boolean;
}

/** Whether each heading level inherits the document-wide `headings` style. */
export interface HeadingLinks {
	1: boolean;
	2: boolean;
	3: boolean;
	4: boolean;
}

/**
 * Block heading metadata. `level: 0` is the document title; levels 1–4 map to
 * `#heading(level: N)[…]`. Numbering comes from `DocumentModel.headings` /
 * `headingLevels` (see `headingStyle.ts`).
 */
export interface HeadingSettings {
	level: 0 | HeadingLevel;
}

export type ListKind = "bullet" | "numbered";

/**
 * Settings for a single list item. Contiguous blocks with the same `kind`
 * group into one `#list(…)` / `#enum(…)` call; the settings of the first item
 * in the group govern the whole call.
 */
export interface ListSettings {
	kind: ListKind;
	/** Marker glyph (bullet) or numbering pattern (numbered). Empty for default. */
	marker?: string;
	/** `par(spacing)` equivalent in em; null for Typst default. */
	spacing?: number | null;
	/** Indent of the whole list in pt. */
	indent?: number;
	/** Indent between marker and body in em. */
	bodyIndent?: number;
	tight?: boolean;
	/** Numbered-only. */
	start?: number | null;
	full?: boolean;
	reversed?: boolean;
}

export type HorizontalAlignment = "left" | "center" | "right";

/** Space above and below a block element, in em. */
export interface BlockSpacing {
	above: number;
	below: number;
}

/**
 * A content block. In the default model each block is one "line" (no internal
 * line breaks). Blocks marked `continuation: true` are logically part of the
 * same visual line as their predecessor — no line break is inserted between
 * them in the serialized output, enabling inline-range formatting.
 */
export interface Block {
	id: string;
	text: string;
	/** If true, this block continues on the same line as the previous block. */
	continuation?: boolean;
	typography?: TypographyOverride;
	paragraph?: ParagraphOverride;
	/** Marks this block as a heading / title. */
	heading?: HeadingSettings;
	/** Marks this block as a list item. */
	list?: ListSettings;
	/** Per-block horizontal alignment. Undefined = inherit document default. */
	alignment?: HorizontalAlignment;
	/** Placeholder shown when the block has no text (e.g. "Heading 1", "Item"). */
	placeholder?: string;
}

export interface DocumentModel {
	name: string;
	/** Page definitions. Index 0 is the document's default page. */
	pages: PageSettings[];
	/** Which page is currently being configured in the settings modal. */
	activePageIndex: number;
	/** Default typography (the "body" style applied to all unlinked blocks). */
	typography: TypographySettings;
	/** Default paragraph settings. */
	paragraph: ParagraphSettings;
	/** Default numbering/outlined for all heading levels (the "headings" tag). */
	headings: HeadingNumberingSettings;
	/** When true, a level uses `headings`; when false, `headingLevels[level]`. */
	headingLinks: HeadingLinks;
	/** Per-level overrides when unlinked from `headings`. */
	headingLevels: Partial<Record<HeadingLevel, HeadingNumberingSettings>>;
	/** Above/below spacing for each heading level (0 = title), serialized as #block(above:, below:). */
	headingSpacing?: Partial<Record<0 | HeadingLevel, BlockSpacing>>;
	/** Above/below spacing for list groups, serialized as #block(above:, below:). */
	listSpacing?: { bullet?: BlockSpacing; numbered?: BlockSpacing };
	/** Document body as an ordered list of paragraph blocks. */
	blocks: Block[];
}
