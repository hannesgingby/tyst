<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";

	const fontOptions = [
		"Hedvig Letters Serif",
		"Hedvig Letters Sans",
		"Geist",
	] as const;

	const weightOptions = ["Regular", "Medium", "Bold"] as const;

	let justified = $state(true);
	let paragraphLinked = $state(true);
	let typographyLinked = $state(true);

	let paragraphLineHeight = $state(1.2);
	let firstLineIndent = $state<number | null>(null);
	let hangingIndent = $state<number | null>(null);

	let fontFamily = $state<string>(fontOptions[0]);
	let fontWeight = $state<string>(weightOptions[0]);
	let fontSize = $state(11);
	let lineHeight = $state(0.65);
	let letterSpacing = $state(0);
</script>

<Popup padding={16} class="w-[344px] pb-5">
	<section>
		<PopupSectionHeader title="Paragraph">
			<Tag label="default" variant="purple" bind:linked={paragraphLinked} />
		</PopupSectionHeader>

		<div class="mt-[13px] flex flex-col gap-[13px]">
			<Input
				bind:value={paragraphLineHeight}
				icon="paragraph-spacing"
				iconClass="size-[19px]"
				unit="em"
				min={0.5}
				max={3}
				step={0.1}
				decimals={1}
			/>

			<div class="grid grid-cols-2 gap-2">
				<FieldLabel label="First-line indent">
					<Input
						bind:value={firstLineIndent}
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
						bind:value={hangingIndent}
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
				<Checkbox label="Justified text" bind:checked={justified} />
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
			<Tag label="body" variant="blue" bind:linked={typographyLinked} />
		</PopupSectionHeader>

		<div class="mt-[13px] flex flex-col gap-2">
			<DropdownMenu bind:value={fontFamily} options={fontOptions} />

			<div class="grid grid-cols-2 gap-2">
				<DropdownMenu bind:value={fontWeight} options={weightOptions} />
				<Input bind:value={fontSize} unit="px" min={6} max={72} step={1} decimals={0} />
			</div>

			<div class="grid grid-cols-2 gap-2">
				<Input
					bind:value={lineHeight}
					icon="line-height"
					unit="em"
					min={0.5}
					max={3}
					step={0.05}
					decimals={2}
				/>
				<Input
					bind:value={letterSpacing}
					icon="letter-spacing"
					unit="%"
					min={-10}
					max={10}
					step={1}
					decimals={0}
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
