<script lang="ts">
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import type { OutlineSettings } from "$lib/document/types";
	import ShapeSpacingSection from "./ShapeSpacingSection.svelte";

	// The outline popup edits the active block's outline settings. When the
	// active block is not an outline block, fall back to a stable preview
	// object so the inputs still render with defaults (matches LinePopup).
	const previewOutline = $derived<OutlineSettings>(
		documentStore.defaultOutlineSettings(),
	);
	const block = $derived(documentStore.activeBlock);
	const outline = $derived<OutlineSettings>(block.outline ?? previewOutline);

	function patch(p: Partial<OutlineSettings>): void {
		if (!block.outline) return;
		documentStore.updateOutline(block.id, p);
	}

	const resolvedSpacing = $derived(
		block.outline ? documentStore.resolveEmbedSpacing(block) : null,
	);
	const spacingAbove = $derived(resolvedSpacing?.above ?? 1.2);
	const spacingBelow = $derived(resolvedSpacing?.below ?? 0.35);
	const spacingLinked = $derived(
		block.outline ? documentStore.embedSpacingLinked(block) : true,
	);
</script>

<Popup padding={12} class="w-[330px]">
	<div class="flex flex-col gap-[13px]">
		<FieldLabel label="Target">
			<label class="field-shell flex w-full items-center bg-bg-950 pl-3 pr-3">
				<input
					type="text"
					class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
					placeholder="heading"
					value={outline.target ?? ""}
					oninput={(e) => patch({ target: e.currentTarget.value || undefined })}
					spellcheck="false"
					autocomplete="off"
				/>
			</label>
		</FieldLabel>

		<div class="grid grid-cols-2 gap-2">
			<FieldLabel label="Depth">
				<Input
					value={outline.depth ?? null}
					onchange={(v) => patch({ depth: v })}
					emptyLabel="All"
					min={1}
					max={6}
					step={1}
					decimals={0}
				/>
			</FieldLabel>
			<FieldLabel label="Indent">
				<Input
					value={outline.indent ?? null}
					onchange={(v) => patch({ indent: v })}
					emptyLabel="Auto"
					unit="pt"
					min={0}
					max={1000}
					step={1}
					decimals={1}
				/>
			</FieldLabel>
		</div>
	</div>

	<ShapeSpacingSection
		tagLabel="outline"
		spacingAbove={() => spacingAbove}
		spacingBelow={() => spacingBelow}
		linked={() => spacingLinked}
		onspacingabove={(v) =>
			block.outline && documentStore.setEmbedSpacing(block, { above: v })}
		onspacingbelow={(v) =>
			block.outline && documentStore.setEmbedSpacing(block, { below: v })}
		onlinkedchange={(v) =>
			block.outline && documentStore.setEmbedSpacingLinked(block, v)}
	/>
</Popup>
