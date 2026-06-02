<script lang="ts">
	import { documentStore } from "$lib/document/store.svelte";
	import { getDocLocale, headingPlaceholder } from "$lib/document/docLocale";
	import HeadingContextGroup from "./HeadingContextGroup.svelte";

	function handleSelect(level: 0 | 1 | 2 | 3 | 4): void {
		const locale = getDocLocale(documentStore.model.lang);
		const label = headingPlaceholder(locale, level);
		const active = documentStore.activeBlock;
		// Already in a heading block? Change its level in place instead of
		// inserting a new one below.
		if (active.heading) {
			if (active.heading.level === level) return;
			documentStore.setHeading(active.id, { level });
			active.placeholder = undefined;
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
