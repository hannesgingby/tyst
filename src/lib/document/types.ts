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

/**
 * A content block. A block is one paragraph (the unit at which the "body" tag
 * can be unlinked to apply formatting without affecting the rest of the text).
 * `text` is plain text; a single `\n` is a soft line break within the block.
 */
export interface Block {
	id: string;
	text: string;
	typography?: TypographyOverride;
	paragraph?: ParagraphOverride;
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
	/** Document body as an ordered list of paragraph blocks. */
	blocks: Block[];
}
