<script lang="ts">
	import { documentStore } from "$lib/document/store.svelte";
	import ReferenceContextGroup from "./ReferenceContextGroup.svelte";

	interface Props {
		/** Block ID or source ID of the currently active reference/citation. Null when inserting. */
		activeTargetId?: string | null;
		/** True when a citation chip is active (vs a cross-reference chip). */
		isCitationActive?: boolean;
	}

	let { activeTargetId = null, isCitationActive = false }: Props = $props();

	const activeBlock = $derived(documentStore.activeBlock);

	function handleSelect(kind: "reference" | "citation", id: string): void {
		// If there's already an active reference/citation block, update it in place.
		if (activeBlock.reference && kind === "reference") {
			documentStore.updateReference(activeBlock.id, {
				targetBlockId: id,
				displayText: undefined,
				pageForm: undefined,
			});
		} else if (activeBlock.citation && kind === "citation") {
			documentStore.updateCitation(activeBlock.id, { sourceId: id });
		} else if (kind === "reference") {
			documentStore.insertReference(id);
		} else {
			documentStore.insertCitation(id);
		}
	}

	function handleMenuChange(dt: string, pf: boolean): void {
		if (!activeBlock.reference) return;
		documentStore.updateReference(activeBlock.id, {
			displayText: dt || undefined,
			pageForm: pf || undefined,
		});
	}

	function handleLinkChange(url: string, displayText: string): void {
		if (!url.trim()) return;
		const dt = displayText.trim() || undefined;
		if (activeBlock.link) {
			documentStore.updateLink(activeBlock.id, { url, displayText: dt });
		} else {
			documentStore.insertLink(url, dt, { focusTail: false });
		}
	}
</script>

<ReferenceContextGroup
	{activeTargetId}
	{isCitationActive}
	onselect={handleSelect}
	onmenuchange={handleMenuChange}
	onlinkchange={handleLinkChange}
/>
