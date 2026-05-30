import type {
	DocumentModel,
	HeadingLevel,
	HeadingLinks,
	HeadingNumberingSettings,
} from "./types";

const DEFAULT_LINKS: HeadingLinks = { 1: true, 2: true, 3: true, 4: true };

/** Resolved numbering/outlined for a heading level (1–4). */
export function resolveHeadingLevelStyle(
	doc: DocumentModel,
	level: HeadingLevel,
): HeadingNumberingSettings {
	const defaults = doc.headings ?? { outlined: true };
	const links = doc.headingLinks ?? DEFAULT_LINKS;
	if (links[level]) return defaults;
	return { ...defaults, ...doc.headingLevels?.[level] };
}

export function isHeadingLevelLinked(doc: DocumentModel, level: HeadingLevel): boolean {
	return (doc.headingLinks ?? DEFAULT_LINKS)[level];
}
