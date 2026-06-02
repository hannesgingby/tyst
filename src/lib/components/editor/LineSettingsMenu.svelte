<script lang="ts">
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import type {
		BlockSpacing,
		LineLengthUnit,
		LineSettings,
		StrokeSettings,
	} from "$lib/document/types";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";
	import ShapeStrokeSection from "./ShapeStrokeSection.svelte";

	interface Props {
		line: LineSettings | (() => LineSettings);
		onchange: (patch: Partial<LineSettings>) => void;
		/** Resolved spacing (own override, falling back to shared default). */
		resolvedSpacing?: () => BlockSpacing | null;
		spacingLinked?: () => boolean;
		onspacingabove?: (value: number) => void;
		onspacingbelow?: (value: number) => void;
		onspacinglinkedchange?: (linked: boolean) => void;
	}

	let {
		line,
		onchange,
		resolvedSpacing,
		spacingLinked,
		onspacingabove,
		onspacingbelow,
		onspacinglinkedchange,
	}: Props = $props();

	const value = $derived(typeof line === "function" ? line() : line);

	const lengthUnits: readonly LineLengthUnit[] = ["%", "em", "pt", "px"];
	const lengthMax = $derived(value.lengthUnit === "%" ? 100 : 10000);

	function patchStroke(p: Partial<StrokeSettings>): void {
		onchange({ stroke: { ...value.stroke, ...p } });
	}

	const DEFAULT_SPACING = { above: 1.2, below: 0.35 } as const;
	const spacingValue = $derived(resolvedSpacing?.() ?? value.spacing ?? DEFAULT_SPACING);
	const spacingAbove = $derived(spacingValue.above);
	const spacingBelow = $derived(spacingValue.below);
	const linked = $derived(spacingLinked ? spacingLinked() : value.spacing == null);
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

	<div class="mt-2 grid grid-cols-2 gap-2">
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
				onunitchange={(u) => onchange({ lengthUnit: u as LineLengthUnit })}
			/>
		</FieldLabel>
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
		linked={() => linked}
		onspacingabove={(v) =>
			onspacingabove
				? onspacingabove(v)
				: onchange({ spacing: { above: v, below: spacingBelow } })}
		onspacingbelow={(v) =>
			onspacingbelow
				? onspacingbelow(v)
				: onchange({ spacing: { above: spacingAbove, below: v } })}
		onlinkedchange={(v) =>
			onspacinglinkedchange
				? onspacinglinkedchange(v)
				: onchange({ spacing: v ? undefined : { above: spacingAbove, below: spacingBelow } })}
	/>
</div>
