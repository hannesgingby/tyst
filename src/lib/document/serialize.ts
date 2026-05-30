import type {
	Block,
	DocumentModel,
	FontWeightName,
	ParagraphSettings,
	TypographySettings,
} from "./types";
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

function setCall(name: string, args: string[]): string {
	if (args.length === 0) return "";
	return `#set ${name}(${args.join(", ")})`;
}

/** The document preamble: page, default text and default paragraph set rules. */
function serializePreamble(doc: DocumentModel): string {
	const page = doc.pages[0];

	const pageLines: string[] = [];
	const paperName = TYPST_PAPER_NAME[page.preset];
	if (paperName) {
		pageLines.push(`  paper: "${paperName}",`);
	} else {
		pageLines.push(`  width: ${typstNumber(page.size.width)}pt,`);
		pageLines.push(`  height: ${typstNumber(page.size.height)}pt,`);
	}
	if (page.landscape) pageLines.push(`  flipped: true,`);
	const m = page.margins;
	const marginParts: string[] = [];
	if (m.x != null) marginParts.push(`x: ${typstNumber(m.x)}pt`);
	if (m.y != null) marginParts.push(`y: ${typstNumber(m.y)}pt`);
	marginParts.push(`left: ${typstNumber(m.left)}cm`);
	marginParts.push(`right: ${typstNumber(m.right)}cm`);
	marginParts.push(`top: ${typstNumber(m.top)}cm`);
	marginParts.push(`bottom: ${typstNumber(m.bottom)}cm`);
	pageLines.push(`  margin: (${marginParts.join(", ")}),`);
	pageLines.push(`  fill: ${hexToRgb(page.fill)},`);

	const textRule = `#set text(\n${textArgs(doc.typography)
		.map((l) => `  ${l},`)
		.join("\n")}\n)`;
	const parRule = `#set par(\n${parArgs(doc.typography.leading, doc.paragraph)
		.map((l) => `  ${l},`)
		.join("\n")}\n)`;

	return [`#set page(\n${pageLines.join("\n")}\n)`, textRule, parRule].join("\n\n");
}

/** Serialize a block's text. Each block is a single line (no internal breaks). */
function blockText(block: Block): string {
	return escapeText(block.text);
}

/** Serialize a single block, wrapping it in scoped set rules if it has overrides. */
function serializeBlock(block: Block): string {
	const text = blockText(block);
	const typo = block.typography ?? {};
	const para = block.paragraph ?? {};

	const overrides: string[] = [];
	const tArgs = textArgs(typo);
	if (tArgs.length > 0) overrides.push(setCall("text", tArgs));
	const pArgs = parArgs(typo.leading, para);
	if (pArgs.length > 0) overrides.push(setCall("par", pArgs));

	if (overrides.length === 0) return text;
	return ["#[", ...overrides.map((o) => `  ${o}`), `  ${text}`, "]"].join("\n");
}

/**
 * Serialize the whole document model into a `.typ` source string.
 *
 * The body is a sequence of single-line blocks. Two adjacent non-empty lines
 * are joined by `#linebreak()` (a forced soft break). One or more blank lines
 * between content become a `#parbreak()` (paragraph break) followed by an extra
 * `#linebreak()` for each additional blank line — Typst collapses repeated
 * paragraph breaks, so explicit line breaks are needed to preserve blank space.
 * Leading/trailing blank lines are dropped (Typst ignores them).
 */
export function serializeDocument(doc: DocumentModel): string {
	const preamble = serializePreamble(doc);

	const parts: string[] = [];
	let pendingBlanks = 0;
	let hasContent = false;
	for (const block of doc.blocks) {
		if (block.text === "") {
			if (hasContent) pendingBlanks += 1;
			continue;
		}
		if (hasContent) {
			if (pendingBlanks === 0) {
				parts.push("#linebreak()");
			} else {
				parts.push("#parbreak()");
				for (let k = 1; k < pendingBlanks; k++) parts.push("#linebreak()");
			}
		}
		parts.push(serializeBlock(block));
		pendingBlanks = 0;
		hasContent = true;
	}
	const body = parts.join("\n");

	return `${preamble}\n\n${body}\n`;
}
