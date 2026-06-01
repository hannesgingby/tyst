<script lang="ts">
	import type { ListSettings } from "$lib/document/types";
	import { documentStore } from "$lib/document/store.svelte";
	import ListContextGroup from "./ListContextGroup.svelte";

	interface Props {
		onhover?: (icon: string | null) => void;
	}
	let { onhover }: Props = $props();

	function handleSelect(settings: ListSettings): void {
		documentStore.insertOrTransformActive({
			text: "",
			list: settings,
			placeholder: "Item",
		});
	}
</script>

<ListContextGroup onselect={handleSelect} {onhover} />
