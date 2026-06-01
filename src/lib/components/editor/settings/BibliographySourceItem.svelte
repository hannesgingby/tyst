<script lang="ts">
	import Icon from "$lib/components/Icon.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import {
		SOURCE_TYPES,
		type BibliographySource,
	} from "$lib/document/bibliographySource";

	const FIELD_BG = "bg-bg-input-on-pure-white";
	const FIELD_ROW_CLASS = "grid items-center gap-x-10";
	const FIELD_ROW_STYLE = "grid-template-columns: minmax(0, 1fr) 300px";
	const FIELD_CLASS =
		"field-shell w-full border-none bg-bg-input-on-pure-white px-3 outline-none placeholder:text-text-250";

	interface Props {
		source: BibliographySource;
		label: string;
		onremove?: () => void;
	}

	let { source = $bindable(), label, onremove }: Props = $props();

	function toggleExpanded(): void {
		source.expanded = !source.expanded;
	}
</script>

<div class="flex items-start gap-2">
	<div class="flex min-w-0 flex-1 flex-col gap-3">
		<button
			type="button"
			class="field-shell flex w-full items-center gap-2 rounded-md px-3 text-left {FIELD_BG}"
			aria-expanded={source.expanded}
			onclick={toggleExpanded}
		>
			<span
				class="flex size-7 shrink-0 cursor-grab items-center justify-center text-text-200"
				aria-hidden="true"
			>
				<Icon
					name={source.expanded
						? "arrow-union-vertical"
						: "arrow-separate-vertical"}
					class="size-4"
				/>
			</span>

			<span class="min-w-0 flex-1 truncate text-body-14-tight text-text-100">
				{label}
			</span>

			<span class="chevron flex size-7 shrink-0 items-center justify-center text-text-200" class:open={source.expanded}>
				<Icon name="nav-arrow-down" class="size-4" />
			</span>
		</button>

		{#if source.expanded}
			<div class="flex flex-col gap-[18px]">
				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">
						Type<span aria-hidden="true"> *</span>
					</span>
					<DropdownMenu
						class="w-full"
						bg={FIELD_BG}
						bind:value={source.type}
						options={SOURCE_TYPES}
					/>
				</div>

				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">
						Title<span aria-hidden="true"> *</span>
					</span>
					<input
						type="text"
						class={FIELD_CLASS}
						bind:value={source.title}
						spellcheck="false"
					/>
				</div>

				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">
						Author(s)<span aria-hidden="true"> *</span>
					</span>
					<input
						type="text"
						class={FIELD_CLASS}
						bind:value={source.authors}
						spellcheck="false"
					/>
				</div>

				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">
						Date<span aria-hidden="true"> *</span>
					</span>
					<input
						type="text"
						class={FIELD_CLASS}
						bind:value={source.date}
						placeholder="yyyy-(mm)-(dd)"
						spellcheck="false"
					/>
				</div>

				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">Journal name</span>
					<input
						type="text"
						class={FIELD_CLASS}
						bind:value={source.journalName}
						spellcheck="false"
					/>
				</div>

				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">Volume</span>
					<input
						type="text"
						class={FIELD_CLASS}
						bind:value={source.volume}
						spellcheck="false"
					/>
				</div>

				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">Issue</span>
					<input
						type="text"
						class={FIELD_CLASS}
						bind:value={source.issue}
						spellcheck="false"
					/>
				</div>

				<div class={FIELD_ROW_CLASS} style={FIELD_ROW_STYLE}>
					<span class="text-right text-body-14 text-text-100">Page-range</span>
					<input
						type="text"
						class={FIELD_CLASS}
						bind:value={source.pageRange}
						spellcheck="false"
					/>
				</div>
			</div>
		{/if}
	</div>

	<button
		type="button"
		class="flex size-9 shrink-0 items-center justify-center rounded-md text-text-200 transition-colors duration-150 hover:bg-bg-800 hover:text-text-100"
		aria-label="Remove {label}"
		onclick={() => onremove?.()}
	>
		<Icon name="minus" class="size-4" />
	</button>
</div>

<style>
	.chevron {
		display: inline-flex;
		transform: rotate(0deg);
		transform-origin: center;
		transition: transform 300ms cubic-bezier(0.33, 1, 0.68, 1);
	}

	.chevron.open {
		transform: rotate(180deg);
	}
</style>
