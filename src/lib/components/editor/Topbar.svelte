<script lang="ts">
	import Icon from "$lib/components/Icon.svelte";
	import { documentStore } from "$lib/document/store.svelte";
	import { PAPER_PRESETS } from "$lib/document/paperSizes";
	import type { PaperPreset } from "$lib/document/types";

	interface Props {
		onMore?: () => void;
	}

	let { onMore }: Props = $props();

	const model = documentStore.model;
	const presetLabel = $derived(documentStore.defaultPage.preset);

	let presetMenuOpen = $state(false);

	function choosePreset(preset: PaperPreset): void {
		documentStore.setDefaultPreset(preset);
		presetMenuOpen = false;
	}

	$effect(() => {
		if (!presetMenuOpen) return;
		const close = () => (presetMenuOpen = false);
		window.addEventListener("pointerdown", close);
		return () => window.removeEventListener("pointerdown", close);
	});

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
		<div class="relative">
			<button
				type="button"
				class="{actionClass} gap-1"
				aria-haspopup="listbox"
				aria-expanded={presetMenuOpen}
				onclick={(event) => {
					event.stopPropagation();
					presetMenuOpen = !presetMenuOpen;
				}}
			>
				<span>{presetLabel}</span>
				<Icon
					name="nav-arrow-down"
					class="size-3.5 transition-[opacity,color] duration-150 ease-out {presetMenuOpen
						? 'opacity-100'
						: 'opacity-0 group-hover:opacity-100'}"
				/>
			</button>

			{#if presetMenuOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="absolute top-full right-0 z-50 mt-1 min-w-[140px] overflow-hidden rounded-md border border-border-checkbox-off bg-bg-950 py-1 shadow-tooltip"
					onpointerdown={(event) => event.stopPropagation()}
				>
					{#each PAPER_PRESETS as preset (preset)}
						<button
							type="button"
							class={[
								"flex w-full px-3 py-1.5 text-left text-body-14-tight transition-colors duration-150",
								preset === presetLabel ? "bg-bg-850 text-text-100" : "text-text-100 hover:bg-bg-850",
							]}
							onclick={() => choosePreset(preset)}
						>
							{preset}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<button type="button" class={actionClass} onclick={onMore}>More...</button>
	</div>
</div>
