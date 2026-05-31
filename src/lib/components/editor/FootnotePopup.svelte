<script lang="ts">
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";
	import Popup from "$lib/components/ui/Popup.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";
	import Tag from "$lib/components/ui/Tag.svelte";
	import { documentStore } from "$lib/document/store.svelte";

	const pageIndex = $derived(documentStore.activeBlockPageIndex);
	const pageTag = $derived(`page-${pageIndex + 1}`);
	const settings = $derived(documentStore.resolveFootnoteSettings(pageIndex));
	const linked = $derived(documentStore.footnoteSettingsLinked(pageIndex));
	const isDefaultPage = $derived(pageIndex === 0);

	function patch(p: Partial<typeof settings>): void {
		documentStore.updateFootnoteSettings(pageIndex, p);
	}
</script>

<Popup padding={12} class="w-[330px]">
	<PopupSectionHeader title="Footnote">
		{#if isDefaultPage}
			<Tag label={pageTag} variant="blue" linked={true} />
		{:else}
			<Tag
				label={pageTag}
				variant="blue"
				{linked}
				onUnlink={() => documentStore.setFootnoteSettingsLinked(pageIndex, false)}
				onLink={() => documentStore.setFootnoteSettingsLinked(pageIndex, true)}
			/>
		{/if}
	</PopupSectionHeader>

	<div class="mt-[13px]">
		<label class="field-shell flex w-full items-center bg-bg-950 pl-4 pr-4">
			<input
				type="text"
				class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
				placeholder="1"
				value={settings.numbering}
				oninput={(e) => patch({ numbering: e.currentTarget.value || "1" })}
				spellcheck="false"
				autocomplete="off"
			/>
		</label>
	</div>

	<div class="mt-[13px] grid grid-cols-2 gap-2">
		<FieldLabel label="Clearance">
			<Input
				value={settings.clearance}
				onchange={(v) => patch({ clearance: v })}
				unit="em"
				min={0}
				max={20}
				step={0.05}
				decimals={2}
			/>
		</FieldLabel>
		<FieldLabel label="Gap">
			<Input
				value={settings.gap}
				onchange={(v) => patch({ gap: v })}
				unit="em"
				min={0}
				max={20}
				step={0.05}
				decimals={2}
			/>
		</FieldLabel>
	</div>

	<div class="mt-[13px]">
		<FieldLabel label="Indent">
			<Input
				value={settings.indent}
				onchange={(v) => patch({ indent: v })}
				unit="em"
				min={0}
				max={20}
				step={0.05}
				decimals={2}
			/>
		</FieldLabel>
	</div>
</Popup>
