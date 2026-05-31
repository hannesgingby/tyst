<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import ColorSelect from "$lib/components/ui/ColorSelect.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import type { RectSettings, StrokeSettings } from "$lib/document/types";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";
	import ShapeStrokeSection from "./ShapeStrokeSection.svelte";

	interface Props {
		rect: RectSettings | (() => RectSettings);
		onchange: (patch: Partial<RectSettings>) => void;
	}

	let { rect, onchange }: Props = $props();

	const value = $derived(typeof rect === "function" ? rect() : rect);

	function patchStroke(p: Partial<StrokeSettings>): void {
		onchange({ stroke: { ...value.stroke, ...p } });
	}

	const DEFAULT_SPACING = { above: 1.2, below: 0.35 } as const;
	const spacingAbove = $derived(value.spacing?.above ?? DEFAULT_SPACING.above);
	const spacingBelow = $derived(value.spacing?.below ?? DEFAULT_SPACING.below);
	const spacingLinked = $derived(value.spacing == null);

	function setSpacing(above: number, below: number, linked: boolean): void {
		onchange({ spacing: linked ? undefined : { above, below } });
	}
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg px-3 pt-3 pb-4">
	<div class="grid grid-cols-2 gap-2">
		<FieldLabel label="Width">
			<Input
				value={value.width}
				onchange={(v) => onchange({ width: v })}
				emptyLabel="Auto"
				unit="pt"
				min={0}
				max={10000}
				step={1}
				decimals={0}
			/>
		</FieldLabel>
		<FieldLabel label="Height">
			<Input
				value={value.height}
				onchange={(v) => onchange({ height: v })}
				emptyLabel="Auto"
				unit="pt"
				min={0}
				max={10000}
				step={1}
				decimals={0}
			/>
		</FieldLabel>
	</div>

	<div class="mt-2 grid grid-cols-2 gap-2">
		<FieldLabel label="Fill">
			{#if value.fillEnabled}
				<ColorSelect
					value={value.fillColor}
					variant="field"
					onchange={(c) => onchange({ fillColor: c })}
				/>
			{:else}
				<div
					class="field-shell flex w-full items-center bg-bg-950 pl-3 pr-3 text-body-14-tight text-text-250"
				>
					None
				</div>
			{/if}
		</FieldLabel>
		<FieldLabel label={" "}>
			<div class="flex h-9 items-center">
				<Checkbox
					label="Fill"
					class="pl-3"
					checked={value.fillEnabled}
					onchange={(v) => onchange({ fillEnabled: v })}
				/>
			</div>
		</FieldLabel>
	</div>

	<div class="mt-2 grid grid-cols-2 gap-2">
		<FieldLabel label="Radius">
			<Input
				value={value.radius}
				onchange={(v) => onchange({ radius: v })}
				unit="pt"
				min={0}
				max={10000}
				step={1}
				decimals={0}
			/>
		</FieldLabel>
		<FieldLabel label="Inset">
			<Input
				value={value.inset}
				onchange={(v) => onchange({ inset: v })}
				unit="pt"
				min={0}
				max={10000}
				step={1}
				decimals={0}
			/>
		</FieldLabel>
	</div>

	<div class="mt-[13px]">
		<ShapeStrokeSection
			colorSelectVariant="field"
			stroke={() => value.stroke}
			onchange={patchStroke}
		/>
	</div>

	<ShapeSpacingSection
		tagLabel="rectangle"
		spacingAbove={() => spacingAbove}
		spacingBelow={() => spacingBelow}
		linked={() => spacingLinked}
		onspacingabove={(v) => setSpacing(v, spacingBelow, false)}
		onspacingbelow={(v) => setSpacing(spacingAbove, v, false)}
		onlinkedchange={(v) => setSpacing(spacingAbove, spacingBelow, v)}
	/>
</div>
