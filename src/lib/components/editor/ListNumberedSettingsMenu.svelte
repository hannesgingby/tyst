<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";

	let start = $state<number | null>(null);
	let spacing = $state<number | null>(null);
	let indent = $state(0);
	let bodyIndent = $state(0.5);
	let tight = $state(true);
	let full = $state(false);
	let reversed = $state(false);
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg px-3 pt-3 pb-4">
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

	<div class="mt-[13px] grid grid-cols-2 gap-2">
		<FieldLabel label="Start">
			<Input bind:value={start} emptyLabel="Auto" min={1} max={9999} step={1} decimals={0} />
		</FieldLabel>
		<FieldLabel label="Spacing">
			<Input bind:value={spacing} emptyLabel="Auto" unit="em" min={0} max={10} step={0.1} decimals={1} />
		</FieldLabel>
		<FieldLabel label="Indent">
			<Input bind:value={indent} unit="pt" min={0} max={720} step={1} decimals={0} />
		</FieldLabel>
		<FieldLabel label="Body indent">
			<Input bind:value={bodyIndent} unit="em" min={0} max={10} step={0.1} decimals={1} />
		</FieldLabel>
	</div>

	<div class="mt-[13px] flex min-h-5 flex-wrap items-center gap-x-4 gap-y-2">
		<Checkbox label="Tight" bind:checked={tight} />
		<Checkbox label="Full" bind:checked={full} />
		<Checkbox label="Reversed" bind:checked={reversed} />
	</div>
</div>
