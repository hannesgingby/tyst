<script lang="ts">
	import Button from "$lib/components/ui/Button.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import Switch from "$lib/components/ui/Switch.svelte";
	import BibliographySourceItem from "./BibliographySourceItem.svelte";
	import {
		createBibliographySource,
		type BibliographySource,
	} from "$lib/document/bibliographySource";
	import {
		CITATION_STYLES,
		citationStyleLabel,
		DEFAULT_CITATION_STYLE_ID,
	} from "$lib/document/citationStyles";

	const FIELD_BG = "bg-bg-input-on-pure-white";
	const CITATION_STYLE_LABELS = CITATION_STYLES.map((s) => s.label);

	const BIBLIOGRAPHY_TITLE_OPTIONS = ["Auto", "None"] as const;
	type BibliographyTitleOption = (typeof BIBLIOGRAPHY_TITLE_OPTIONS)[number];

	let citationStyleId = $state(DEFAULT_CITATION_STYLE_ID);
	let citationStyleLabelValue = $state(
		citationStyleLabel(DEFAULT_CITATION_STYLE_ID),
	);
	let sources = $state<BibliographySource[]>([]);
	let bibliographyTitle = $state<BibliographyTitleOption>("Auto");
	let bibliographyFull = $state(false);

	function addSource(): void {
		sources = [...sources, createBibliographySource()];
	}

	function removeSource(id: string): void {
		sources = sources.filter((s) => s.id !== id);
	}

	function onCitationStyleLabelChange(label: string): void {
		citationStyleLabelValue = label;
		const style = CITATION_STYLES.find((s) => s.label === label);
		if (style) citationStyleId = style.id;
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
			bind:value={citationStyleLabelValue}
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
		<Button icon="plus" onclick={addSource}>Add source</Button>
	</div>

	{#if sources.length === 0}
		<p class="py-10 text-center text-body-14 text-text-250">No sources</p>
	{:else}
		<div class="flex flex-col gap-6">
			{#each sources as source, index (source.id)}
				<BibliographySourceItem
					bind:source={sources[index]}
					label="Source {index + 1}"
					onremove={() => removeSource(source.id)}
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
				bind:value={bibliographyTitle}
				options={BIBLIOGRAPHY_TITLE_OPTIONS}
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
			<Switch bind:checked={bibliographyFull} label="Full bibliography" />
		</div>
	</div>
</section>
