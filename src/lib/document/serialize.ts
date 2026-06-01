import type {
	BibliographySettings,
	Block,
	BlockSpacing,
	CitationSettings,
	DocumentModel,
	FontWeightName,
	HeadingLevel,
	HeadingSettings,
	HorizontalAlignment,
	ImageSettings,
	LineSettings,
	ListSettings,
	Margins,
	FootnotePageSettings,
	OutlineSettings,
	PageSettings,
	ParagraphSettings,
	RectSettings,
	ReferenceSettings,
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
import { typstNumber } from "./units";

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
	if (t.italic) lines.push(`style: "italic"`);
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
	if (p.firstLineIndent != null)
		lines.push(`first-line-indent: ${typstNumber(p.firstLineIndent)}pt`);
	if (p.hangingIndent) lines.push(`hanging-indent: ${typstNumber(p.hangingIndent)}pt`);
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

/** Serialize zone blocks (header/footer) into a Typst `context [...]` expression. */
function serializeZoneBlocks(blocks: Block[]): string {
	if (blocks.length === 0) return "";
	const parts: string[] = [];
	for (const b of blocks) {
		if (b.pageCounter) {
			const p = b.pageCounter.pattern;
			const needsBoth = p.length > 1;
			parts.push(needsBoth
				? `#counter(page).display("${p}", both: true)`
				: `#counter(page).display("${p}")`);
		} else if (b.hSpacing) {
			const { value, unit } = b.hSpacing.amount;
			const args = [`${typstNumber(value)}${unit}`];
			if (b.hSpacing.weak) args.push("weak: true");
			parts.push(`#h(${args.join(", ")})`);
		} else if (b.text) {
			parts.push(escapeText(b.text));
		}
	}
	if (parts.length === 0) return "";
	return `context [${parts.join("")}]`;
}

/** Serialize a full #set page(...) call for a given PageSettings. */
function serializePageSetFull(page: PageSettings, numbering?: string, headerContent?: string, footerContent?: string, headerAscent?: string): string {
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
	if (numbering) lines.push(`  numbering: "${numbering}",`);
	if (headerContent) {
		lines.push(`  header: ${headerContent},`);
		if (headerAscent) lines.push(`  header-ascent: ${headerAscent},`);
	}
	if (footerContent) {
		lines.push(`  footer: ${footerContent},`);
	}
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
function serializePreamble(doc: DocumentModel, hasPageFormRef = false): string {
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

	const blockIndexById = new Map(doc.blocks.map((b, idx) => [b.id, idx]));
	const headerBlocks = doc.blocks.filter((b) => b.zoneKind === "header");
	const footerBlocks = doc.blocks.filter((b) => b.zoneKind === "footer");
	const headerContent = serializeZoneBlocks(headerBlocks) || undefined;
	const footerContent = serializeZoneBlocks(footerBlocks) || undefined;
	const parts = [serializePageSetFull(doc.pages[0], hasPageFormRef ? "1" : undefined, headerContent, footerContent, doc.headerAscent), textRule, parRule];
	if (headingRule) parts.push(headingRule);
	parts.push(...serializeFootnotePageRules(doc, 0, blockIndexById, []));

	// Per-level heading typography: #show heading.where(level: N): set text(…)
	for (let n = 1; n <= 4; n++) {
		const level = n as HeadingLevel;
		const scale = doc.headingScale?.[level];
		const lvlTypo = doc.headingTypography?.[level] ?? {};
		const { size: _s, underline: _u, leading: _l, ...textTypo } = lvlTypo;
		const args: string[] = [];
		if (scale !== undefined) args.push(`size: ${typstNumber(scale)}em`);
		args.push(...textArgs(textTypo));
		if (args.length > 0) {
			parts.push(`#show heading.where(level: ${n}): set text(${args.join(", ")})`);
		}
	}

	// Footnote body typography: #show footnote.entry: set text(…)
	if (doc.footnoteTypography && Object.keys(doc.footnoteTypography).length > 0) {
		const { underline: _u, leading: _l, ...textTypo } = doc.footnoteTypography;
		const tArgs = textArgs(textTypo);
		if (tArgs.length > 0) {
			parts.push(`#show footnote.entry: set text(${tArgs.join(", ")})`);
		}
	}

	return parts.join("\n\n");
}

/** Wrap `content` in `#block(above:, below:)[…]` for explicit element spacing. */
function wrapBlock(content: string, spacing: BlockSpacing): string {
	return `#block(above: ${typstNumber(spacing.above)}em, below: ${typstNumber(spacing.below)}em)[${content}]`;
}

/** Default above/below for embed blocks when the user hasn't unlinked spacing. */
const EMBED_SPACING_DEFAULT: BlockSpacing = { above: 1.2, below: 0.35 };

const FOOTNOTE_DEFAULT: FootnotePageSettings = {
	numbering: "1",
	clearance: 1,
	gap: 0.5,
	indent: 1,
};

/** Typst default `footnote.entry(separator: …)`. */
const FOOTNOTE_SEPARATOR_TYPST = "line(length: 30% + 0pt, stroke: 0.5pt)";

function resolveFootnotePageSettings(
	doc: DocumentModel,
	pageIndex: number,
): FootnotePageSettings {
	const def = doc.pages[0]?.footnote ?? FOOTNOTE_DEFAULT;
	const page = doc.pages[pageIndex];
	if (!page || pageIndex === 0) return page?.footnote ?? def;
	if (page.footnoteLinked !== false) return def;
	return page.footnote ?? def;
}

function blockPageIndexFromBreaks(
	blockId: string,
	blockIndexById: Map<string, number>,
	pageBreakBlockIds: string[],
): number {
	const idx = blockIndexById.get(blockId) ?? 0;
	let page = 0;
	for (const breakId of pageBreakBlockIds) {
		if ((blockIndexById.get(breakId) ?? 0) <= idx) page += 1;
	}
	return page;
}

function findFootnoteSeparatorOnPage(
	doc: DocumentModel,
	pageIndex: number,
	blockIndexById: Map<string, number>,
	pageBreakBlockIds: string[],
): Block | undefined {
	return doc.blocks.find(
		(b) =>
			b.footnoteSeparator &&
			b.line &&
			blockPageIndexFromBreaks(b.id, blockIndexById, pageBreakBlockIds) === pageIndex,
	);
}

function serializeFootnotePageRules(
	doc: DocumentModel,
	pageIndex: number,
	blockIndexById: Map<string, number>,
	pageBreakBlockIds: string[],
): string[] {
	const settings = resolveFootnotePageSettings(doc, pageIndex);
	const separator = findFootnoteSeparatorOnPage(
		doc,
		pageIndex,
		blockIndexById,
		pageBreakBlockIds,
	);
	// Inside #set function args, Typst is in code mode — use a bare call, not #line(...).
	const separatorTypst = separator?.line
		? lineCallExpr(separator.line)
		: FOOTNOTE_SEPARATOR_TYPST;
	return [
		`#set footnote(numbering: "${settings.numbering}")`,
		`#set footnote.entry(separator: ${separatorTypst}, clearance: ${typstNumber(settings.clearance)}em, gap: ${typstNumber(settings.gap)}em, indent: ${typstNumber(settings.indent)}em)`,
	];
}

function findFootnoteBody(doc: DocumentModel, footnoteId: string): Block | undefined {
	return doc.blocks.find((b) => b.footnote?.footnoteId === footnoteId);
}

/** Filesystem-safe slug derived from the document name. Mirrors files.ts. */
function imagesFolderFor(doc: DocumentModel): string {
	const base =
		doc.name.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_") ||
		"document";
	return `${base}_files`;
}

/** Typst label identifier for a block, used for cross-references. */
function labelFor(blockId: string): string {
	return `ref-${blockId}`;
}

/** Serialize a reference chip block to Typst markup. */
function serializeReference(ref: ReferenceSettings): string {
	const label = labelFor(ref.targetBlockId);
	if (ref.pageForm) {
		const args: string[] = [`<${label}>`, `form: "page"`];
		if (ref.displayText) args.splice(1, 0, `supplement: [${escapeText(ref.displayText)}]`);
		return `#ref(${args.join(", ")})`;
	}
	if (ref.displayText) return `@${label}[${escapeText(ref.displayText)}]`;
	return `@${label}`;
}

/** Serialize a citation chip block to Typst markup. */
function serializeCitation(cit: CitationSettings): string {
	if (cit.supplement) return `@${cit.sourceId}[${escapeText(cit.supplement)}]`;
	return `@${cit.sourceId}`;
}

/** Serialize the bibliography block to a Typst `#bibliography(...)` call. */
function serializeBibliography(doc: DocumentModel, block: Block, bib: BibliographySettings): string {
	const folder = imagesFolderFor(doc);
	const args: string[] = [`"${folder}/sources.yaml"`];
	if (bib.titleOption === "none") {
		args.push(`title: none`);
	} else if (block.text.trim()) {
		args.push(`title: "${escapeStringLiteral(block.text.trim())}"`);
	}
	args.push(`style: "${bib.citationStyleId}"`);
	if (bib.full) args.push(`full: true`);
	return `#bibliography(${args.join(", ")})`;
}

/**
 * Generate a Hayagriva YAML string for all bibliography sources.
 * Returns null if there are no sources.
 */
export function serializeSourcesYaml(doc: DocumentModel): string | null {
	const sources = doc.bibliography?.sources;
	if (!sources || sources.length === 0) return null;
	const lines: string[] = [];
	for (const s of sources) {
		lines.push(`${s.id}:`);
		lines.push(`  type: ${s.type.toLowerCase()}`);
		if (s.title) lines.push(`  title: "${s.title.replace(/"/g, '\\"')}"`);
		if (s.authors) lines.push(`  author: "${s.authors.replace(/"/g, '\\"')}"`);
		if (s.date) lines.push(`  date: ${s.date}`);
		if (s.journalName) {
			lines.push(`  journal:`);
			lines.push(`    name: "${s.journalName.replace(/"/g, '\\"')}"`);
		}
		if (s.volume) lines.push(`    volume: ${s.volume}`);
		if (s.issue) lines.push(`    issue: ${s.issue}`);
		if (s.pageRange) lines.push(`  page-range: "${s.pageRange}"`);
		lines.push(``);
	}
	return lines.join("\n");
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

function serializeImage(doc: DocumentModel, block: Block, image: ImageSettings, labeled = false): string {
	const path = escapeStringLiteral(imageRelativePath(doc, block.id, image));
	const args: string[] = [`"${path}"`];
	if (image.width != null) args.push(`width: ${typstNumber(image.width)}pt`);
	if (image.height != null) args.push(`height: ${typstNumber(image.height)}pt`);
	if (image.alt) args.push(`alt: "${escapeStringLiteral(image.alt)}"`);
	if (image.fit) args.push(`fit: "${image.fit}"`);
	const label = labeled ? ` <${labelFor(block.id)}>` : "";
	return `#figure(image(${args.join(", ")}))${label}`;
}

function lineCallExpr(line: LineSettings): string {
	const args: string[] = [
		`start: (${typstNumber(line.startX)}pt, ${typstNumber(line.startY)}pt)`,
		line.lengthUnit === "%"
			? `length: ${typstNumber(line.length)}%`
			: `length: ${typstNumber(line.length)}pt`,
		`angle: ${typstNumber(line.angle)}deg`,
		`stroke: ${strokeArg(line.stroke)}`,
	];
	return `line(${args.join(", ")})`;
}

function serializeLine(line: LineSettings): string {
	return `#${lineCallExpr(line)}`;
}

function serializeRect(rect: RectSettings): string {
	const args: string[] = [];
	if (rect.width != null) args.push(`width: ${typstNumber(rect.width)}pt`);
	if (rect.height != null) args.push(`height: ${typstNumber(rect.height)}pt`);
	if (rect.fillEnabled) args.push(`fill: ${hexToRgb(rect.fillColor)}`);
	if (rect.radius > 0) args.push(`radius: ${typstNumber(rect.radius)}pt`);
	if (rect.inset !== 5) args.push(`inset: ${typstNumber(rect.inset)}pt`);
	args.push(`stroke: ${strokeArg(rect.stroke)}`);
	return `#rect(${args.join(", ")})`;
}

function serializeOutline(doc: DocumentModel, block: Block, outline: OutlineSettings): string {
	const args: string[] = [];
	const title = block.text.trim();
	if (title) {
		const scale = doc.outlineTitleScale;
		const { size: _s, underline: _u, leading: _l, ...ctxTypo } = doc.outlineTitleTypography ?? {};
		const { size: blockSizePt, underline: _bu, leading: _bl, ...blockOther } = block.typography ?? {};
		const styleArgs: string[] = [];
		if (blockSizePt !== undefined) styleArgs.push(`size: ${typstNumber(blockSizePt)}pt`);
		else if (scale !== undefined) styleArgs.push(`size: ${typstNumber(scale)}em`);
		styleArgs.push(...textArgs({ ...ctxTypo, ...blockOther }));
		if (styleArgs.length > 0) {
			args.push(`title: [#set text(${styleArgs.join(", ")})\n  ${escapeText(block.text)}]`);
		} else {
			args.push(`title: [${escapeText(block.text)}]`);
		}
	}
	if (outline.target && outline.target.trim() && outline.target.trim() !== "heading") {
		args.push(`target: ${outline.target.trim()}`);
	}
	if (outline.depth != null) args.push(`depth: ${outline.depth}`);
	if (outline.indent != null) args.push(`indent: ${typstNumber(outline.indent)}pt`);
	return args.length > 0 ? `#outline(${args.join(", ")})` : `#outline()`;
}

function serializeEmbed(doc: DocumentModel, block: Block, labeled = false): string | null {
	if (block.image) return serializeImage(doc, block, block.image, labeled);
	if (block.line) return serializeLine(block.line);
	if (block.rect) return serializeRect(block.rect);
	if (block.outline) return serializeOutline(doc, block, block.outline);
	return null;
}

/** Wrap `content` in `#align(...)[…]` when alignment is set and non-default. */
function wrapAligned(content: string, alignment: HorizontalAlignment | undefined): string {
	if (!alignment || alignment === "left") return content;
	return `#align(${alignment})[${content}]`;
}

/** Title (level 0) → styled #text; headings 1-4 → #heading(level: N, …). */
function serializeHeading(block: Block, heading: HeadingSettings, doc: DocumentModel, labeled = false): string {
	const text = escapeText(block.text);
	if (heading.level === 0) {
		// Title isn't a heading in Typst's model. Render as bold, oversized text.
		const scale = doc.titleScale ?? 2.0;
		const { size: _s, underline: _u, leading: _l, ...ctxTypo } = doc.titleTypography ?? {};
		const { size: blockSizePt, underline: _bu, leading: _bl, ...blockOther } = block.typography ?? {};
		const sizeArg = blockSizePt !== undefined
			? `size: ${typstNumber(blockSizePt)}pt`
			: `size: ${typstNumber(scale)}em`;
		const args = [sizeArg, `weight: "bold"`, ...textArgs({ ...ctxTypo, ...blockOther })];
		return `#text(${args.join(", ")})[${text}]`;
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
	const label = labeled ? ` <${labelFor(block.id)}>` : "";
	return `#heading(${args.join(", ")})[${text}]${label}`;
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
function serializeTextBlock(
	block: Block,
	docTypo: TypographySettings,
	doc: DocumentModel,
): string {
	if (block.footnoteMarker) {
		const body = findFootnoteBody(doc, block.footnoteMarker.footnoteId);
		return `#footnote[${escapeText(body?.text ?? "")}]`;
	}

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
		// underline is not a text() arg — handle separately
		const underlineChanged = (typo.underline ?? false) !== (docTypo.underline ?? false);
		const { underline: _u, ...textDiffTypo } = diffTypo;
		const tArgs = textArgs(textDiffTypo);
		let result = text;
		if (tArgs.length > 0) result = `#text(${tArgs.join(", ")})[${result}]`;
		if (underlineChanged) result = `#underline[${result}]`;
		if (!underlineChanged && tArgs.length === 0) return text;
		return result;
	}

	const underline = typo.underline === true;
	const overrides: string[] = [];
	const tArgs = textArgs(typo);
	if (tArgs.length > 0) overrides.push(`#set text(${tArgs.join(", ")})`);
	// Only emit par args that actually differ from the global document defaults.
	const docPara = doc.paragraph;
	const paraDiff: Partial<ParagraphSettings> = {};
	for (const k of Object.keys(para) as (keyof ParagraphSettings)[]) {
		if (para[k] !== docPara[k]) (paraDiff as Record<string, unknown>)[k] = para[k];
	}
	const leadingForPar =
		typo.leading !== undefined && typo.leading !== docTypo.leading ? typo.leading : undefined;
	const pArgs = parArgs(leadingForPar, paraDiff);
	if (pArgs.length > 0) overrides.push(`#set par(${pArgs.join(", ")})`);

	if (overrides.length === 0 && !underline) return text;

	const content = underline ? `#underline[${text}]` : text;
	if (overrides.length === 0) return content;
	return ["#[", ...overrides.map((o) => `  ${o}`), `  ${content}`, "]"].join("\n");
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
	const hasPageFormRef = doc.blocks.some(b => b.reference?.pageForm);
	const preamble = serializePreamble(doc, hasPageFormRef);

	// Collect block IDs that are referenced so we can add Typst labels to them.
	const referencedBlockIds = new Set(
		doc.blocks
			.filter(b => b.reference)
			.map(b => b.reference!.targetBlockId),
	);

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

	const blockIndexById = new Map(doc.blocks.map((b, idx) => [b.id, idx]));

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
		parts.push(
			...serializeFootnotePageRules(
				doc,
				nextPageIdx,
				blockIndexById,
				pageBreakBlockIds,
			),
		);
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

		if (block.zoneKind || block.footnote || block.footnoteSeparator || block.pageBreak) {
			i++;
			continue;
		}

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
			// One `#linebreak()` per Enter the user pressed before this block,
			// so each editor blank shows up distinctly in the source.
			for (let k = 0; k < pendingBlanks; k++) parts.push("#linebreak()");
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
			for (let k = 0; k < pendingBlanks; k++) parts.push("#linebreak()");
			const labeled = referencedBlockIds.has(block.id);
			const headingContent = serializeHeading(block, block.heading, doc, labeled);
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
		const embed = serializeEmbed(doc, block, referencedBlockIds.has(block.id));
		if (embed) {
			if (hasContent) parts.push("");
			for (let k = 0; k < pendingBlanks; k++) parts.push("#linebreak()");
			const sharedKey:
				| "imageSpacingShared"
				| "lineSpacingShared"
				| "rectSpacingShared"
				| "outlineSpacingShared" = block.image
				? "imageSpacingShared"
				: block.line
					? "lineSpacingShared"
					: block.rect
						? "rectSpacingShared"
						: "outlineSpacingShared";
			const ownSpacing =
				block.image?.spacing ?? block.line?.spacing ?? block.rect?.spacing ?? block.outline?.spacing;
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

		// ── Vertical spacing ────────────────────────────────────────────────────
		if (block.vSpacing) {
			if (hasContent) parts.push("");
			for (let k = 0; k < pendingBlanks; k++) parts.push("#linebreak()");
			const { value, unit } = block.vSpacing.amount;
			const args = [`${typstNumber(value)}${unit}`];
			if (block.vSpacing.weak) args.push("weak: true");
			parts.push(`#v(${args.join(", ")})`);
			hasContent = true;
			afterList = false;
			afterHeading = true;
			pendingBlanks = 0;
			i++;
			continue;
		}

		// ── Horizontal spacing (inline continuation) ────────────────────────────
		if (block.hSpacing) {
			const { value, unit } = block.hSpacing.amount;
			const args = [`${typstNumber(value)}${unit}`];
			if (block.hSpacing.weak) args.push("weak: true");
			const serialized = `#h(${args.join(", ")})`;
			if (hasContent && block.continuation) {
				parts[parts.length - 1] += serialized;
			} else {
				if (hasContent) parts.push("");
				parts.push(serialized);
				hasContent = true;
			}
			pendingBlanks = 0;
			i++;
			continue;
		}

		// ── Inline reference chip ───────────────────────────────────────────────
		if (block.reference) {
			const serialized = serializeReference(block.reference);
			if (hasContent && block.continuation) {
				parts[parts.length - 1] += serialized;
			} else {
				if (hasContent) parts.push("");
				parts.push(serialized);
				hasContent = true;
			}
			pendingBlanks = 0;
			i++;
			continue;
		}

		// ── Inline citation chip ────────────────────────────────────────────────
		if (block.citation) {
			const serialized = serializeCitation(block.citation);
			if (hasContent && block.continuation) {
				parts[parts.length - 1] += serialized;
			} else {
				if (hasContent) parts.push("");
				parts.push(serialized);
				hasContent = true;
			}
			pendingBlanks = 0;
			i++;
			continue;
		}

		// ── Bibliography block ──────────────────────────────────────────────────
		if (block.bibliography) {
			const bib = doc.bibliography;
			if (bib) {
				if (hasContent) parts.push("");
				for (let k = 0; k < pendingBlanks; k++) parts.push("#linebreak()");
				parts.push(serializeBibliography(doc, block, bib));
				hasContent = true;
				afterList = false;
				afterHeading = true;
				pendingBlanks = 0;
			}
			i++;
			continue;
		}

		// ── Blank block (paragraph-break placeholder) ───────────────────────────
		// footnoteMarker blocks intentionally have text:"" but must not be skipped here —
		// they serialize to #footnote[...] via serializeTextBlock.
		if (block.text === "" && !block.footnoteMarker) {
			if (hasContent && !block.continuation) pendingBlanks += 1;
			i++;
			continue;
		}

		// ── Plain content block ─────────────────────────────────────────────────
		const serialized = wrapAligned(
			serializeTextBlock(block, doc.typography, doc),
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
