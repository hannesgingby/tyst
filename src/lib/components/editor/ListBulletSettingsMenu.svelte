<script lang="ts">
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import FieldLabel from "$lib/components/ui/FieldLabel.svelte";
	import Input from "$lib/components/ui/Input.svelte";

	let spacing = $state<number | null>(null);
	let indent = $state(0);
	let bodyIndent = $state(0.5);
	let tight = $state(true);
</script>

<div class="shell relative z-[60] w-[324px] rounded-lg px-3 pt-3 pb-4">
	<div class="grid grid-cols-2 gap-2">
		<FieldLabel label="Marker">
			<button
				type="button"
				class="field-shell flex w-full items-center bg-bg-950 pl-4 pr-4 text-body-14-tight text-text-100"
			>
				--
			</button>
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

	<div class="mt-[13px] flex min-h-5 items-center">
		<Checkbox label="Tight" bind:checked={tight} />
	</div>
</div>
