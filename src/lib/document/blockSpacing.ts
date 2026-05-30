import type { BlockSpacing, DocumentModel, HeadingLevel, ListKind } from "./types";

export function isHeadingSpacingLinked(
	doc: DocumentModel,
	level: 0 | HeadingLevel,
): boolean {
	return doc.headingSpacingLinks?.[level] ?? true;
}

export function resolveHeadingSpacing(
	doc: DocumentModel,
	level: 0 | HeadingLevel,
): BlockSpacing | undefined {
	if (!isHeadingSpacingLinked(doc, level)) {
		return doc.headingSpacing?.[level];
	}
	return doc.headingSpacingShared ?? doc.headingSpacing?.[level];
}

export function isListSpacingLinked(doc: DocumentModel, kind: ListKind): boolean {
	return doc.listSpacingLinks?.[kind] ?? true;
}

export function resolveListSpacing(
	doc: DocumentModel,
	kind: ListKind,
): BlockSpacing | undefined {
	if (!isListSpacingLinked(doc, kind)) {
		return doc.listSpacing?.[kind];
	}
	return doc.listSpacingShared ?? doc.listSpacing?.[kind];
}
