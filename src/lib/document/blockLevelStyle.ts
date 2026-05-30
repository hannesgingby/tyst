import { resolveHeadingSpacing, resolveListSpacing } from "./blockSpacing";
import { listGroupFirstBlock } from "./listGroup";
import { resolveHeadingLevelStyle } from "./headingStyle";
import type {
	Block,
	BlockSpacing,
	DocumentModel,
	HeadingLevel,
	HeadingNumberingSettings,
} from "./types";

export function hasBlockHeadingNumberingOverride(block: Block): boolean {
	return !!block.headingNumbering && Object.keys(block.headingNumbering).length > 0;
}

export function resolveBlockHeadingNumbering(
	doc: DocumentModel,
	block: Block,
): HeadingNumberingSettings | undefined {
	const heading = block.heading;
	if (!heading || heading.level === 0) return undefined;
	const level = heading.level as HeadingLevel;
	const docStyle = resolveHeadingLevelStyle(doc, level);
	if (hasBlockHeadingNumberingOverride(block)) {
		return { ...docStyle, ...block.headingNumbering };
	}
	return docStyle;
}

export function hasBlockHeadingSpacingOverride(block: Block): boolean {
	return block.headingSpacing != null;
}

export function resolveBlockHeadingSpacing(
	doc: DocumentModel,
	block: Block,
): BlockSpacing | undefined {
	if (block.headingSpacing) return block.headingSpacing;
	const level = block.heading?.level;
	if (level === undefined) return undefined;
	return resolveHeadingSpacing(doc, level as 0 | HeadingLevel);
}

export function hasBlockListSpacingOverride(
	doc: DocumentModel,
	block: Block,
	pageBreakBlockIds: string[] = [],
): boolean {
	const first = listGroupFirstBlock(doc, block, pageBreakBlockIds);
	return first?.listSpacing != null;
}

export function resolveBlockListSpacing(
	doc: DocumentModel,
	block: Block,
	pageBreakBlockIds: string[] = [],
): BlockSpacing | undefined {
	const first = listGroupFirstBlock(doc, block, pageBreakBlockIds);
	if (!first?.list) return undefined;
	if (first.listSpacing) return first.listSpacing;
	return resolveListSpacing(doc, first.list.kind);
}
