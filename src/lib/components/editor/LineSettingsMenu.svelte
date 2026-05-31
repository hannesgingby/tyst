<script lang="ts">
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import type { LineSettings, StrokeSettings } from "$lib/document/types";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";
	import ShapeStrokeSection from "./ShapeStrokeSection.svelte";

	interface Props {
		line: LineSettings | (() => LineSettings);
		onchange: (patch: Partial<LineSettings>) => void;
	}

	let { line, onchange }: Props = $props();

	const value = $derived(typeof line === "function" ? line() : line);

	const lengthUnits = ["%", "pt"] as const;
	const lengthMax = $derived(value.lengthUnit === "%" ? 100 : 10000);

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
		<FieldLabel label="Start x">
			<Input
				value={value.startX}
				onchange={(v) => onchange({ startX: v })}
				unit="pt"
				min={-10000}
				max={10000}
				step={1}
				decimals={0}
			/>
		</FieldLabel>
		<FieldLabel label="Start y">
			<Input
				value={value.startY}
				onchange={(v) => onchange({ startY: v })}
				unit="pt"
				min={-10000}
				max={10000}
				step={1}
				decimals={0}
			/>
		</FieldLabel>
	</div>

	<div class="mt-2">
		<FieldLabel label="Length">
			<Input
				value={value.length}
				onchange={(v) => onchange({ length: v })}
				unit={value.lengthUnit}
				units={lengthUnits}
				min={0}
				max={lengthMax}
				step={1}
				decimals={0}
				onunitchange={(u) => onchange({ lengthUnit: u as "%" | "pt" })}
			/>
		</FieldLabel>
	</div>

	<div class="mt-2">
		<FieldLabel label="Angle">
			<Input
				value={value.angle}
				onchange={(v) => onchange({ angle: v })}
				unit="deg"
				min={-360}
				max={360}
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
		tagLabel="line"
		spacingAbove={() => spacingAbove}
		spacingBelow={() => spacingBelow}
		linked={() => spacingLinked}
		onspacingabove={(v) => setSpacing(v, spacingBelow, false)}
		onspacingbelow={(v) => setSpacing(spacingAbove, v, false)}
		onlinkedchange={(v) => setSpacing(spacingAbove, spacingBelow, v)}
	/>
</div>
