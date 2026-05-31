<script lang="ts">
	import Icon from "$lib/components/Icon.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";

	const fitOptions = ["Cover", "Contain", "Stretch"] as const;
	const scalingOptions = ["Auto", "Smooth", "Pixelated"] as const;

	let alt = $state("");
	let width = $state<number | null>(null);
	let height = $state<number | null>(null);
	let fit = $state<(typeof fitOptions)[number]>("Cover");
	let scaling = $state<(typeof scalingOptions)[number]>("Auto");
	let spacingAbove = $state(1.2);
	let spacingBelow = $state(0.35);
	let spacingLinked = $state(true);
</script>

<Popup padding={12} class="w-[330px]">
	<div class="flex flex-col gap-[13px]">
		<FieldLabel label="File">
			<div
				class="flex h-9 items-center justify-between gap-2 rounded-md border border-dashed border-[#3D55EE] bg-[#E3E6FB] px-3"
			>
				<span class="min-w-0 truncate text-body-14-tight text-[#3D55EE]">
					testimg-1.png
				</span>
				<Icon name="edit-pencil" class="size-4 shrink-0 text-[#3D55EE]" />
			</div>
		</FieldLabel>

		<FieldLabel label="Alt">
			<label class="field-shell flex w-full items-center bg-bg-950 pl-3 pr-3">
				<input
					type="text"
					class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
					placeholder="None"
					bind:value={alt}
					spellcheck="false"
					autocomplete="off"
				/>
			</label>
		</FieldLabel>

		<div class="grid grid-cols-2 gap-2">
			<FieldLabel label="Width">
				<Input bind:value={width} emptyLabel="Auto" unit="px" min={1} max={10000} step={1} decimals={0} />
			</FieldLabel>
			<FieldLabel label="Height">
				<Input bind:value={height} emptyLabel="Auto" unit="px" min={1} max={10000} step={1} decimals={0} />
			</FieldLabel>
		</div>

		<div class="grid grid-cols-2 gap-2">
			<FieldLabel label="Fit">
				<DropdownMenu bind:value={fit} options={fitOptions} />
			</FieldLabel>
			<FieldLabel label="Scaling">
				<DropdownMenu bind:value={scaling} options={scalingOptions} />
			</FieldLabel>
		</div>
	</div>

	<ShapeSpacingSection
		tagLabel="image"
		bind:spacingAbove
		bind:spacingBelow
		bind:linked={spacingLinked}
	/>
</Popup>
