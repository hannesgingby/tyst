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

/**
 * Serialize a block's text, escaping markup and turning each soft `\n` into an
 * explicit `#linebreak()`. Explicit breaks are used (instead of a trailing `\`)
 * because Typst collapses repeated markup line breaks, whereas `linebreak()`
 * calls are always preserved.
 */
function blockText(block: Block): string {
	return block.text
		.split("\n")
		.map(escapeText)
		.join("#linebreak()\n");
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

/** Serialize the whole document model into a `.typ` source string. */
export function serializeDocument(doc: DocumentModel): string {
	const preamble = serializePreamble(doc);

	// Typst collapses consecutive paragraph breaks, so only the first break after
	// real content becomes a `#parbreak()`; further blank lines (empty blocks)
	// become `#linebreak()`, which Typst preserves.
	const parts: string[] = [];
	doc.blocks.forEach((block, i) => {
		if (i > 0) {
			const prevEmpty = doc.blocks[i - 1].text === "";
			parts.push(prevEmpty ? "#linebreak()" : "#parbreak()");
		}
		if (block.text !== "") parts.push(serializeBlock(block));
	});
	const body = parts.join("\n");

	return `${preamble}\n\n${body}\n`;
}
