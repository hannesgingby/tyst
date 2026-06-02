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

export type PageZoneCounterPattern = "1" | "1/1" | "I" | "i" | "A" | "a";

/** Non-deletable page counter chip inside a zone block (when zone numbering is enabled). */
export interface PageCounterSettings {
	pattern: PageZoneCounterPattern;
}

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
	/** Per-page footnote overrides when `footnoteLinked` is false. */
	footnote?: FootnotePageSettings;
	footnoteLinked?: boolean;
	/** Per-page header-ascent override when zone header is unlinked. */
	headerAscent?: string;
	/** Per-page footer-descent override when zone footer is unlinked. */
	footerDescent?: string;
	/** Whether each zone's inset is linked to the default page. Defaults to true. */
	zoneLinked?: { header: boolean; footer: boolean };
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
	/** Italic text style — maps to Typst `text(style: "italic")`. */
	italic?: boolean;
	/** Underline decoration — maps to Typst `#underline[…]`. */
	underline?: boolean;
}

export interface ParagraphSettings {
	/** Spacing between paragraphs in em — maps to Typst `par(spacing)`. */
	spacing: number;
	justify: boolean;
	/** First-line indent in pt, or `null` for none. */
	firstLineIndent: number | null;
	/** Hanging indent in pt — Typst default is `0pt`. */
	hangingIndent: number;
	/**
	 * When true, `spacing` tracks `typography.leading` (Typst recommends
	 * `spacing: 0.65em` with a first-line indent). Cleared when spacing is
	 * edited directly or first-line indent is removed.
	 */
	spacingFollowsLeading?: boolean;
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

export type ImageFit = "cover" | "contain" | "stretch";
export type ImageScaling = "auto" | "smooth" | "pixelated";

/** Embed: an image block (non-editable). */
export interface ImageSettings {
	/** Display name shown in the popup (typically the original filename). */
	fileName: string;
	/** Lowercase file extension without the dot (e.g. "png"). */
	ext: string;
	alt?: string;
	/** Width in pt (Typst native). null/undefined = auto. Popup may cycle pt/px display. */
	width?: number | null;
	/** Height in pt (Typst native). null/undefined = auto. */
	height?: number | null;
	fit?: ImageFit;
	scaling?: ImageScaling;
	spacing?: BlockSpacing;
}

export type StrokeCap = "butt" | "round" | "bevel";
export type StrokeJoin = "miter" | "round" | "bevel";
export type StrokeDash = "solid" | "dotted" | "dashed";

export interface StrokeSettings {
	color: string;
	thickness: number;
	cap: StrokeCap;
	join: StrokeJoin;
	dash: StrokeDash;
}

export type LineLengthUnit = "%" | "em" | "pt" | "px";

/** Embed: a line block (non-editable). Maps to Typst `#line(...)`. */
export interface LineSettings {
	startX: number;
	startY: number;
	length: number;
	lengthUnit: LineLengthUnit;
	angle: number;
	stroke: StrokeSettings;
	spacing?: BlockSpacing;
}

/** Per-page footnote listing settings (`#set footnote` / `footnote.entry`). */
export interface FootnotePageSettings {
	numbering: string;
	clearance: number;
	gap: number;
	indent: number;
}

export type SpacingUnit = "pt" | "em" | "cm" | "mm" | "fr" | "%";

export interface SpacingAmount {
	value: number;
	unit: SpacingUnit;
}

export interface SpacingSettings {
	amount: SpacingAmount;
	weak?: boolean;
}

/** Inline footnote reference (superscript in body text). */
export interface FootnoteMarker {
	footnoteId: string;
}

/** Footnote body at the bottom of the page; `text` is the note content. */
export interface FootnoteBody {
	footnoteId: string;
}

/**
 * Embed: an outline block. The block's `text` is the (editable) outline title;
 * everything else (the rendered table-of-contents body) is auto-generated from
 * the document's headings and is not directly editable.
 */
export interface OutlineSettings {
	/** Typst target selector (e.g. `"heading"`). Empty/`"heading"` = default. */
	target?: string;
	/** Maximum depth to include; null/undefined = no limit. */
	depth?: number | null;
	/** Indent per level in pt; null/undefined = Typst default (auto). */
	indent?: number | null;
	spacing?: BlockSpacing;
}

/** Embed: a rectangle block (non-editable). Maps to Typst `#rect(...)`. */
export interface RectSettings {
	/** Width in pt. null/undefined = auto. Popup may cycle pt/px display. */
	width: number | null;
	/** Height in pt. null/undefined = auto. */
	height: number | null;
	fillEnabled: boolean;
	fillColor: string;
	radius: number;
	inset: number;
	stroke: StrokeSettings;
	spacing?: BlockSpacing;
}

/**
 * A content block. In the default model each block is one "line" (no internal
 * line breaks). Blocks marked `continuation: true` are logically part of the
 * same visual line as their predecessor — no line break is inserted between
 * them in the serialized output, enabling inline-range formatting.
 *
 * A block is either a text block (default) or an embed block (one of
 * `image` / `line` / `rect`). Embed blocks have no editable text content.
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
	/** Per-block numbering override when unlinked from the document heading style. */
	headingNumbering?: HeadingNumberingSettings;
	/** Per-block above/below spacing override when unlinked from document heading spacing. */
	headingSpacing?: BlockSpacing;
	/** Marks this block as a list item. */
	list?: ListSettings;
	/** List-group spacing override (stored on the first item in the group). */
	listSpacing?: BlockSpacing;
	/** Per-block horizontal alignment. Undefined = inherit document default. */
	alignment?: HorizontalAlignment;
	/** Placeholder shown when the block has no text (e.g. "Heading 1", "Item"). */
	placeholder?: string;
	/** Embed: image. Mutually exclusive with line / rect / text content. */
	image?: ImageSettings;
	/** Embed: line. Mutually exclusive with image / rect / text content. */
	line?: LineSettings;
	/** Embed: rectangle. Mutually exclusive with image / line / text content. */
	rect?: RectSettings;
	/** Embed: outline (table of contents). `text` holds the editable title. */
	outline?: OutlineSettings;
	/** Inline footnote marker (superscript). */
	footnoteMarker?: FootnoteMarker;
	/** Footnote body in the page footnote zone. */
	footnote?: FootnoteBody;
	/** Line block used as the footnote listing separator for this page. */
	footnoteSeparator?: boolean;
	/** Embed: vertical spacing (`#v(…)`). */
	vSpacing?: SpacingSettings;
	/** Embed: horizontal inline spacing (`#h(…)`). Continuation block. */
	hSpacing?: SpacingSettings;
	/** Forces a page break before the next block. Serializes as `#pagebreak()`. */
	pageBreak?: boolean;
	/** Inline reference chip (continuation). Points to a heading or figure block. */
	reference?: ReferenceSettings;
	/** Inline citation chip (continuation). Points to a BibliographySource. */
	citation?: CitationSettings;
	/** Per-block language override (display name, e.g. "French"). Unlinked from the document default. */
	lang?: string;
	/** Inline link chip (continuation). Serializes as `#link(url)[body]`. */
	link?: LinkSettings;
	/** Bibliography block (like outline). `text` holds the editable title. */
	bibliography?: true;
	/**
	 * Marks this block as part of the page header or footer zone.
	 * Zone blocks are rendered in the margin area, not in the document body.
	 * They use the same editing infrastructure as body blocks.
	 */
	zoneKind?: "header" | "footer";
	/**
	 * Inline page counter chip. Only appears as a continuation block inside a zone.
	 * Non-deletable while zone numbering is enabled. Serializes as
	 * `#counter(page).display("pattern", both?: true)`.
	 */
	pageCounter?: PageCounterSettings;
}

/** Source types for bibliography entries. */
export const SOURCE_TYPES = ["Article", "Book", "Chapter", "Conference", "Report", "Thesis", "Web"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export interface BibliographySource {
	id: string;
	/** UI accordion state. */
	expanded: boolean;
	type: SourceType;
	title: string;
	authors: string;
	date: string;
	/** Journal name (Article), conference proceedings title (Conference). */
	journalName: string;
	volume: string;
	issue: string;
	pageRange: string;
	/** Publisher name (Book, Chapter), institution (Report, Thesis). */
	publisher: string;
	/** URL (Web). */
	url: string;
	/** Date the web source was accessed (Web). */
	accessDate: string;
}

/** Inline reference chip — points to a heading or figure block. */
export interface ReferenceSettings {
	/** Block ID of the referenced heading / image. */
	targetBlockId: string;
	/** Custom display text; empty means Typst auto-generates it. */
	displayText?: string;
	/** When true, renders `#ref(<label>, form: "page")`. */
	pageForm?: boolean;
}

/** Inline link chip — external URL with optional custom label. */
export interface LinkSettings {
	url: string;
	/** Custom link text; empty means Typst shows the URL. */
	displayText?: string;
}

/** Inline citation chip — points to a BibliographySource. */
export interface CitationSettings {
	/** BibliographySource.id to cite. */
	sourceId: string;
	/** Optional supplement text. */
	supplement?: string;
}

/** How document creation date is embedded in PDF metadata. */
export type DocumentMetadataDateMode = "auto" | "custom";

export interface DocumentMetadata {
	/** Empty string serializes as `title: none`. */
	title: string;
	authors: string[];
	/** Empty string serializes as `description: none`. */
	description: string;
	keywords: string[];
	dateMode: DocumentMetadataDateMode;
	/** `yyyy`, `yyyy-mm`, or `yyyy-mm-dd` when `dateMode` is `custom`. */
	date: string;
}

export interface BibliographySettings {
	sources: BibliographySource[];
	citationStyleId: string;
	titleOption: "your-choice" | "none";
	full: boolean;
	spacing?: BlockSpacing;
}

/** Embed block kinds. */
export type EmbedKind = "image" | "line" | "rect" | "outline" | "footnote" | "spacing" | "reference";

export interface DocumentModel {
	name: string;
	/** PDF / document metadata (`#set document(...)`). */
	metadata: DocumentMetadata;
	/** Page definitions. Index 0 is the document's default page. */
	pages: PageSettings[];
	/** Which page is currently being configured in the settings modal. */
	activePageIndex: number;
	/** Document language (display name, e.g. "English") — maps to Typst `text(lang: ...)`. */
	lang?: string;
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
	/** Shared heading spacing when a level is linked to the spacing tag. */
	headingSpacingShared?: BlockSpacing;
	/** When true, a level uses `headingSpacingShared`; when false, `headingSpacing[level]`. */
	headingSpacingLinks?: Partial<Record<0 | HeadingLevel, boolean>>;
	/** Per-level heading spacing overrides when unlinked. */
	headingSpacing?: Partial<Record<0 | HeadingLevel, BlockSpacing>>;
	/** Shared list spacing when a kind is linked to its spacing tag. */
	listSpacingShared?: BlockSpacing;
	/** When true, a list kind uses `listSpacingShared`; when false, `listSpacing[kind]`. */
	listSpacingLinks?: Partial<Record<ListKind, boolean>>;
	/** Per-kind list spacing overrides when unlinked. */
	listSpacing?: { bullet?: BlockSpacing; numbered?: BlockSpacing };
	/**
	 * Document-wide default spacing for each embed kind. When a block's own
	 * `image.spacing` / `line.spacing` / `rect.spacing` is undefined, the
	 * matching shared entry applies. Editing the popup while the spacing is
	 * "linked" writes to these shared values.
	 */
	imageSpacingShared?: BlockSpacing;
	lineSpacingShared?: BlockSpacing;
	rectSpacingShared?: BlockSpacing;
	outlineSpacingShared?: BlockSpacing;
	/**
	 * Per-heading-level typography overrides. Applied via `#show heading.where(level: N): set text(…)`
	 * so changing e.g. font size here updates ALL headings of that level.
	 * Size is NOT stored here — use `headingScale` instead so it stays relative to the body.
	 */
	headingTypography?: Partial<Record<HeadingLevel, Partial<TypographySettings>>>;
	/**
	 * Per-heading-level size as an em multiplier relative to the body font size.
	 * Serialized as `size: Xem` in `#show heading.where(level: N): set text(…)`.
	 * Falls back to `TYPST_HEADING_SCALE` defaults when unset.
	 */
	headingScale?: Partial<Record<HeadingLevel, number>>;
	/** Non-size typography overrides for the document title (heading level 0). */
	titleTypography?: Partial<TypographySettings>;
	/** Title size as an em multiplier relative to body. Defaults to 2.0. */
	titleScale?: number;
	/** Non-size typography overrides for outline (TOC) block titles. */
	outlineTitleTypography?: Partial<TypographySettings>;
	/** Outline title size as an em multiplier relative to body. Defaults to 1.4. */
	outlineTitleScale?: number;
	/** Typography overrides for footnote body text. Applied via `#show footnote.entry: set text(…)`. */
	footnoteTypography?: Partial<TypographySettings>;
	/** Document body as an ordered list of paragraph blocks. Zone blocks (zoneKind set) are prepended here too. */
	blocks: Block[];
	/**
	 * Typst `header-ascent` value (e.g. "30%" or "12pt").
	 * Controls how far the page header is raised into the top margin.
	 */
	headerAscent?: string;
	/**
	 * Typst `footer-descent` value (e.g. "30%" or "12pt").
	 * Controls how far the page footer is lowered into the bottom margin.
	 */
	footerDescent?: string;
	/** Bibliography settings (sources, style, etc.). Undefined until first citation is inserted. */
	bibliography?: BibliographySettings;
}
