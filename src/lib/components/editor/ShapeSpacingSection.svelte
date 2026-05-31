<script lang="ts">
	import Input from "$lib/components/ui/Input.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";

	interface Props {
		tagLabel: string;
		spacingAbove?: number;
		spacingBelow?: number;
		linked?: boolean;
	}

	let {
		tagLabel,
		spacingAbove = $bindable(1.2),
		spacingBelow = $bindable(0.35),
		linked = $bindable(true),
	}: Props = $props();
</script>

<div class="mt-[41px]">
	<PopupSectionHeader title="Above/below">
		<Tag label={tagLabel} variant="blue" bind:linked />
	</PopupSectionHeader>
	<div class="mt-[13px] grid grid-cols-2 gap-2">
		<Input bind:value={spacingAbove} unit="em" min={0} max={20} step={0.05} decimals={2} />
		<Input bind:value={spacingBelow} unit="em" min={0} max={20} step={0.05} decimals={2} />
	</div>
</div>
