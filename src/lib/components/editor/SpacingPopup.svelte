<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import type { SpacingUnit } from "$lib/document/types";

	const UNIT_OPTIONS: SpacingUnit[] = ["pt", "em", "cm", "mm", "fr", "%"];

	const block = $derived(documentStore.activeBlock);
	const spacing = $derived(block.vSpacing ?? block.hSpacing);
	const isVertical = $derived(!!block.vSpacing);
	const title = $derived(isVertical ? "Vertical spacing" : "Horizontal spacing");
</script>

<Popup padding={12} class="w-[260px]">
	<PopupSectionHeader {title} />

	<div class="mt-[13px]">
		<Input
			value={spacing?.amount.value ?? 12}
			unit={spacing?.amount.unit ?? "pt"}
			units={UNIT_OPTIONS}
			min={0}
			max={9999}
			step={1}
			decimals={2}
			onchange={(v) => documentStore.updateSpacingValue(block.id, v)}
			onunitchange={(u) => documentStore.updateSpacingUnit(block.id, u as SpacingUnit)}
		/>
	</div>

	<div class="mt-3 flex items-center px-1">
		<Checkbox
			label="Weak"
			class="pl-1.5"
			checked={spacing?.weak ?? false}
			onchange={(v) => documentStore.updateSpacingWeak(block.id, v)}
		/>
	</div>
</Popup>
