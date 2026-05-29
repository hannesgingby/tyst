<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import { fontStore } from "$lib/system/fonts.svelte";
	import type { FontWeightName } from "$lib/document/types";

	const weightOptions: FontWeightName[] = ["Regular", "Medium", "Bold"];

	const fontOptions = $derived(fontStore.families);
	// Values shown reflect the current scope: the shared default when linked,
	// otherwise the active block's resolved settings.
	const typography = $derived(documentStore.popupTypography);
	const paragraph = $derived(documentStore.popupParagraph);
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
				decimals={1}
				onchange={(v) => documentStore.setParagraph("spacing", v)}
			/>

			<div class="grid grid-cols-2 gap-2">
				<FieldLabel label="First-line indent">
					<Input
						value={paragraph.firstLineIndent}
						unit="em"
						emptyLabel="None"
						disabled
						min={0}
						max={10}
						step={0.1}
					/>
				</FieldLabel>
				<FieldLabel label="Hanging indent">
					<Input
						value={paragraph.hangingIndent}
						unit="em"
						emptyLabel="None"
						disabled
						min={0}
						max={10}
						step={0.1}
					/>
				</FieldLabel>
			</div>

			<div class="flex items-center justify-between px-1">
				<Checkbox
					label="Justified text"
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
			<Tag label="body" variant="blue" bind:linked={documentStore.typographyLinked} />
		</PopupSectionHeader>

		<div class="mt-[13px] flex flex-col gap-2">
			<DropdownMenu
				value={typography.fontFamily}
				options={fontOptions}
				onchange={(v) => documentStore.setTypography("fontFamily", v)}
			/>

			<div class="grid grid-cols-2 gap-2">
				<DropdownMenu
					value={typography.weight}
					options={weightOptions}
					onchange={(v) => documentStore.setTypography("weight", v)}
				/>
				<Input
					value={typography.size}
					unit="px"
					min={6}
					max={72}
					step={1}
					decimals={0}
					onchange={(v) => documentStore.setTypography("size", v)}
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
					onchange={(v) => documentStore.setTypography("leading", v)}
				/>
				<Input
					value={typography.tracking}
					icon="letter-spacing"
					unit="%"
					min={-10}
					max={10}
					step={1}
					decimals={0}
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
