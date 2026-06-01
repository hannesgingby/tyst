<script lang="ts">
	import Icon from "$lib/components/Icon.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import {
		SOURCE_TYPES,
		type BibliographySource,
		type SourceType,
	} from "$lib/document/bibliographySource";

	const FIELD_BG = "bg-bg-input-on-pure-white";
	const FIELD_ROW_CLASS = "grid items-center gap-x-10";
	const FIELD_ROW_STYLE = "grid-template-columns: minmax(0, 1fr) 300px";
	const FIELD_CLASS =
		"field-shell w-full border-none bg-bg-input-on-pure-white px-3 outline-none placeholder:text-text-250";

	interface FieldSpec {
		key: keyof BibliographySource;
		label: string;
		required?: boolean;
		placeholder?: string;
	}

	/** Fields shown for each source type, in display order. Title/authors/date are always first. */
	const TYPE_FIELDS: Record<SourceType, FieldSpec[]> = {
		Article: [
			{ key: "journalName", label: "Journal name" },
			{ key: "volume", label: "Volume" },
			{ key: "issue", label: "Issue" },
			{ key: "pageRange", label: "Page range", placeholder: "e.g. 12–34" },
		],
		Book: [
			{ key: "publisher", label: "Publisher" },
			{ key: "volume", label: "Volume" },
		],
		Chapter: [
			{ key: "publisher", label: "Publisher" },
			{ key: "volume", label: "Volume" },
			{ key: "pageRange", label: "Page range", placeholder: "e.g. 12–34" },
		],
		Conference: [
			{ key: "journalName", label: "Proceedings title" },
			{ key: "pageRange", label: "Page range", placeholder: "e.g. 12–34" },
		],
		Report: [
			{ key: "publisher", label: "Institution" },
		],
		Thesis: [
			{ key: "publisher", label: "Institution" },
		],
		Web: [
			{ key: "url", label: "URL" },
			{ key: "accessDate", label: "Accessed", placeholder: "yyyy-(mm)-(dd)" },
		],
	};

	interface Props {
		source: BibliographySource;
		label: string;
		onchange?: (patch: Partial<BibliographySource>) => void;
		onremove?: () => void;
	}

	let { source, label, onchange, onremove }: Props = $props();

	const extraFields = $derived(TYPE_FIELDS[source.type] ?? []);

	function toggleExpanded(): void {
		onchange?.({ expanded: !source.expanded });
	}

	function updateField<K extends keyof BibliographySource>(key: K, value: BibliographySource[K]): void {
		onchange?.({ [key]: value } as Partial<BibliographySource>);
	}
</script>

<div class="flex items-start gap-2">
	<div class="flex min-w-0 flex-1 flex-col gap-3">
		<button
			type="button"
			class="field-shell flex w-full items-center gap-2 rounded-md px-3 text-left {FIELD_BG}"
			aria-expanded={source.expanded}
			onclick={toggleExpanded}
		>
			<span
				class="flex size-7 shrink-0 cursor-grab items-center justify-center text-text-200"
				aria-hidden="true"
			>
				<Icon
					name={source.expanded
						? "arrow-union-vertical"
						: "arrow-separate-vertical"}
					class="size-4"
				/>
			</span>

			<span class="min-w-0 flex-1 truncate text-body-14-tight text-text-100">
				{label}
			</span>

			<span class="chevron flex size-7 shrink-0 items-center justify-center text-text-200" class:open={source.expanded}>
				<Icon name="nav-arrow-down" class="size-4" />
			</span>
		</button>

		{#if source.expanded}
			<div class="flex flex-col gap-[18px]">
				<!-- Type -->
				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">
						Type<span aria-hidden="true"> *</span>
					</span>
					<DropdownMenu
						class="w-full"
						bg={FIELD_BG}
						value={source.type}
						options={SOURCE_TYPES}
						onchange={(v) => updateField("type", v as SourceType)}
					/>
				</div>

				<!-- Title -->
				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">
						Title<span aria-hidden="true"> *</span>
					</span>
					<input
						type="text"
						class={FIELD_CLASS}
						value={source.title}
						oninput={(e) => updateField("title", (e.target as HTMLInputElement).value)}
						spellcheck="false"
					/>
				</div>

				<!-- Authors (optional for Web) -->
				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">
						Author(s){#if source.type !== "Web"}<span aria-hidden="true"> *</span>{/if}
					</span>
					<input
						type="text"
						class={FIELD_CLASS}
						value={source.authors}
						oninput={(e) => updateField("authors", (e.target as HTMLInputElement).value)}
						spellcheck="false"
					/>
				</div>

				<!-- Date -->
				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">
						Date<span aria-hidden="true"> *</span>
					</span>
					<input
						type="text"
						class={FIELD_CLASS}
						value={source.date}
						oninput={(e) => updateField("date", (e.target as HTMLInputElement).value)}
						placeholder="yyyy-(mm)-(dd)"
						spellcheck="false"
					/>
				</div>

				<!-- Type-specific fields -->
				{#each extraFields as field (field.key)}
					<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
						<span class="text-right text-body-14 text-text-100">{field.label}</span>
						<input
							type="text"
							class={FIELD_CLASS}
							value={source[field.key] as string}
							oninput={(e) => updateField(field.key, (e.target as HTMLInputElement).value)}
							placeholder={field.placeholder ?? ""}
							spellcheck="false"
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<button
		type="button"
		class="flex size-9 shrink-0 items-center justify-center rounded-md text-text-200 transition-colors duration-150 hover:bg-bg-800 hover:text-text-100"
		aria-label="Remove {label}"
		onclick={() => onremove?.()}
	>
		<Icon name="minus" class="size-4" />
	</button>
</div>

<style>
	.chevron {
		display: inline-flex;
		transform: rotate(0deg);
		transform-origin: center;
		transition: transform 300ms cubic-bezier(0.33, 1, 0.68, 1);
	}

	.chevron.open {
		transform: rotate(180deg);
	}
</style>
