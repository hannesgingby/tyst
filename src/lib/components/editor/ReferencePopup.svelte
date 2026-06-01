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
			documentStore.updateReference(activeBlock.id, { targetBlockId: id, displayText: undefined, pageForm: undefined });
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
</script>

<ReferenceContextGroup {activeTargetId} {isCitationActive} onselect={handleSelect} onmenuchange={handleMenuChange} />
