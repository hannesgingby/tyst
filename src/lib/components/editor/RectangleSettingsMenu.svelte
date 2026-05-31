<script lang="ts">
	import type { StrokeCapOption, StrokeDashOption, StrokeJoinOption } from "./ShapeStrokeSection.svelte";
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import ColorSelect from "$lib/components/ui/ColorSelect.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";
	import ShapeStrokeSection from "./ShapeStrokeSection.svelte";

	interface Props {
		width?: number | null;
		height?: number | null;
		fillEnabled?: boolean;
		fillColor?: string;
		radius?: number;
		inset?: number;
		strokeColor?: string;
		strokeThickness?: number;
		strokeCap?: StrokeCapOption;
		strokeJoin?: StrokeJoinOption;
		strokeDash?: StrokeDashOption;
		spacingAbove?: number;
		spacingBelow?: number;
		spacingLinked?: boolean;
	}

	let {
		width = $bindable<number | null>(null),
		height = $bindable<number | null>(null),
		fillEnabled = $bindable(false),
		fillColor = $bindable("#000000"),
		radius = $bindable(0),
		inset = $bindable(5),
		strokeColor = $bindable("#000000"),
		strokeThickness = $bindable(1),
		strokeCap = $bindable<StrokeCapOption>("Butt"),
		strokeJoin = $bindable<StrokeJoinOption>("Miter"),
		strokeDash = $bindable<StrokeDashOption>("Solid"),
		spacingAbove = $bindable(1.2),
		spacingBelow = $bindable(0.35),
		spacingLinked = $bindable(true),
	}: Props = $props();
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg px-3 pt-3 pb-4">
	<div class="grid grid-cols-2 gap-2">
		<FieldLabel label="Width">
			<Input bind:value={width} emptyLabel="Auto" unit="pt" min={0} max={10000} step={1} decimals={0} />
		</FieldLabel>
		<FieldLabel label="Height">
			<Input bind:value={height} emptyLabel="Auto" unit="pt" min={0} max={10000} step={1} decimals={0} />
		</FieldLabel>
	</div>

	<div class="mt-2 grid grid-cols-2 gap-2">
		<FieldLabel label="Fill">
			{#if fillEnabled}
				<ColorSelect bind:value={fillColor} variant="field" />
			{:else}
				<div
					class="field-shell flex w-full items-center bg-bg-950 pl-3 pr-3 text-body-14-tight text-text-250"
				>
					None
				</div>
			{/if}
		</FieldLabel>
		<FieldLabel label={"\u00a0"}>
			<div class="flex h-9 items-center">
				<Checkbox label="Fill" class="pl-3" bind:checked={fillEnabled} />
			</div>
		</FieldLabel>
	</div>

	<div class="mt-2 grid grid-cols-2 gap-2">
		<FieldLabel label="Radius">
			<Input bind:value={radius} unit="pt" min={0} max={10000} step={1} decimals={0} />
		</FieldLabel>
		<FieldLabel label="Inset">
			<Input bind:value={inset} unit="pt" min={0} max={10000} step={1} decimals={0} />
		</FieldLabel>
	</div>

	<div class="mt-[13px]">
		<ShapeStrokeSection
			colorSelectVariant="field"
			bind:color={strokeColor}
			bind:thickness={strokeThickness}
			bind:cap={strokeCap}
			bind:join={strokeJoin}
			bind:dash={strokeDash}
		/>
	</div>

	<ShapeSpacingSection
		tagLabel="rectangle"
		bind:spacingAbove
		bind:spacingBelow
		bind:linked={spacingLinked}
	/>
</div>
