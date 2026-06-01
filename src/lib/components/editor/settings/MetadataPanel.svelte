<script lang="ts">
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import {
		DOCUMENT_DATE_MODE_LABELS,
		documentDateModeFromLabel,
		formatCommaSeparatedList,
		parseCommaSeparatedList,
	} from "$lib/document/metadata";
	import { documentStore } from "$lib/document/store.svelte";

	const FIELD_BG = "bg-bg-input-on-pure-white";
	const FIELD_CLASS =
		"field-shell h-9 w-[211px] border-none px-3 text-body-14-tight text-text-100 outline-none placeholder:text-text-250";
	const DATE_MODE_OPTIONS = ["Auto", "Custom"] as const;

	const meta = $derived(documentStore.model.metadata);

	const authorsText = $derived(formatCommaSeparatedList(meta.authors));
	const keywordsText = $derived(formatCommaSeparatedList(meta.keywords));
	const dateModeLabel = $derived(DOCUMENT_DATE_MODE_LABELS[meta.dateMode]);
</script>

<div class="flex flex-col gap-1">
	<h1 class="text-2xl leading-[1.2] tracking-[-0.01em] text-text-100">Metadata</h1>
	<p class="text-body-16 text-text-200">Specify metadata for the document</p>
</div>

<section class="mt-12">
	<div class="mb-5 border-b border-bg-600 pb-3">
		<span class="text-body-16 text-text-100">Document</span>
	</div>

	<div class="flex flex-col gap-[18px]">
		<div class="flex items-center justify-between gap-4">
			<span class="text-body-14 text-text-100">Title</span>
			<input
				type="text"
				class="{FIELD_CLASS} {FIELD_BG}"
				value={meta.title}
				oninput={(e) =>
					documentStore.updateMetadata({
						title: (e.currentTarget as HTMLInputElement).value,
					})}
				placeholder="None"
				spellcheck="false"
				autocomplete="off"
			/>
		</div>

		<div class="flex items-center justify-between gap-4">
			<span class="text-body-14 text-text-100">Author</span>
			<input
				type="text"
				class="{FIELD_CLASS} {FIELD_BG}"
				value={authorsText}
				oninput={(e) =>
					documentStore.updateMetadata({
						authors: parseCommaSeparatedList(
							(e.currentTarget as HTMLInputElement).value,
						),
					})}
				placeholder="Jane Doe, John Smith"
				spellcheck="false"
				autocomplete="off"
			/>
		</div>

		<div class="flex items-center justify-between gap-4">
			<span class="text-body-14 text-text-100">Description</span>
			<input
				type="text"
				class="{FIELD_CLASS} {FIELD_BG}"
				value={meta.description}
				oninput={(e) =>
					documentStore.updateMetadata({
						description: (e.currentTarget as HTMLInputElement).value,
					})}
				placeholder="None"
				spellcheck="false"
				autocomplete="off"
			/>
		</div>

		<div class="flex items-center justify-between gap-4">
			<span class="text-body-14 text-text-100">Keywords</span>
			<input
				type="text"
				class="{FIELD_CLASS} {FIELD_BG}"
				value={keywordsText}
				oninput={(e) =>
					documentStore.updateMetadata({
						keywords: parseCommaSeparatedList(
							(e.currentTarget as HTMLInputElement).value,
						),
					})}
				placeholder="keyword, another keyword"
				spellcheck="false"
				autocomplete="off"
			/>
		</div>

		<div class="flex items-center justify-between gap-4">
			<span class="text-body-14 text-text-100">Date</span>
			<div class="flex w-[211px] flex-col gap-2">
				<DropdownMenu
					class="w-full"
					bg={FIELD_BG}
					value={dateModeLabel}
					options={[...DATE_MODE_OPTIONS]}
					onchange={(label: string) =>
						documentStore.updateMetadata({
							dateMode: documentDateModeFromLabel(label),
						})}
				/>
				{#if meta.dateMode === "custom"}
					<input
						type="text"
						class="{FIELD_CLASS} {FIELD_BG} w-full"
						value={meta.date}
						oninput={(e) =>
							documentStore.updateMetadata({
								date: (e.currentTarget as HTMLInputElement).value,
							})}
						placeholder="yyyy-(mm)-(dd)"
						spellcheck="false"
						autocomplete="off"
					/>
				{/if}
			</div>
		</div>
	</div>
</section>
