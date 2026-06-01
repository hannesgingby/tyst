export const SOURCE_TYPES = [
	"Article",
	"Book",
	"Chapter",
	"Conference",
	"Report",
	"Thesis",
	"Web",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export interface BibliographySource {
	id: string;
	expanded: boolean;
	type: SourceType;
	title: string;
	authors: string;
	date: string;
	journalName: string;
	volume: string;
	issue: string;
	pageRange: string;
}

let nextSourceId = 1;

export function createBibliographySource(): BibliographySource {
	return {
		id: `source-${nextSourceId++}`,
		expanded: false,
		type: "Article",
		title: "",
		authors: "",
		date: "",
		journalName: "",
		volume: "",
		issue: "",
		pageRange: "",
	};
}
