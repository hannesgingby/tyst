<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import Icon from "$lib/components/Icon.svelte";

	let outlined = $state(true);
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg p-3">
	<h3 class="text-body-14 font-[430] text-text-100">Numbering</h3>

	<div class="mt-[13px]">
		<button
			type="button"
			class="field-shell flex w-full items-center justify-between bg-bg-950 pl-4 pr-4"
		>
			<span class="text-text-250">None</span>
			<span class="text-text-250">ex. 1.a</span>
		</button>
	</div>

	<div class="mt-[13px]">
		<Checkbox label="Outlined" bind:checked={outlined} />
	</div>

	<button
		type="button"
		class="mt-8 ml-auto flex items-center gap-1 text-body-14-tight text-text-200 transition-colors duration-150 ease-out hover:text-text-150"
	>
		Style rules
		<Icon name="arrow-up-right" class="size-4" />
	</button>
</div>
