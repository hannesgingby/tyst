import type { BlockSpacing, DocumentModel, HeadingLevel, ListKind } from "./types";

/**
 * Heading/list spacing is scoped per level (or per kind) — each one keeps its
 * own document-default value. The legacy `*SpacingShared` field is only
 * consulted as a last-resort fallback when no per-level / per-kind value has
 * been recorded yet.
 */
export function isHeadingSpacingLinked(
	_doc: DocumentModel,
	_level: 0 | HeadingLevel,
): boolean {
	// Levels no longer participate in a shared bucket; the link tag is now
	// purely a per-block-override indicator handled by the store.
	return true;
}

export function resolveHeadingSpacing(
	doc: DocumentModel,
	level: 0 | HeadingLevel,
): BlockSpacing | undefined {
	return doc.headingSpacing?.[level] ?? doc.headingSpacingShared;
}

export function isListSpacingLinked(_doc: DocumentModel, _kind: ListKind): boolean {
	return true;
}

export function resolveListSpacing(
	doc: DocumentModel,
	kind: ListKind,
): BlockSpacing | undefined {
	return doc.listSpacing?.[kind] ?? doc.listSpacingShared;
}
