<script lang="ts">
	import { documentStore } from "$lib/document/store.svelte";
	import HeadingContextGroup, { HEADING_LEVELS } from "./HeadingContextGroup.svelte";

	function handleSelect(level: 0 | 1 | 2 | 3 | 4): void {
		const label = HEADING_LEVELS[level].label;
		const active = documentStore.activeBlock;
		// Already in a heading block? Change its level in place instead of
		// inserting a new one below.
		if (active.heading) {
			if (active.heading.level === level) return;
			documentStore.setHeading(active.id, { level });
			active.placeholder = label;
			return;
		}
		documentStore.insertOrTransformActive({
			text: "",
			heading: { level },
			placeholder: label,
		});
	}
</script>

<HeadingContextGroup levelIndex={documentStore.headingMenuIndex} onselect={handleSelect} />
