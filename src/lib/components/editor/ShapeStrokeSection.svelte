<script lang="ts" module>
	export const STROKE_CAP_OPTIONS = ["Butt", "Round", "Bevel"] as const;
	export const STROKE_JOIN_OPTIONS = ["Miter", "Round", "Bevel"] as const;
	export const STROKE_DASH_OPTIONS = ["Solid", "Dotted", "Dashed"] as const;

	export type StrokeCapOption = (typeof STROKE_CAP_OPTIONS)[number];
	export type StrokeJoinOption = (typeof STROKE_JOIN_OPTIONS)[number];
	export type StrokeDashOption = (typeof STROKE_DASH_OPTIONS)[number];
</script>

<script lang="ts">
	import ColorSelect, { type ColorSelectVariant } from "$lib/components/ui/ColorSelect.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";

	interface Props {
		colorSelectVariant?: ColorSelectVariant;
		color?: string;
		thickness?: number;
		cap?: StrokeCapOption;
		join?: StrokeJoinOption;
		dash?: StrokeDashOption;
	}

	let {
		colorSelectVariant = "field",
		color = $bindable("#000000"),
		thickness = $bindable(1),
		cap = $bindable<StrokeCapOption>("Butt"),
		join = $bindable<StrokeJoinOption>("Miter"),
		dash = $bindable<StrokeDashOption>("Solid"),
	}: Props = $props();
</script>

<div>
	<PopupSectionHeader title="Stroke" />

	<div class="mt-[13px] flex flex-col gap-2">
		<div class="grid grid-cols-2 gap-2">
			<ColorSelect bind:value={color} variant={colorSelectVariant} />
			<Input bind:value={thickness} unit="px" min={0} max={1000} step={0.5} decimals={1} />
		</div>

		<DropdownMenu bind:value={dash} options={STROKE_DASH_OPTIONS} />

		<div class="grid grid-cols-2 gap-2">
			<FieldLabel label="Edges">
				<DropdownMenu bind:value={cap} options={STROKE_CAP_OPTIONS} />
			</FieldLabel>
			<FieldLabel label="Join">
				<DropdownMenu bind:value={join} options={STROKE_JOIN_OPTIONS} />
			</FieldLabel>
		</div>
	</div>
</div>
