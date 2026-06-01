import type { DocumentMetadata, DocumentMetadataDateMode } from "./types";

export const DEFAULT_DOCUMENT_METADATA: DocumentMetadata = {
	title: "",
	authors: [],
	description: "",
	keywords: [],
	dateMode: "auto",
	date: "",
};

export function normalizeDocumentMetadata(
	meta: Partial<DocumentMetadata> | undefined,
): DocumentMetadata {
	return { ...DEFAULT_DOCUMENT_METADATA, ...meta };
}

export function parseCommaSeparatedList(value: string): string[] {
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

export function formatCommaSeparatedList(items: string[]): string {
	return items.join(", ");
}

/** Parse `yyyy`, `yyyy-mm`, or `yyyy-mm-dd` (month/day default to 1). */
export function parseDocumentDate(
	value: string,
): { year: number; month: number; day: number } | null {
	const t = value.trim();
	if (!t) return null;
	const match = t.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
	if (!match) return null;
	const year = Number(match[1]);
	const month = match[2] ? Number(match[2]) : 1;
	const day = match[3] ? Number(match[3]) : 1;
	if (!Number.isFinite(year) || year < 0) return null;
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	return { year, month, day };
}

export const DOCUMENT_DATE_MODE_LABELS: Record<DocumentMetadataDateMode, string> = {
	auto: "Auto",
	custom: "Custom",
};

export function documentDateModeFromLabel(label: string): DocumentMetadataDateMode {
	return label === "Custom" ? "custom" : "auto";
}
