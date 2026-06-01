<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import {
		formatZoneInset,
		parseZoneInset,
		ZONE_INSET_UNITS,
		type ZoneInsetUnit,
	} from "$lib/document/pageZoneInset";
	import { documentStore } from "$lib/document/store.svelte";

	interface Props {
		kind: "header" | "footer";
	}

	let { kind }: Props = $props();

	const title = $derived(kind === "header" ? "Header" : "Footer");
	const hasNumbering = $derived(documentStore.zoneCounterPattern(kind) !== null);

	const insetRaw = $derived(
		kind === "header" ? documentStore.headerAscent : documentStore.footerDescent,
	);

	let insetUnit = $state<ZoneInsetUnit>("%");

	const insetValue = $derived(parseZoneInset(insetRaw).value);
	const insetMax = $derived(insetUnit === "%" ? 100 : 500);
	const insetDecimals = $derived(insetUnit === "%" ? 0 : 1);

	$effect(() => {
		insetUnit = parseZoneInset(insetRaw).unit;
	});

	function commitInset(value: number): void {
		const formatted = formatZoneInset(value, insetUnit);
		if (kind === "header") documentStore.headerAscent = formatted;
		else documentStore.footerDescent = formatted;
	}

	function onInsetUnitChange(unit: string): void {
		insetUnit = unit as ZoneInsetUnit;
		const formatted = formatZoneInset(insetValue, insetUnit);
		if (kind === "header") documentStore.headerAscent = formatted;
		else documentStore.footerDescent = formatted;
	}

	function toggleNumbering(checked: boolean): void {
		if (checked) {
			documentStore.enableZoneNumbering(kind, "1");
		} else {
			documentStore.disableZoneNumbering(kind);
		}
	}
</script>

<Popup padding={12} class="w-[330px]">
	<PopupSectionHeader {title}>
		<Tag label={kind} variant="blue" linked />
	</PopupSectionHeader>

	<div class="mt-[13px]">
		<Input
			value={insetValue}
			unit={insetUnit}
			units={ZONE_INSET_UNITS}
			min={0}
			max={insetMax}
			step={1}
			decimals={insetDecimals}
			onchange={commitInset}
			onunitchange={onInsetUnitChange}
		/>
	</div>

	<div class="mt-[13px]">
		<Checkbox
			label="Page numbering"
			class="pl-1.5"
			checked={hasNumbering}
			onchange={toggleNumbering}
		/>
	</div>

	{#if hasNumbering}
		<div class="mt-[13px]">
			<PopupSectionHeader title="Numbering" />

			<label
				class="field-shell mt-[13px] flex w-full items-center justify-between bg-bg-950 pl-4 pr-4"
			>
				<input
					type="text"
					class="h-full flex-1 border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
					placeholder="None"
					bind:value={documentStore.popupZoneNumbering}
					spellcheck="false"
					autocomplete="off"
				/>
				<span class="ml-3 shrink-0 text-text-250">ex. 1/5</span>
			</label>
		</div>
	{/if}
</Popup>
