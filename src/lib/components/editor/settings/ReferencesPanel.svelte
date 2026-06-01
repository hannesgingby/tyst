<script lang="ts">
	import Button from "$lib/components/ui/Button.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import Switch from "$lib/components/ui/Switch.svelte";
	import BibliographySourceItem from "./BibliographySourceItem.svelte";
	import {
		CITATION_STYLES,
		citationStyleLabel,
		DEFAULT_CITATION_STYLE_ID,
	} from "$lib/document/citationStyles";
	import { documentStore } from "$lib/document/store.svelte";

	const FIELD_BG = "bg-bg-input-on-pure-white";
	const CITATION_STYLE_LABELS = CITATION_STYLES.map((s) => s.label);

	const BIBLIOGRAPHY_TITLE_OPTIONS = ["Your choice", "None"] as const;
	type BibliographyTitleOption = (typeof BIBLIOGRAPHY_TITLE_OPTIONS)[number];

	const bib = $derived(documentStore.bibliographySettings);

	const citationStyleLabelValue = $derived(citationStyleLabel(bib.citationStyleId));

	const bibliographyTitle = $derived<BibliographyTitleOption>(
		bib.titleOption === "none" ? "None" : "Your choice",
	);

	function onCitationStyleLabelChange(label: string): void {
		const style = CITATION_STYLES.find((s) => s.label === label);
		if (style) documentStore.updateBibliographySettings({ citationStyleId: style.id });
	}

	function onTitleOptionChange(option: string): void {
		documentStore.updateBibliographySettings({
			titleOption: option === "None" ? "none" : "your-choice",
		});
	}

	function onFullChange(full: boolean): void {
		documentStore.updateBibliographySettings({ full });
	}
</script>

<div class="flex flex-col gap-1">
	<h1 class="text-2xl leading-[1.2] tracking-[-0.01em] text-text-100">References</h1>
	<p class="text-body-16 text-text-200">Set citation style and add sources</p>
</div>

<!-- Style -->
<section class="mt-12">
	<div class="flex items-center justify-between gap-4">
		<span class="text-body-14 text-text-100">Style</span>
		<DropdownMenu
			class="w-[211px]"
			bg={FIELD_BG}
			value={citationStyleLabelValue}
			options={CITATION_STYLE_LABELS}
			searchable
			searchPlaceholder="Search styles…"
			maxHeightClass="max-h-64"
			onchange={onCitationStyleLabelChange}
		/>
	</div>
</section>

<!-- Sources -->
<section class="mt-16">
	<div class="mb-5 flex items-center justify-between gap-4 border-b border-bg-600 pb-3">
		<span class="text-body-16 text-text-100">Sources</span>
		<Button icon="plus" onclick={() => documentStore.addBibliographySource()}>Add source</Button>
	</div>

	{#if bib.sources.length === 0}
		<p class="py-10 text-center text-body-14 text-text-250">No sources</p>
	{:else}
		<div class="flex flex-col gap-6">
			{#each bib.sources as source, index (source.id)}
				<BibliographySourceItem
					source={bib.sources[index]}
					label="Source {index + 1}"
					onchange={(patch) => documentStore.updateBibliographySource(source.id, patch)}
					onremove={() => documentStore.removeBibliographySource(source.id)}
				/>
			{/each}
		</div>
	{/if}
</section>

<!-- Appearance -->
<section class="mt-16">
	<div class="mb-5 border-b border-bg-600 pb-3">
		<span class="text-body-16 text-text-100">Appearance</span>
	</div>

	<div class="flex flex-col gap-[18px]">
		<div class="flex items-start justify-between gap-4">
			<div class="flex flex-col gap-0.5">
				<span class="text-body-14 text-text-100">Title</span>
				<span class="max-w-[360px] text-body-12 text-text-200">
					The heading for the references section.
				</span>
			</div>
			<DropdownMenu
				class="w-[211px]"
				bg={FIELD_BG}
				value={bibliographyTitle}
				options={BIBLIOGRAPHY_TITLE_OPTIONS}
				onchange={onTitleOptionChange}
			/>
		</div>

		<div class="flex items-start justify-between gap-4">
			<div class="flex flex-col gap-0.5">
				<span class="text-body-14 text-text-100">Full</span>
				<span class="max-w-[360px] text-body-12 text-text-200">
					Whether to include all works from the given bibliography files, even
					those that weren't cited in the document.
				</span>
			</div>
			<Switch checked={bib.full} label="Full bibliography" onchange={onFullChange} />
		</div>
	</div>
</section>
