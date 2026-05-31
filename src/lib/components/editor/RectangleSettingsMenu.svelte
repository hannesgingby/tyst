<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import ColorSelect from "$lib/components/ui/ColorSelect.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import { FONT_SIZE_UNITS, fontSizeUnit, ptToUnit, unitToPt } from "$lib/document/units";
	import type {
		BlockSpacing,
		RectSettings,
		StrokeSettings,
	} from "$lib/document/types";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";
	import ShapeStrokeSection from "./ShapeStrokeSection.svelte";

	interface Props {
		rect: RectSettings | (() => RectSettings);
		onchange: (patch: Partial<RectSettings>) => void;
		resolvedSpacing?: () => BlockSpacing | null;
		spacingLinked?: () => boolean;
		onspacingabove?: (value: number) => void;
		onspacingbelow?: (value: number) => void;
		onspacinglinkedchange?: (linked: boolean) => void;
	}

	let {
		rect,
		onchange,
		resolvedSpacing,
		spacingLinked,
		onspacingabove,
		onspacingbelow,
		onspacinglinkedchange,
	}: Props = $props();

	const value = $derived(typeof rect === "function" ? rect() : rect);

	// Width/height stored in pt; popup displays in the user's chosen unit
	// (defaults to px). Matches the font-size cycle in the typography popup.
	const dimensionUnits = FONT_SIZE_UNITS.map((u) => u.unit);
	let widthUnit = $state("px");
	let heightUnit = $state("px");
	const widthCfg = $derived(fontSizeUnit(widthUnit));
	const heightCfg = $derived(fontSizeUnit(heightUnit));
	const widthDisplay = $derived(
		value.width != null
			? Number(ptToUnit(value.width, widthUnit).toFixed(widthCfg.decimals))
			: null,
	);
	const heightDisplay = $derived(
		value.height != null
			? Number(ptToUnit(value.height, heightUnit).toFixed(heightCfg.decimals))
			: null,
	);

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
		<FieldLabel label="Width">
			<Input
				value={widthDisplay}
				onchange={(v) => onchange({ width: unitToPt(v, widthUnit) })}
				emptyLabel="Auto"
				unit={widthUnit}
				units={dimensionUnits}
				onunitchange={(u) => (widthUnit = u)}
				min={ptToUnit(1, widthUnit)}
				max={ptToUnit(10000, widthUnit)}
				step={widthCfg.step}
				decimals={widthCfg.decimals}
			/>
		</FieldLabel>
		<FieldLabel label="Height">
			<Input
				value={heightDisplay}
				onchange={(v) => onchange({ height: unitToPt(v, heightUnit) })}
				emptyLabel="Auto"
				unit={heightUnit}
				units={dimensionUnits}
				onunitchange={(u) => (heightUnit = u)}
				min={ptToUnit(1, heightUnit)}
				max={ptToUnit(10000, heightUnit)}
				step={heightCfg.step}
				decimals={heightCfg.decimals}
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
