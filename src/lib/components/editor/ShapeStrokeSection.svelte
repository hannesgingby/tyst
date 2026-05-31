<script lang="ts" module>
	import type { StrokeCap, StrokeDash, StrokeJoin } from "$lib/document/types";

	export const STROKE_CAP_OPTIONS = ["Butt", "Round", "Bevel"] as const;
	export const STROKE_JOIN_OPTIONS = ["Miter", "Round", "Bevel"] as const;
	export const STROKE_DASH_OPTIONS = ["Solid", "Dotted", "Dashed"] as const;

	export type StrokeCapOption = (typeof STROKE_CAP_OPTIONS)[number];
	export type StrokeJoinOption = (typeof STROKE_JOIN_OPTIONS)[number];
	export type StrokeDashOption = (typeof STROKE_DASH_OPTIONS)[number];

	export const CAP_TO_MODEL: Record<StrokeCapOption, StrokeCap> = {
		Butt: "butt",
		Round: "round",
		Bevel: "bevel",
	};
	export const CAP_TO_UI: Record<StrokeCap, StrokeCapOption> = {
		butt: "Butt",
		round: "Round",
		bevel: "Bevel",
	};
	export const JOIN_TO_MODEL: Record<StrokeJoinOption, StrokeJoin> = {
		Miter: "miter",
		Round: "round",
		Bevel: "bevel",
	};
	export const JOIN_TO_UI: Record<StrokeJoin, StrokeJoinOption> = {
		miter: "Miter",
		round: "Round",
		bevel: "Bevel",
	};
	export const DASH_TO_MODEL: Record<StrokeDashOption, StrokeDash> = {
		Solid: "solid",
		Dotted: "dotted",
		Dashed: "dashed",
	};
	export const DASH_TO_UI: Record<StrokeDash, StrokeDashOption> = {
		solid: "Solid",
		dotted: "Dotted",
		dashed: "Dashed",
	};
</script>

<script lang="ts">
	import ColorSelect, { type ColorSelectVariant } from "$lib/components/ui/ColorSelect.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import type { StrokeSettings } from "$lib/document/types";

	interface Props {
		colorSelectVariant?: ColorSelectVariant;
		stroke: StrokeSettings | (() => StrokeSettings);
		onchange?: (patch: Partial<StrokeSettings>) => void;
	}

	let { colorSelectVariant = "field", stroke, onchange }: Props = $props();

	const value = $derived(typeof stroke === "function" ? stroke() : stroke);
</script>

<div>
	<PopupSectionHeader title="Stroke" />

	<div class="mt-[13px] flex flex-col gap-2">
		<div class="grid grid-cols-2 gap-2">
			<ColorSelect
				value={value.color}
				variant={colorSelectVariant}
				onchange={(c) => onchange?.({ color: c })}
			/>
			<Input
				value={value.thickness}
				onchange={(v) => onchange?.({ thickness: v })}
				unit="px"
				min={0}
				max={1000}
				step={0.5}
				decimals={1}
			/>
		</div>

		<DropdownMenu
			value={DASH_TO_UI[value.dash]}
			options={STROKE_DASH_OPTIONS}
			onchange={(v) => onchange?.({ dash: DASH_TO_MODEL[v] })}
		/>

		<div class="grid grid-cols-2 gap-2">
			<FieldLabel label="Edges">
				<DropdownMenu
					value={CAP_TO_UI[value.cap]}
					options={STROKE_CAP_OPTIONS}
					onchange={(v) => onchange?.({ cap: CAP_TO_MODEL[v] })}
				/>
			</FieldLabel>
			<FieldLabel label="Join">
				<DropdownMenu
					value={JOIN_TO_UI[value.join]}
					options={STROKE_JOIN_OPTIONS}
					onchange={(v) => onchange?.({ join: JOIN_TO_MODEL[v] })}
				/>
			</FieldLabel>
		</div>
	</div>
</div>
