<script lang="ts">
	import type { ListSettings } from "$lib/document/types";
	import { documentStore } from "$lib/document/store.svelte";
	import { getDocLocale } from "$lib/document/docLocale";
	import ListContextGroup from "./ListContextGroup.svelte";

	interface Props {
		onhover?: (icon: string | null) => void;
	}
	let { onhover }: Props = $props();

	function handleSelect(settings: ListSettings): void {
		const locale = getDocLocale(documentStore.model.lang);
		documentStore.insertOrTransformActive({
			text: "",
			list: settings,
			placeholder: locale.listItem,
		});
	}
</script>

<ListContextGroup onselect={handleSelect} {onhover} />
