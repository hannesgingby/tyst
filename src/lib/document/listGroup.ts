import type { Block, DocumentModel, ListKind } from "./types";

/** Contiguous list items with the same `kind`, stopping at page breaks. */
export function listGroupBlockIds(
	doc: DocumentModel,
	blockId: string,
	pageBreakBlockIds: string[] = [],
): string[] {
	const index = doc.blocks.findIndex((b) => b.id === blockId);
	if (index < 0) return [];
	const block = doc.blocks[index];
	if (!block.list) return [blockId];

	const kind = block.list.kind;
	const pageBreakSet = new Set(pageBreakBlockIds);
	const ids: string[] = [];

	let i = index;
	while (i > 0) {
		const curr = doc.blocks[i];
		const prev = doc.blocks[i - 1];
		if (prev.list?.kind !== kind) break;
		if (pageBreakSet.has(curr.id)) break;
		i--;
	}
	while (i < doc.blocks.length) {
		const curr = doc.blocks[i];
		if (curr.list?.kind !== kind) break;
		if (ids.length > 0 && pageBreakSet.has(curr.id)) break;
		ids.push(curr.id);
		i++;
	}
	return ids;
}

export function listGroupFirstBlock(
	doc: DocumentModel,
	block: Block,
	pageBreakBlockIds: string[] = [],
): Block | null {
	if (!block.list) return null;
	const ids = listGroupBlockIds(doc, block.id, pageBreakBlockIds);
	if (ids.length === 0) return block;
	return doc.blocks.find((b) => b.id === ids[0]) ?? block;
}

export function listGroupKind(
	doc: DocumentModel,
	block: Block,
	pageBreakBlockIds: string[] = [],
): ListKind | null {
	return listGroupFirstBlock(doc, block, pageBreakBlockIds)?.list?.kind ?? null;
}
