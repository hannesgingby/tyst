<script lang="ts">
	import type { HorizontalAlignment } from "$lib/document/types";
	import { documentStore } from "$lib/document/store.svelte";
	import SelectableList, { type SelectableItem } from "./SelectableList.svelte";

	const ALIGNMENT_ITEMS: SelectableItem[] = [
		{ label: "Left" },
		{ label: "Center" },
		{ label: "Right" },
	];
	const ALIGNMENT_VALUES: HorizontalAlignment[] = ["left", "center", "right"];

	function handleSelect(index: number): void {
		const active = documentStore.activeBlock;
		documentStore.setAlignment(active.id, ALIGNMENT_VALUES[index]);
	}
</script>

<SelectableList
	items={ALIGNMENT_ITEMS}
	width={240}
	ariaLabel="Alignment"
	onselect={handleSelect}
/>
