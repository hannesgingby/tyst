export type { BibliographySource, SourceType } from "./types";
export { SOURCE_TYPES } from "./types";

import type { BibliographySource } from "./types";

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
