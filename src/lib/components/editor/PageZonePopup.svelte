<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import type { PageZoneCounterPattern } from "$lib/document/types";

	interface Props {
		kind: "header" | "footer";
		pageIdx: number;
	}

	let { kind, pageIdx }: Props = $props();

	const title = $derived(kind === "header" ? "Header" : "Footer");
	const pageTag = $derived(`page-${pageIdx + 1}`);
	const zone = $derived(documentStore.getZone(kind));
	const numbering = $derived(zone?.numbering);
	const hasNumbering = $derived(!!numbering);
	const selectedAlign = $derived(numbering?.align ?? "center");
	const selectedPattern = $derived(numbering?.pattern ?? "1");

	const PATTERNS: { value: PageZoneCounterPattern; label: string }[] = [
		{ value: "1", label: "1, 2, 3" },
		{ value: "1/1", label: "1 / 1" },
		{ value: "I", label: "I, II, III" },
		{ value: "i", label: "i, ii, iii" },
		{ value: "A", label: "A, B, C" },
		{ value: "a", label: "a, b, c" },
	];
	const PATTERN_LABELS = $derived(PATTERNS.map((p) => p.label));
	const selectedPatternLabel = $derived(
		PATTERNS.find((p) => p.value === selectedPattern)?.label ?? PATTERNS[0].label,
	);

	const ALIGN_OPTIONS = [
		{ value: "left" as const, icon: "align-left" },
		{ value: "center" as const, icon: "align-center" },
		{ value: "right" as const, icon: "align-right" },
	];

	function toggleNumbering(checked: boolean): void {
		if (checked) {
			documentStore.updateZoneNumbering(kind, { pattern: "1", align: "center" });
		} else {
			documentStore.updateZoneNumbering(kind, undefined);
		}
	}

	function setAlign(align: "left" | "center" | "right"): void {
		documentStore.updateZoneNumbering(kind, { pattern: selectedPattern, align });
	}

	function setPatternByLabel(label: string): void {
		const p = PATTERNS.find((x) => x.label === label);
		if (p) documentStore.updateZoneNumbering(kind, { pattern: p.value, align: selectedAlign });
	}
</script>

<Popup padding={12} class="w-[280px]">
	<PopupSectionHeader {title}>
		<Tag label={pageTag} variant="blue" linked />
	</PopupSectionHeader>

	<!-- Text content -->
	<div class="mt-[13px]">
		<FieldLabel label="Text">
			<label class="field-shell flex w-full items-center bg-bg-950 pl-4 pr-4">
				<input
					type="text"
					class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
					placeholder={kind === "header" ? "Page header" : "Page footer"}
					value={zone?.text ?? ""}
					oninput={(e) => documentStore.updateZoneText(kind, e.currentTarget.value)}
					spellcheck="false"
					autocomplete="off"
				/>
			</label>
		</FieldLabel>
	</div>

	{#if kind === "header"}
		<!-- Header ascent -->
		<div class="mt-[13px]">
			<FieldLabel label="Ascent">
				<label class="field-shell flex w-full items-center bg-bg-950 pl-4 pr-4">
					<input
						type="text"
						class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
						placeholder="30%"
						value={zone?.ascent ?? ""}
						oninput={(e) => {
							const v = e.currentTarget.value.trim();
							documentStore.updateZoneAscent(v || undefined);
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
		<Checkbox
			label="Page numbering"
			checked={hasNumbering}
			onchange={toggleNumbering}
		/>
	</div>

	{#if hasNumbering}
		<!-- Pattern -->
		<div class="mt-[13px]">
			<FieldLabel label="Format">
				<DropdownMenu
					value={selectedPatternLabel}
					options={PATTERN_LABELS}
					onchange={setPatternByLabel}
				/>
			</FieldLabel>
		</div>

		<!-- Align -->
		<div class="mt-[13px]">
			<FieldLabel label="Alignment">
				<div class="flex gap-1">
					{#each ALIGN_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class={[
								"flex size-8 items-center justify-center rounded-md transition-colors duration-150",
								selectedAlign === opt.value
									? "bg-bg-700 text-text-100"
									: "text-text-200 hover:bg-bg-800 hover:text-text-100",
							]}
							onclick={() => setAlign(opt.value)}
						>
							<Icon name={opt.icon} class="size-4" />
						</button>
					{/each}
				</div>
			</FieldLabel>
		</div>
	{/if}
</Popup>
