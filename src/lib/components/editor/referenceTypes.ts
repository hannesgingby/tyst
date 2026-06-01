/** Placeholder types for the reference picker (UI mock only). */

export interface ReferenceItem {
	id: string;
	label: string;
	/** Right-aligned location label, e.g. "Page 2". */
	location: string;
	displayText?: string;
	/** Muted row style (placeholder / unavailable). */
	muted?: boolean;
}

export interface ReferenceSection {
	title: string;
	items: ReferenceItem[];
}

/** Mock document targets — replace with store-driven data later. */
export const MOCK_REFERENCE_SECTIONS: ReferenceSection[] = [
	{ title: "Citation", items: [] },
	{
		title: "Sections",
		items: [
			{ id: "sec-1", label: "Results", location: "Page 1", displayText: "Results" },
			{ id: "sec-2", label: "Introduction", location: "Page 1", displayText: "Introduction" },
			{ id: "sec-3", label: "Test", location: "Page 3", displayText: "Test" },
		],
	},
	{
		title: "Figures",
		items: [
			{ id: "fig-1", label: "Image 1", location: "Page 2", displayText: "Image 1" },
			{ id: "fig-2", label: "Image 2", location: "Page 4", displayText: "Image 2" },
			{ id: "fig-3", label: "Image 3", location: "Page 5", displayText: "Image 3" },
		],
	},
];
