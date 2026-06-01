<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import { documentStore } from "$lib/document/store.svelte";
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg p-3 pb-5">
	<div
		class="grid transition-[grid-template-rows] duration-100 ease-[cubic-bezier(0.33,1,0.68,1)]"
		style:grid-template-rows={documentStore.headingMenuIsTitle ? "0fr" : "1fr"}
	>
		<div class="min-h-0 overflow-hidden">
			<PopupSectionHeader title="Numbering">
				<Tag label="headings" variant="blue" bind:linked={documentStore.headingNumberingLinked} />
			</PopupSectionHeader>

			<div class="mt-[13px]">
				<label class="field-shell flex w-full items-center justify-between bg-bg-950 pl-4 pr-4">
					<input
						type="text"
						class="h-full flex-1 border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
						placeholder="None"
						bind:value={documentStore.popupHeadingNumbering}
						spellcheck="false"
						autocomplete="off"
					/>
					<span class="ml-3 shrink-0 text-text-250">ex. 1.a)</span>
				</label>
			</div>

			<div class="mt-[13px]">
				<Checkbox label="Outlined" class="pl-1.5" bind:checked={documentStore.popupHeadingOutlined} />
			</div>
		</div>
	</div>

	<div class="mt-[13px]">
		<PopupSectionHeader title="Above/below">
			<Tag
				label={documentStore.headingSpacingLevel === 0
					? "title"
					: `heading ${documentStore.headingSpacingLevel}`}
				variant="blue"
				bind:linked={documentStore.headingSpacingLinked}
			/>
		</PopupSectionHeader>
		<div class="mt-[13px] grid grid-cols-2 gap-2">
			<Input bind:value={documentStore.popupHeadingSpacingAbove} unit="em" min={0} max={20} step={0.05} decimals={2} />
			<Input bind:value={documentStore.popupHeadingSpacingBelow} unit="em" min={0} max={20} step={0.05} decimals={2} />
		</div>
	</div>

	<button
		type="button"
		class="mt-6 ml-auto flex items-center gap-1 text-body-14-tight text-text-200 transition-colors duration-150 ease-out hover:text-text-150"
	>
		Style rules
		<Icon name="arrow-up-right" class="size-4" />
	</button>
</div>
