import type {
	Block,
	BlockSpacing,
	DocumentModel,
	FontWeightName,
	HeadingLevel,
	HeadingSettings,
	HorizontalAlignment,
	ImageSettings,
	LineSettings,
	ListSettings,
	Margins,
	PageSettings,
	ParagraphSettings,
	RectSettings,
	StrokeSettings,
	TypographySettings,
} from "./types";
import {
	hasBlockHeadingNumberingOverride,
	resolveBlockHeadingSpacing,
	resolveBlockListSpacing,
} from "./blockLevelStyle";
import { isHeadingLevelLinked, resolveHeadingLevelStyle } from "./headingStyle";
import { TYPST_PAPER_NAME } from "./paperSizes";
import { pxToPt, typstNumber } from "./units";

const WEIGHT_KEYWORD: Record<FontWeightName, string> = {
	Regular: "regular",
	Medium: "medium",
	Bold: "bold",
};

/** Escape characters that are significant in Typst markup. */
function escapeText(text: string): string {
	return text.replace(/([\\#$*_`<>@~\[\]])/g, "\\$1");
}

function hexToRgb(hex: string): string {
	return `rgb("${hex.toUpperCase()}")`;
}

/** Build `text(...)` argument lines from a (possibly partial) typography object. */
function textArgs(t: Partial<TypographySettings>): string[] {
	const lines: string[] = [];
	if (t.fontFamily !== undefined) lines.push(`font: "${t.fontFamily}"`);
	if (t.size !== undefined) lines.push(`size: ${typstNumber(t.size)}pt`);
	if (t.weight !== undefined) lines.push(`weight: "${WEIGHT_KEYWORD[t.weight]}"`);
	if (t.color !== undefined) lines.push(`fill: ${hexToRgb(t.color)}`);
	if (t.tracking !== undefined && t.tracking !== 0) {
		lines.push(`tracking: ${typstNumber(t.tracking / 100)}em`);
	}
	return lines;
}

/** Build `par(...)` argument lines. `leading` comes from the typography object. */
function parArgs(leading: number | undefined, p: Partial<ParagraphSettings>): string[] {
	const lines: string[] = [];
	if (leading !== undefined) lines.push(`leading: ${typstNumber(leading)}em`);
	if (p.spacing !== undefined) lines.push(`spacing: ${typstNumber(p.spacing)}em`);
	if (p.justify !== undefined) lines.push(`justify: ${p.justify ? "true" : "false"}`);
	if (p.firstLineIndent != null) lines.push(`first-line-indent: ${typstNumber(p.firstLineIndent)}em`);
	if (p.hangingIndent != null) lines.push(`hanging-indent: ${typstNumber(p.hangingIndent)}em`);
	return lines;
}

/** Serialize margins to a Typst margin(...) expression. */
function serializeMargins(m: Margins): string {
	const parts: string[] = [];
	if (m.x != null) parts.push(`x: ${typstNumber(m.x)}pt`);
	if (m.y != null) parts.push(`y: ${typstNumber(m.y)}pt`);
	parts.push(`left: ${typstNumber(m.left)}cm`);
	parts.push(`right: ${typstNumber(m.right)}cm`);
	parts.push(`top: ${typstNumber(m.top)}cm`);
	parts.push(`bottom: ${typstNumber(m.bottom)}cm`);
	return `(${parts.join(", ")})`;
}

/** Serialize a full #set page(...) call for a given PageSettings. */
function serializePageSetFull(page: PageSettings): string {
	const lines: string[] = [];
	const paperName = TYPST_PAPER_NAME[page.preset];
	if (paperName) {
		lines.push(`  paper: "${paperName}",`);
	} else {
		lines.push(`  width: ${typstNumber(page.size.width)}pt,`);
		lines.push(`  height: ${typstNumber(page.size.height)}pt,`);
	}
	if (page.landscape) lines.push(`  flipped: true,`);
	lines.push(`  margin: ${serializeMargins(page.margins)},`);
	lines.push(`  fill: ${hexToRgb(page.fill)},`);
	return `#set page(\n${lines.join("\n")}\n)`;
}

/**
 * Compute the `#set page(...)` calls needed to transition from `prev`'s
 * resolved settings to `curr`'s resolved settings. Returns an empty array when
 * nothing changed. Only outputs the sections that actually differ, since Typst's
 * `#set page` is additive (unchanged properties keep their previous value).
 */
function serializePageTransition(
	defaultPage: PageSettings,
	prev: PageSettings,
	curr: PageSettings,
): string[] {
	// Resolve each section through the link system.
	const prevMargin = prev.linked.margin ? defaultPage : prev;
	const currMargin = curr.linked.margin ? defaultPage : curr;
	const prevPaper = prev.linked.paper ? defaultPage : prev;
	const currPaper = curr.linked.paper ? defaultPage : curr;
	const prevColor = prev.linked.color ? defaultPage : prev;
	const currColor = curr.linked.color ? defaultPage : curr;

	const pageArgs: string[] = [];

	// Paper / size
	if (
		currPaper.preset !== prevPaper.preset ||
		currPaper.size.width !== prevPaper.size.width ||
		currPaper.size.height !== prevPaper.size.height ||
		currPaper.landscape !== prevPaper.landscape
	) {
		const paperName = TYPST_PAPER_NAME[currPaper.preset];
		if (paperName) {
			pageArgs.push(`paper: "${paperName}"`);
		} else {
			pageArgs.push(`width: ${typstNumber(currPaper.size.width)}pt`);
			pageArgs.push(`height: ${typstNumber(currPaper.size.height)}pt`);
		}
		if (currPaper.landscape !== prevPaper.landscape) {
			pageArgs.push(`flipped: ${currPaper.landscape}`);
		}
	}

	// Margins
	const pm = prevMargin.margins;
	const cm = currMargin.margins;
	if (
		pm.left !== cm.left || pm.right !== cm.right ||
		pm.top !== cm.top || pm.bottom !== cm.bottom ||
		pm.x !== cm.x || pm.y !== cm.y
	) {
		pageArgs.push(`margin: ${serializeMargins(cm)}`);
	}

	// Fill / color
	if (currColor.fill !== prevColor.fill) {
		pageArgs.push(`fill: ${hexToRgb(currColor.fill)}`);
	}

	// Only emit #set page() if something changed; the caller always emits the pagebreak.
	return pageArgs.length > 0 ? [`#set page(${pageArgs.join(", ")})`] : [];
}

/** The document preamble: page, default text and default paragraph set rules. */
function serializePreamble(doc: DocumentModel): string {
	const textRule = `#set text(\n${textArgs(doc.typography)
		.map((l) => `  ${l},`)
		.join("\n")}\n)`;
	const parRule = `#set par(\n${parArgs(doc.typography.leading, doc.paragraph)
		.map((l) => `  ${l},`)
		.join("\n")}\n)`;

	const headingLines: string[] = [];
	if (doc.headings?.numbering) {
		headingLines.push(`numbering: "${doc.headings.numbering}"`);
	}
	if (doc.headings?.outlined === false) {
		headingLines.push(`outlined: false`);
	}
	const headingRule =
		headingLines.length > 0
			? `#set heading(\n${headingLines.map((l) => `  ${l},`).join("\n")}\n)`
			: null;

	const parts = [serializePageSetFull(doc.pages[0]), textRule, parRule];
	if (headingRule) parts.push(headingRule);
	return parts.join("\n\n");
}

/** Wrap `content` in `#block(above:, below:)[…]` for explicit element spacing. */
function wrapBlock(content: string, spacing: BlockSpacing): string {
	return `#block(above: ${typstNumber(spacing.above)}em, below: ${typstNumber(spacing.below)}em)[${content}]`;
}

/** Default above/below for embed blocks when the user hasn't unlinked spacing. */
const EMBED_SPACING_DEFAULT: BlockSpacing = { above: 1.2, below: 0.35 };

/** Filesystem-safe slug derived from the document name. Mirrors files.ts. */
function imagesFolderFor(doc: DocumentModel): string {
	const base =
		doc.name.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_") ||
		"document";
	return `${base}_files`;
}

/** Relative path emitted for an image block in the serialized .typ. */
export function imageRelativePath(
	doc: DocumentModel,
	blockId: string,
	image: ImageSettings,
): string {
	const folder = imagesFolderFor(doc);
	return `${folder}/${blockId}.${image.ext}`;
}

function escapeStringLiteral(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function strokeArg(s: StrokeSettings): string {
	const parts: string[] = [
		`paint: ${hexToRgb(s.color)}`,
		`thickness: ${typstNumber(s.thickness)}pt`,
		`cap: "${s.cap}"`,
		`join: "${s.join}"`,
	];
	if (s.dash === "dotted") parts.push(`dash: "dotted"`);
	else if (s.dash === "dashed") parts.push(`dash: "dashed"`);
	return `stroke(${parts.join(", ")})`;
}

function serializeImage(doc: DocumentModel, block: Block, image: ImageSettings): string {
	const path = escapeStringLiteral(imageRelativePath(doc, block.id, image));
	const args: string[] = [`"${path}"`];
	// Image width/height in the model are in CSS px (what the popup edits).
	// Typst doesn't accept `px` lengths in `image(...)`, so convert to pt.
	if (image.width != null) args.push(`width: ${typstNumber(pxToPt(image.width))}pt`);
	if (image.height != null) args.push(`height: ${typstNumber(pxToPt(image.height))}pt`);
	if (image.alt) args.push(`alt: "${escapeStringLiteral(image.alt)}"`);
	if (image.fit) args.push(`fit: "${image.fit}"`);
	return `#figure(image(${args.join(", ")}))`;
}

function serializeLine(line: LineSettings): string {
	const args: string[] = [
		`start: (${typstNumber(line.startX)}pt, ${typstNumber(line.startY)}pt)`,
		line.lengthUnit === "%"
			? `length: ${typstNumber(line.length)}%`
			: `length: ${typstNumber(line.length)}pt`,
		`angle: ${typstNumber(line.angle)}deg`,
		`stroke: ${strokeArg(line.stroke)}`,
	];
	return `#line(${args.join(", ")})`;
}

function serializeRect(rect: RectSettings): string {
	const args: string[] = [];
	if (rect.width != null) {
		const w = rect.widthUnit === "px" ? pxToPt(rect.width) : rect.width;
		args.push(`width: ${typstNumber(w)}pt`);
	}
	if (rect.height != null) {
		const h = rect.heightUnit === "px" ? pxToPt(rect.height) : rect.height;
		args.push(`height: ${typstNumber(h)}pt`);
	}
	if (rect.fillEnabled) args.push(`fill: ${hexToRgb(rect.fillColor)}`);
	if (rect.radius > 0) args.push(`radius: ${typstNumber(rect.radius)}pt`);
	if (rect.inset !== 5) args.push(`inset: ${typstNumber(rect.inset)}pt`);
	args.push(`stroke: ${strokeArg(rect.stroke)}`);
	return `#rect(${args.join(", ")})`;
}

function serializeEmbed(doc: DocumentModel, block: Block): string | null {
	if (block.image) return serializeImage(doc, block, block.image);
	if (block.line) return serializeLine(block.line);
	if (block.rect) return serializeRect(block.rect);
	return null;
}

/** Wrap `content` in `#align(...)[…]` when alignment is set and non-default. */
function wrapAligned(content: string, alignment: HorizontalAlignment | undefined): string {
	if (!alignment || alignment === "left") return content;
	return `#align(${alignment})[${content}]`;
}

/** Title (level 0) → styled #text; headings 1-4 → #heading(level: N, …). */
function serializeHeading(block: Block, heading: HeadingSettings, doc: DocumentModel): string {
	const text = escapeText(block.text);
	if (heading.level === 0) {
		// Title isn't a heading in Typst's model. Render as a bold, oversized line.
		return `#text(size: 2em, weight: "bold")[${text}]`;
	}
	const level = heading.level as HeadingLevel;
	const blockOverride = hasBlockHeadingNumberingOverride(block);
	const style = blockOverride
		? { ...resolveHeadingLevelStyle(doc, level), ...block.headingNumbering }
		: resolveHeadingLevelStyle(doc, level);
	const args: string[] = [`level: ${level}`];
	// Linked levels inherit `#set heading(...)` from the preamble.
	if (blockOverride || !isHeadingLevelLinked(doc, level)) {
		if (style.numbering) args.push(`numbering: "${style.numbering}"`);
		if (style.outlined === false) args.push(`outlined: false`);
	}
	return `#heading(${args.join(", ")})[${text}]`;
}

/** Build the argument list shared by both `#list(…)` and `#enum(…)`. */
function listSharedArgs(s: ListSettings): string[] {
	const args: string[] = [];
	if (s.tight === true) args.push(`tight: true`);
	else if (s.tight === false) args.push(`tight: false`);
	if (s.spacing != null) args.push(`spacing: ${typstNumber(s.spacing)}em`);
	if (s.indent != null && s.indent !== 0) args.push(`indent: ${typstNumber(s.indent)}pt`);
	if (s.bodyIndent != null) args.push(`body-indent: ${typstNumber(s.bodyIndent)}em`);
	return args;
}

function serializeListGroup(items: Block[]): string {
	const first = items[0].list!;
	const args = listSharedArgs(first);

	if (first.kind === "bullet") {
		if (first.marker) args.push(`marker: "${first.marker}"`);
	} else {
		if (first.marker) args.push(`numbering: "${first.marker}"`);
		if (first.start != null) args.push(`start: ${first.start}`);
		if (first.full) args.push(`full: true`);
		if (first.reversed) args.push(`reversed: true`);
	}

	const call = first.kind === "bullet" ? "list" : "enum";
	const bodies = items.map((b) => `[${escapeText(b.text)}]`).join("");
	if (args.length === 0) return `#${call}${bodies}`;
	return `#${call}(${args.join(", ")})${bodies}`;
}

/** Serialize a plain (non-heading, non-list) text block. */
function serializeTextBlock(block: Block, docTypo: TypographySettings): string {
	const text = escapeText(block.text);
	const typo = block.typography ?? {};
	const para = block.paragraph ?? {};

	if (block.continuation) {
		// Inline block: use #text(...)[content] with only the args that differ
		// from the document defaults. The #[...] scoped-block form is block-level
		// in Typst and would break the line — the function-call form stays inline.
		const diffTypo: Partial<TypographySettings> = {};
		for (const key of Object.keys(typo) as (keyof TypographySettings)[]) {
			if (typo[key] !== docTypo[key]) diffTypo[key] = typo[key] as never;
		}
		const tArgs = textArgs(diffTypo);
		if (tArgs.length === 0) return text;
		return `#text(${tArgs.join(", ")})[${text}]`;
	}

	const overrides: string[] = [];
	const tArgs = textArgs(typo);
	if (tArgs.length > 0) overrides.push(`#set text(${tArgs.join(", ")})`);
	const pArgs = parArgs(typo.leading, para);
	if (pArgs.length > 0) overrides.push(`#set par(${pArgs.join(", ")})`);

	if (overrides.length === 0) return text;
	return ["#[", ...overrides.map((o) => `  ${o}`), `  ${text}`, "]"].join("\n");
}

/**
 * Serialize the whole document model into a `.typ` source string.
 *
 * `pageBreakBlockIds` is an ordered list of block IDs that each start a new
 * page in the editor's visual layout. A `#pagebreak()` (plus any changed
 * `#set page(...)` calls) is inserted before each such block.
 *
 * Continuation blocks (marked `block.continuation`) are joined to the previous
 * block without any separator — they're inline on the same line.
 *
 * Headings and list items are emitted as standalone block-level elements.
 * Contiguous list items of the same `kind` group into one `#list(…)`/`#enum(…)`
 * call; settings come from the first item in the group.
 *
 * Two adjacent non-continuation, non-empty plain lines become `#linebreak()`.
 * One or more blank lines become `#parbreak()` + extra `#linebreak()`s.
 */
export function serializeDocument(
	doc: DocumentModel,
	pageBreakBlockIds: string[] = [],
): string {
	const preamble = serializePreamble(doc);

	const pageBreakSet = new Set(pageBreakBlockIds);
	const defaultPage = doc.pages[0];

	const blockPageIndex = new Map<string, number>();
	let pi = 1;
	for (const id of pageBreakBlockIds) blockPageIndex.set(id, pi++);

	let currentPageIdx = 0;

	const parts: string[] = [];
	let pendingBlanks = 0;
	let hasContent = false;
	/** Previous emitted block was a list or heading (Typst auto-parbreaks after both). */
	let afterList = false;
	let afterHeading = false;

	function handlePageBreak(block: Block): void {
		if (!pageBreakSet.has(block.id)) return;
		const nextPageIdx = blockPageIndex.get(block.id)!;
		const prevPage = doc.pages[currentPageIdx] ?? defaultPage;
		const nextPage = doc.pages[nextPageIdx] ?? defaultPage;
		currentPageIdx = nextPageIdx;
		hasContent = false;
		pendingBlanks = 0;
		afterHeading = false;
		parts.push("#pagebreak()");
		parts.push(...serializePageTransition(defaultPage, prevPage, nextPage));
	}

	function pushBlockSeparator(): void {
		// Block-level elements (headings, lists) auto-parbreak in Typst, so a blank
		// line between parts is enough; we only need explicit breaks between two
		// plain text lines (handled in the text branch).
	}

	let i = 0;
	while (i < doc.blocks.length) {
		const block = doc.blocks[i];

		handlePageBreak(block);

		// ── List group ──────────────────────────────────────────────────────────
		if (block.list) {
			const kind = block.list.kind;
			const items: Block[] = [block];
			let j = i + 1;
			while (
				j < doc.blocks.length &&
				doc.blocks[j].list?.kind === kind &&
				!pageBreakSet.has(doc.blocks[j].id)
			) {
				items.push(doc.blocks[j]);
				j++;
			}
			if (hasContent) parts.push("");
			const listSpacing = resolveBlockListSpacing(doc, block, pageBreakBlockIds);
			const listContent = serializeListGroup(items);
			parts.push(wrapAligned(listSpacing ? wrapBlock(listContent, listSpacing) : listContent, block.alignment));
			pushBlockSeparator();
			hasContent = true;
			pendingBlanks = 0;
			afterList = true;
			afterHeading = false;
			i = j;
			continue;
		}

		// ── Heading ─────────────────────────────────────────────────────────────
		if (block.heading) {
			if (hasContent) parts.push("");
			const headingContent = serializeHeading(block, block.heading, doc);
			const hLevel = block.heading.level;
			const headingSpacing = resolveBlockHeadingSpacing(doc, block);
			parts.push(wrapAligned(headingSpacing ? wrapBlock(headingContent, headingSpacing) : headingContent, block.alignment));
			pushBlockSeparator();
			hasContent = true;
			afterList = false;
			afterHeading = true;
			pendingBlanks = 0;
			i++;
			continue;
		}

		// ── Embed (image / line / rect) ─────────────────────────────────────────
		const embed = serializeEmbed(doc, block);
		if (embed) {
			if (hasContent) parts.push("");
			const sharedKey: "imageSpacingShared" | "lineSpacingShared" | "rectSpacingShared" =
				block.image
					? "imageSpacingShared"
					: block.line
						? "lineSpacingShared"
						: "rectSpacingShared";
			const ownSpacing =
				block.image?.spacing ?? block.line?.spacing ?? block.rect?.spacing;
			const spacing = ownSpacing ?? doc[sharedKey] ?? EMBED_SPACING_DEFAULT;
			parts.push(wrapAligned(wrapBlock(embed, spacing), block.alignment));
			pushBlockSeparator();
			hasContent = true;
			afterList = false;
			afterHeading = true; // treat like a block-level element: no implicit linebreak before next text
			pendingBlanks = 0;
			i++;
			continue;
		}

		// ── Blank block (paragraph-break placeholder) ───────────────────────────
		if (block.text === "") {
			if (hasContent && !block.continuation) pendingBlanks += 1;
			i++;
			continue;
		}

		// ── Plain content block ─────────────────────────────────────────────────
		const serialized = wrapAligned(
			serializeTextBlock(block, doc.typography),
			block.alignment,
		);
		if (hasContent && block.continuation) {
			parts[parts.length - 1] += serialized;
		} else {
			if (hasContent) {
				if (afterHeading || afterList) {
					// Headings/lists already end a paragraph in Typst; blank blocks become
					// explicit #linebreak()s before the next body text.
					for (let k = 0; k < pendingBlanks; k++) parts.push("#linebreak()");
				} else {
					if (pendingBlanks === 0) {
						parts.push("#linebreak()");
					} else {
						parts.push("#parbreak()");
						for (let k = 1; k < pendingBlanks; k++) parts.push("#linebreak()");
					}
				}
			}
			parts.push(serialized);
		}
		pendingBlanks = 0;
		afterList = false;
		afterHeading = false;
		hasContent = true;
		i++;
	}

	const body = parts.join("\n");
	return `${preamble}\n\n${body}\n`;
}
