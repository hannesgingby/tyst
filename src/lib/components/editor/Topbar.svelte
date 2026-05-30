<script lang="ts">
	import Icon from "$lib/components/Icon.svelte";
	import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import { PAPER_PRESETS } from "$lib/document/paperSizes";
	import type { PaperPreset } from "$lib/document/types";

	interface Props {
		onMore?: () => void;
	}

	let { onMore }: Props = $props();

	const model = documentStore.model;
	let preset = $derived(documentStore.defaultPage.preset);

	let isEditing = $state(false);
	let editValue = $state("");
	let inputEl = $state<HTMLInputElement | null>(null);

	const actionClass =
		"text-body-14 flex items-center text-text-250 transition-colors duration-150 ease-out hover:text-text-100";

	function startEditing() {
		editValue = model.name;
		isEditing = true;
		queueMicrotask(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	function commitEdit() {
		const trimmed = editValue.trim();
		if (trimmed) model.name = trimmed;
		isEditing = false;
	}

	function cancelEdit() {
		isEditing = false;
	}

	function onNameKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			commitEdit();
		} else if (event.key === "Escape") {
			event.preventDefault();
			cancelEdit();
		}
	}
</script>

{#snippet action(label: string, icon?: string)}
	<button
		type="button"
		class={[actionClass, icon && "gap-1.5"]}
	>
		{#if icon}
			<Icon name={icon} class="size-4 shrink-0" />
		{/if}
		{label}
	</button>
{/snippet}

<div class="group flex h-5 w-full items-center justify-between pb-3 pl-0.5 pr-1">
	<div class="min-w-0 flex-1">
		{#if isEditing}
			<input
				bind:this={inputEl}
				bind:value={editValue}
				type="text"
				class="text-body-14 w-full border-none bg-transparent p-0 text-text-100 outline-none"
				onkeydown={onNameKeydown}
				onblur={commitEdit}
			/>
		{:else}
			<button
				type="button"
				class="{actionClass} truncate text-left"
				onclick={startEditing}
			>
				{model.name}
			</button>
		{/if}
	</div>

	<div class="flex shrink-0 items-center gap-6">
		{@render action("Header", "plus")}
		{@render action("Footer", "plus")}
		<DropdownMenu
			bind:value={preset}
			options={PAPER_PRESETS}
			placement="below"
			align="end"
			popupClass="z-50 min-w-[140px]"
			onchange={(value: PaperPreset) => documentStore.setDefaultPreset(value)}
		>
			{#snippet trigger({ open, toggle })}
				<button
					type="button"
					class="{actionClass} gap-1"
					aria-haspopup="listbox"
					aria-expanded={open}
					onclick={(event) => {
						event.stopPropagation();
						toggle();
					}}
				>
					<span>{preset}</span>
					<Icon
						name="nav-arrow-down"
						class="size-3.5 transition-[opacity,color] duration-150 ease-out {open
							? 'opacity-100'
							: 'opacity-0 group-hover:opacity-100'}"
					/>
				</button>
			{/snippet}
		</DropdownMenu>
		<button type="button" class={actionClass} onclick={onMore}>More...</button>
	</div>
</div>
