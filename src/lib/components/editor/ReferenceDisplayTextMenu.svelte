<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import PopupSectionHeader from "$lib/components/ui/PopupSectionHeader.svelte";

	interface Props {
		value?: string;
		pageForm?: boolean;
	}

	let { value = $bindable(""), pageForm = $bindable(false) }: Props = $props();
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg p-3">
	<PopupSectionHeader title="Display text" />

	<div class="mt-[13px]">
		<label class="field-shell flex h-9 w-full items-center bg-bg-950 pl-4 pr-4">
			<input
				type="text"
				class="h-full w-full border-none bg-transparent text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
				placeholder="Display text"
				bind:value
				spellcheck="false"
				autocomplete="off"
			/>
		</label>
	</div>

	<div class="mt-3">
		<Checkbox label="Page form" bind:checked={pageForm} />
	</div>
</div>
