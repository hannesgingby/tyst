<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import type { PageZoneCounterPattern } from "$lib/document/types";

	interface Props {
		kind: "header" | "footer";
	}

	let { kind }: Props = $props();

	const title = $derived(kind === "header" ? "Header" : "Footer");
	const hasNumbering = $derived(documentStore.zoneCounterPattern(kind) !== null);
	const currentPattern = $derived(documentStore.zoneCounterPattern(kind) ?? "1");

	const PATTERNS: { value: PageZoneCounterPattern; label: string }[] = [
		{ value: "1", label: "1, 2, 3" },
		{ value: "1/1", label: "1 / 1" },
		{ value: "I", label: "I, II, III" },
		{ value: "i", label: "i, ii, iii" },
		{ value: "A", label: "A, B, C" },
		{ value: "a", label: "a, b, c" },
	];

	function toggleNumbering(checked: boolean): void {
		if (checked) {
			documentStore.enableZoneNumbering(kind, "1");
		} else {
			documentStore.disableZoneNumbering(kind);
		}
	}

	function setPattern(e: Event): void {
		const val = (e.currentTarget as HTMLSelectElement).value as PageZoneCounterPattern;
		documentStore.updateZoneCounterPattern(kind, val);
	}
</script>

<Popup padding={12} class="w-[260px]">
	<PopupSectionHeader {title}>
		<Tag label={kind} variant="blue" linked />
	</PopupSectionHeader>

	{#if kind === "header"}
		<!-- Header ascent -->
		<div class="mt-[13px]">
			<FieldLabel label="Ascent">
				<label class="field-shell flex w-full items-center bg-bg-950 pl-4 pr-4">
					<input
						type="text"
						class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
						placeholder="30%"
						value={documentStore.headerAscent ?? ""}
						oninput={(e) => {
							const v = e.currentTarget.value.trim();
							documentStore.headerAscent = v || undefined;
						}}
						spellcheck="false"
						autocomplete="off"
					/>
				</label>
			</FieldLabel>
		</div>
	{/if}

	<!-- Page numbering -->
	<div class="mt-[13px]">
		<Checkbox label="Page numbering" checked={hasNumbering} onchange={toggleNumbering} />
	</div>

	{#if hasNumbering}
		<!-- Numbering pattern -->
		<div class="mt-[13px]">
			<FieldLabel label="Numbering">
				<label class="field-shell flex w-full items-center bg-bg-950 pl-4 pr-4">
					<select
						class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none appearance-none"
						value={currentPattern}
						onchange={setPattern}
					>
						{#each PATTERNS as p (p.value)}
							<option value={p.value}>{p.label}</option>
						{/each}
					</select>
				</label>
			</FieldLabel>
		</div>
	{/if}
</Popup>
