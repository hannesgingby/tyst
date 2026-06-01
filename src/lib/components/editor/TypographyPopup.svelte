<script lang="ts">
	import { getContext } from "svelte";
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import {
		HOVER_POPUP_PIN_KEY,
		type HoverPopupPin,
	} from "$lib/components/ui/hoverPopupContext";
	import Icon from "$lib/components/Icon.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import { fontStore } from "$lib/system/fonts.svelte";
	import { FONT_SIZE_UNITS, fontSizeUnit, ptToUnit, unitToPt } from "$lib/document/units";
	import type { FontWeightName } from "$lib/document/types";

	const weightOptions: FontWeightName[] = ["Regular", "Medium", "Bold"];
	// "em" is added as a context-relative unit; handled separately since its
	// conversion factor depends on the body font size, not a fixed pt ratio.
	const sizeUnitOptions = [...FONT_SIZE_UNITS.map((u) => u.unit), "em"];

	const fontOptions = $derived(fontStore.families);
	// Values shown reflect the current scope: the shared default when linked,
	// otherwise the active block's resolved settings.
	const typography = $derived(documentStore.popupTypography);
	const paragraph = $derived(documentStore.popupParagraph);
	// Weight and leading are not meaningful to edit for heading/title blocks —
	// headings have their own bold and spacing controlled by Typst's heading styles.
	const isHeadingBlock = $derived(documentStore.isEditingHeadingBlock);
	const spacingFollowsLeading = $derived(paragraph.spacingFollowsLeading === true);

	// Body font size in pt — the reference for em unit conversions.
	const bodySize = $derived(documentStore.model.typography.size);

	// Size is stored in points; the input may display pt/px/em.
	// "em" is shown relative to the body font size and auto-selected for headings.
	let sizeUnit = $state("pt");

	$effect(() => {
		if (isHeadingBlock) sizeUnit = "em";
		else if (sizeUnit === "em") sizeUnit = "pt";
	});

	const sizeDecimals = $derived(sizeUnit === "em" ? 2 : fontSizeUnit(sizeUnit).decimals);
	const sizeStep = $derived(sizeUnit === "em" ? 0.05 : fontSizeUnit(sizeUnit).step);
	const sizeMin = $derived(sizeUnit === "em" ? 0.1 : ptToUnit(1, sizeUnit));
	const sizeMax = $derived(sizeUnit === "em" ? 10 : ptToUnit(720, sizeUnit));
	const sizeValue = $derived(
		sizeUnit === "em"
			? Number((typography.size / bodySize).toFixed(2))
			: Number(ptToUnit(typography.size, sizeUnit).toFixed(sizeDecimals)),
	);

	function onSizeChange(v: number): void {
		documentStore.setTypography("size", sizeUnit === "em" ? v * bodySize : unitToPt(v, sizeUnit));
	}

	const hoverPin = getContext<HoverPopupPin | undefined>(HOVER_POPUP_PIN_KEY);
	let fontMenuOpen = $state(false);

	$effect(() => {
		hoverPin?.setPinned(fontMenuOpen);
		return () => hoverPin?.setPinned(false);
	});
</script>

<Popup padding={16} class="w-[344px] pb-5">
	<section>
		<PopupSectionHeader title="Paragraph">
			<Tag label="default" variant="purple" bind:linked={documentStore.paragraphLinked} />
		</PopupSectionHeader>

		<div class="mt-[13px] flex flex-col gap-[13px]">
			<Input
				value={paragraph.spacing}
				icon="paragraph-spacing"
				iconClass="size-[19px]"
				unit="em"
				min={0.5}
				max={3}
				step={0.1}
				dragStep={0.1}
				decimals={spacingFollowsLeading ? 2 : 1}
				onchange={(v) => documentStore.setParagraph("spacing", v)}
			/>

			<div class="grid grid-cols-2 gap-2">
				<FieldLabel label="First-line indent">
					<Input
						value={paragraph.firstLineIndent}
						unit="pt"
						emptyLabel="None"
						inactive={paragraph.firstLineIndent == null}
						nullable
						min={0}
						max={72}
						step={0.5}
						decimals={1}
						onchange={(v) => documentStore.setFirstLineIndent(v)}
						onnull={() => documentStore.setFirstLineIndent(null)}
					/>
				</FieldLabel>
				<FieldLabel label="Hanging indent">
					<Input
						value={paragraph.hangingIndent}
						unit="pt"
						min={0}
						max={72}
						step={0.5}
						decimals={1}
						onchange={(v) => documentStore.setParagraph("hangingIndent", v)}
					/>
				</FieldLabel>
			</div>

			<div class="flex items-center justify-between px-1">
				<Checkbox
					label="Justified text"
					class="pl-1.5"
					checked={paragraph.justify}
					onchange={(v) => documentStore.setParagraph("justify", v)}
				/>
				<button
					type="button"
					class="flex size-5 items-center justify-center text-icon transition-colors duration-150 ease-out hover:text-text-200"
					aria-label="More options"
				>
					<Icon name="more-horiz" class="size-5" />
				</button>
			</div>
		</div>
	</section>

	<section class="mt-[41px]">
		<PopupSectionHeader title="Typography">
			<Tag label={documentStore.typographyContext} variant="blue" bind:linked={documentStore.typographyLinked} />
		</PopupSectionHeader>

		<div class="mt-[13px] flex flex-col gap-2">
			<DropdownMenu
				bind:open={fontMenuOpen}
				value={typography.fontFamily}
				options={fontOptions}
				placement="right"
				verticalAlign="center"
				searchable
				searchPlaceholder="Search fonts…"
				popupClass="flex h-[300px] w-[340px] min-w-[340px] shrink-0 flex-col"
				maxHeightClass="min-h-0 flex-1 overflow-y-auto"
				onchange={(v) => documentStore.setTypography("fontFamily", v)}
			/>

			<div class="grid grid-cols-2 gap-2">
				<DropdownMenu
					value={typography.weight}
					options={weightOptions}
					disabled={isHeadingBlock}
					onchange={(v) => documentStore.setTypography("weight", v)}
				/>
				<Input
					value={sizeValue}
					unit={sizeUnit}
					units={sizeUnitOptions}
					min={sizeMin}
					max={sizeMax}
					step={sizeStep}
					decimals={sizeDecimals}
					onchange={onSizeChange}
					onunitchange={(u) => (sizeUnit = u)}
				/>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<Input
					value={typography.leading}
					icon="line-height"
					unit="em"
					min={0.5}
					max={3}
					step={0.05}
					decimals={2}
					disabled={isHeadingBlock}
					onchange={(v) => documentStore.setTypography("leading", v)}
				/>
				<Input
					value={typography.tracking}
					icon="letter-spacing"
					unit="%"
					min={-10}
					max={10}
					step={0.1}
					decimals={1}
					onchange={(v) => documentStore.setTypography("tracking", v)}
				/>
			</div>
		</div>
	</section>

	<button
		type="button"
		class="mt-8 ml-auto flex items-center gap-1 text-body-14-tight text-text-200 transition-colors duration-150 ease-out hover:text-text-150"
	>
		Format groups
		<Icon name="arrow-up-right" class="size-4" />
	</button>
</Popup>
