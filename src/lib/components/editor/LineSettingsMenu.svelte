<script lang="ts">
	import type { StrokeCapOption, StrokeDashOption, StrokeJoinOption } from "./ShapeStrokeSection.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";
	import ShapeStrokeSection from "./ShapeStrokeSection.svelte";

	interface Props {
		startX?: number;
		startY?: number;
		length?: number;
		lengthUnit?: string;
		angle?: number;
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
		startX = $bindable(0),
		startY = $bindable(0),
		length = $bindable(100),
		lengthUnit = $bindable("%"),
		angle = $bindable(0),
		strokeColor = $bindable("#000000"),
		strokeThickness = $bindable(1),
		strokeCap = $bindable<StrokeCapOption>("Butt"),
		strokeJoin = $bindable<StrokeJoinOption>("Miter"),
		strokeDash = $bindable<StrokeDashOption>("Solid"),
		spacingAbove = $bindable(1.2),
		spacingBelow = $bindable(0.35),
		spacingLinked = $bindable(true),
	}: Props = $props();

	const lengthUnits = ["%", "pt"] as const;
	const lengthMax = $derived(lengthUnit === "%" ? 100 : 10000);
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg px-3 pt-3 pb-4">
	<div class="grid grid-cols-2 gap-2">
		<FieldLabel label="Start x">
			<Input bind:value={startX} unit="pt" min={-10000} max={10000} step={1} decimals={0} />
		</FieldLabel>
		<FieldLabel label="Start y">
			<Input bind:value={startY} unit="pt" min={-10000} max={10000} step={1} decimals={0} />
		</FieldLabel>
	</div>

	<div class="mt-2">
		<FieldLabel label="Length">
			<Input
				bind:value={length}
				unit={lengthUnit}
				units={lengthUnits}
				min={0}
				max={lengthMax}
				step={1}
				decimals={0}
				onunitchange={(u) => (lengthUnit = u)}
			/>
		</FieldLabel>
	</div>

	<div class="mt-2">
		<FieldLabel label="Angle">
			<Input bind:value={angle} unit="deg" min={-360} max={360} step={1} decimals={0} />
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
		tagLabel="line"
		bind:spacingAbove
		bind:spacingBelow
		bind:linked={spacingLinked}
	/>
</div>
