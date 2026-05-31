<script lang="ts">
	import Input from "$lib/components/ui/Input.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";

	interface Props {
		tagLabel: string;
		/** Current values — accept plain numbers or getter functions for reactivity. */
		spacingAbove?: number | (() => number);
		spacingBelow?: number | (() => number);
		linked?: boolean | (() => boolean);
		onspacingabove?: (value: number) => void;
		onspacingbelow?: (value: number) => void;
		onlinkedchange?: (linked: boolean) => void;
	}

	let {
		tagLabel,
		spacingAbove = 1.2,
		spacingBelow = 0.35,
		linked = true,
		onspacingabove,
		onspacingbelow,
		onlinkedchange,
	}: Props = $props();

	const above = $derived(typeof spacingAbove === "function" ? spacingAbove() : spacingAbove);
	const below = $derived(typeof spacingBelow === "function" ? spacingBelow() : spacingBelow);
	const linkedVal = $derived(typeof linked === "function" ? linked() : linked);
</script>

<div class="mt-[41px]">
	<PopupSectionHeader title="Above/below">
		<Tag
			label={tagLabel}
			variant="blue"
			linked={linkedVal}
			onUnlink={() => onlinkedchange?.(false)}
			onLink={() => onlinkedchange?.(true)}
		/>
	</PopupSectionHeader>
	<div class="mt-[13px] grid grid-cols-2 gap-2">
		<Input
			value={above}
			onchange={(v) => onspacingabove?.(v)}
			unit="em"
			min={0}
			max={20}
			step={0.05}
			decimals={2}
		/>
		<Input
			value={below}
			onchange={(v) => onspacingbelow?.(v)}
			unit="em"
			min={0}
			max={20}
			step={0.05}
			decimals={2}
		/>
	</div>
</div>
