<script lang="ts">
	import Icon from "$lib/components/Icon.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import type { ImageFit, ImageScaling, ImageSettings } from "$lib/document/types";
	import { FONT_SIZE_UNITS, fontSizeUnit, ptToUnit, unitToPt } from "$lib/document/units";
	import { pickAndLoadImage } from "$lib/system/imageCache.svelte";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";

	const fitOptions = ["Cover", "Contain", "Stretch"] as const;
	const scalingOptions = ["Auto", "Smooth", "Pixelated"] as const;
	type FitUi = (typeof fitOptions)[number];
	type ScalingUi = (typeof scalingOptions)[number];

	const fitToUi: Record<ImageFit, FitUi> = {
		cover: "Cover",
		contain: "Contain",
		stretch: "Stretch",
	};
	const uiToFit: Record<FitUi, ImageFit> = {
		Cover: "cover",
		Contain: "contain",
		Stretch: "stretch",
	};
	const scalingToUi: Record<ImageScaling, ScalingUi> = {
		auto: "Auto",
		smooth: "Smooth",
		pixelated: "Pixelated",
	};
	const uiToScaling: Record<ScalingUi, ImageScaling> = {
		Auto: "auto",
		Smooth: "smooth",
		Pixelated: "pixelated",
	};

	// The popup edits the active block's image settings. The toolbar opens this
	// popup as part of the insert flow, so an image block should always be active.
	const block = $derived(documentStore.activeBlock);
	const image = $derived<ImageSettings | null>(block.image ?? null);

	function patch(p: Partial<ImageSettings>): void {
		if (!block.image) return;
		documentStore.updateImage(block.id, p);
	}

	async function pickAnotherFile(): Promise<void> {
		if (!image) return;
		const picked = await pickAndLoadImage(block.id);
		if (!picked) return;
		patch({ fileName: picked.fileName, ext: picked.ext });
	}

	// Width/height stored in pt; popup displays in the user's chosen unit
	// (defaults to px). Matches the font-size cycle in the typography popup.
	const dimensionUnits = FONT_SIZE_UNITS.map((u) => u.unit);
	let widthUnit = $state("px");
	let heightUnit = $state("px");
	const widthCfg = $derived(fontSizeUnit(widthUnit));
	const heightCfg = $derived(fontSizeUnit(heightUnit));
	const widthDisplay = $derived(
		image?.width != null
			? Number(ptToUnit(image.width, widthUnit).toFixed(widthCfg.decimals))
			: null,
	);
	const heightDisplay = $derived(
		image?.height != null
			? Number(ptToUnit(image.height, heightUnit).toFixed(heightCfg.decimals))
			: null,
	);

	// Spacing reads the *resolved* value (block override → shared default).
	// Writes route through the store so that editing while "linked" updates
	// the shared default instead of forcing an unlink.
	const resolvedSpacing = $derived(documentStore.resolveEmbedSpacing(block));
	const spacingAbove = $derived(resolvedSpacing?.above ?? 1.2);
	const spacingBelow = $derived(resolvedSpacing?.below ?? 0.35);
	const spacingLinked = $derived(documentStore.embedSpacingLinked(block));
</script>

<Popup padding={12} class="w-[330px]">
	<div class="flex flex-col gap-[13px]">
		<FieldLabel label="File">
			<button
				type="button"
				class="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-dashed border-[#3D55EE] bg-[#E3E6FB] px-3"
				onclick={pickAnotherFile}
			>
				<span class="min-w-0 truncate text-body-14-tight text-[#3D55EE]">
					{image?.fileName ?? "No file selected"}
				</span>
				<Icon name="edit-pencil" class="size-4 shrink-0 text-[#3D55EE]" />
			</button>
		</FieldLabel>

		<FieldLabel label="Alt">
			<label class="field-shell flex w-full items-center bg-bg-950 pl-3 pr-3">
				<input
					type="text"
					class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
					placeholder="None"
					value={image?.alt ?? ""}
					oninput={(e) => patch({ alt: e.currentTarget.value || undefined })}
					spellcheck="false"
					autocomplete="off"
				/>
			</label>
		</FieldLabel>

		<div class="grid grid-cols-2 gap-2">
			<FieldLabel label="Width">
				<Input
					value={widthDisplay}
					onchange={(v) => patch({ width: unitToPt(v, widthUnit) })}
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
					onchange={(v) => patch({ height: unitToPt(v, heightUnit) })}
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

		<div class="grid grid-cols-2 gap-2">
			<FieldLabel label="Fit">
				<DropdownMenu
					value={image ? fitToUi[image.fit ?? "cover"] : "Cover"}
					options={fitOptions}
					onchange={(v) => patch({ fit: uiToFit[v] })}
				/>
			</FieldLabel>
			<FieldLabel label="Scaling">
				<DropdownMenu
					value={image ? scalingToUi[image.scaling ?? "auto"] : "Auto"}
					options={scalingOptions}
					onchange={(v) => patch({ scaling: uiToScaling[v] })}
				/>
			</FieldLabel>
		</div>
	</div>

	<ShapeSpacingSection
		tagLabel="image"
		spacingAbove={() => spacingAbove}
		spacingBelow={() => spacingBelow}
		linked={() => spacingLinked}
		onspacingabove={(v) => documentStore.setEmbedSpacing(block, { above: v })}
		onspacingbelow={(v) => documentStore.setEmbedSpacing(block, { below: v })}
		onlinkedchange={(v) => documentStore.setEmbedSpacingLinked(block, v)}
	/>
</Popup>
