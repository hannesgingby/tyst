<script lang="ts">
	import type { HorizontalAlignment } from "$lib/document/types";
	import { documentStore } from "$lib/document/store.svelte";
	import SelectableList, { type SelectableItem } from "./SelectableList.svelte";

	interface Props {
		onhover?: (icon: string | null) => void;
	}
	let { onhover }: Props = $props();

	const ALIGNMENT_ITEMS: SelectableItem[] = [
		{ label: "Left" },
		{ label: "Center" },
		{ label: "Right" },
	];
	const ALIGNMENT_VALUES: HorizontalAlignment[] = ["left", "center", "right"];
	const ALIGNMENT_ICONS = ["align-left", "align-center", "align-right"];

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
	onhover={(i) => onhover?.(i !== null ? ALIGNMENT_ICONS[i] : null)}
/>
