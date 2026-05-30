<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import { documentStore } from "$lib/document/store.svelte";

	interface Props {
		marker?: string;
		spacing?: number | null;
		indent?: number;
		bodyIndent?: number;
		tight?: boolean;
	}

	let {
		marker = $bindable(""),
		spacing = $bindable(null),
		indent = $bindable(0),
		bodyIndent = $bindable(0.5),
		tight = $bindable(true),
	}: Props = $props();
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg px-3 pt-3 pb-4">
	<div class="grid grid-cols-2 gap-2">
		<FieldLabel label="Marker">
			<label class="field-shell flex w-full items-center bg-bg-950 pl-4 pr-4">
				<input
					type="text"
					class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
					placeholder="--"
					bind:value={marker}
					spellcheck="false"
					autocomplete="off"
				/>
			</label>
		</FieldLabel>
		<FieldLabel label="Item spacing">
			<Input bind:value={spacing} emptyLabel="Auto" unit="em" min={0} max={10} step={0.1} decimals={1} />
		</FieldLabel>
		<FieldLabel label="Indent">
			<Input bind:value={indent} unit="pt" min={0} max={720} step={1} decimals={0} />
		</FieldLabel>
		<FieldLabel label="Body indent">
			<Input bind:value={bodyIndent} unit="em" min={0} max={10} step={0.1} decimals={1} />
		</FieldLabel>
	</div>

	<div class="mt-[13px] flex min-h-5 items-center">
		<Checkbox label="Tight" bind:checked={tight} />
	</div>

	<div class="mt-[41px]">
		<PopupSectionHeader title="Spacing">
			<Tag label="bullet-list" variant="blue" bind:linked={documentStore.bulletListSpacingLinked} />
		</PopupSectionHeader>
		<div class="mt-[13px] grid grid-cols-2 gap-2">
			<FieldLabel label="Above">
				<Input bind:value={documentStore.popupBulletListSpacingAbove} unit="em" min={0} max={20} step={0.05} decimals={2} />
			</FieldLabel>
			<FieldLabel label="Below">
				<Input bind:value={documentStore.popupBulletListSpacingBelow} unit="em" min={0} max={20} step={0.05} decimals={2} />
			</FieldLabel>
		</div>
	</div>
</div>
