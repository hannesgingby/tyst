<script lang="ts">
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import { LANGUAGES } from "$lib/document/languages";

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg p-3">
	<PopupSectionHeader title="Language">
		<Tag label="default" variant="blue" bind:linked={documentStore.langLinked} />
	</PopupSectionHeader>

	<div class="mt-[13px]">
		<DropdownMenu
			bind:open
			value={documentStore.popupLang}
			options={LANGUAGES}
			placement="right"
			verticalAlign="end"
			searchable
			searchPlaceholder="Search languages…"
			popupClass="flex h-[300px] w-[280px] min-w-[280px] shrink-0 flex-col"
			maxHeightClass="min-h-0 flex-1 overflow-y-auto"
			onchange={(v) => documentStore.setLang(v)}
		/>
	</div>
</div>
