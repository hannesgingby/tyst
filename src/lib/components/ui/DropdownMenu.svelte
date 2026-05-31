<script lang="ts" generics="T extends string = string">
    import type { Snippet } from "svelte";
    import type { ClassValue } from "svelte/elements";
    import Icon from "$lib/components/Icon.svelte";
    import DropdownPopup, {
        type DropdownPopupAlign,
        type DropdownPopupPlacement,
        type DropdownPopupVerticalAlign,
    } from "$lib/components/ui/DropdownPopup.svelte";
    import {
        optionClass,
        optionIdleClass,
        optionSelectedClass,
    } from "$lib/components/ui/dropdownMenuStyles";

    interface Props {
        value: T;
        options?: readonly T[];
        disabled?: boolean;
        /** Background utility class for the field surface. */
        bg?: string;
        class?: ClassValue;
        popupClass?: ClassValue;
        /** Menu panel placement relative to the trigger. */
        placement?: DropdownPopupPlacement;
        /** Menu alignment when placed below the trigger. */
        align?: DropdownPopupAlign;
        /** Vertical alignment when placed to the right of the trigger. */
        verticalAlign?: DropdownPopupVerticalAlign;
        /** Max height utility for the scrollable option list. */
        maxHeightClass?: string;
        /** Show a filter field at the top of the menu. */
        searchable?: boolean;
        searchPlaceholder?: string;
        onchange?: (value: T) => void;
        menu?: Snippet;
        /** Custom trigger; receives `{ open, toggle }` so the caller can style as needed. */
        trigger?: Snippet<[{ open: boolean; toggle: () => void }]>;
        open?: boolean;
    }

    let {
        value = $bindable(),
        open = $bindable(false),
        options = [],
        disabled = false,
        bg = "bg-bg-950",
        class: className,
        popupClass,
        placement = "below",
        align = "stretch",
        verticalAlign = "start",
        maxHeightClass,
        searchable = false,
        searchPlaceholder = "Search…",
        onchange,
        menu,
        trigger,
    }: Props = $props();

    let root = $state<HTMLDivElement | null>(null);
    let searchQuery = $state("");

    const filteredOptions = $derived(
        searchable && searchQuery.trim() !== ""
            ? options.filter((o) =>
                  o.toLowerCase().includes(searchQuery.trim().toLowerCase()),
              )
            : options,
    );

    function toggle(): void {
        if (disabled) return;
        open = !open;
    }

    function select(option: T): void {
        value = option;
        onchange?.(option);
        open = false;
    }

    function onDocumentPointerDown(event: PointerEvent): void {
        if (!open || !root) return;
        const target = event.target;
        if (target instanceof Node && root.contains(target)) return;
        open = false;
    }

    $effect(() => {
        if (!open) searchQuery = "";
    });

    $effect(() => {
        if (!open) return;
        document.addEventListener("pointerdown", onDocumentPointerDown, true);
        return () =>
            document.removeEventListener(
                "pointerdown",
                onDocumentPointerDown,
                true,
            );
    });
</script>

<div class={["relative", className]} bind:this={root}>
    {#if trigger}
        {@render trigger({ open, toggle })}
    {:else}
        <button
            type="button"
            class={[
                "field-shell flex w-full items-center gap-2 pl-3 pr-3",
                bg,
                disabled && "pointer-events-none opacity-50",
            ]}
            aria-expanded={open}
            aria-haspopup="listbox"
            {disabled}
            onclick={toggle}
        >
            <span class="min-w-0 flex-1 truncate text-left">{value}</span>
            <span class="chevron" class:open>
                <Icon
                    name="nav-arrow-down"
                    class="size-4 shrink-0 text-text-150"
                />
            </span>
        </button>
    {/if}

    {#if open}
        <DropdownPopup
            {placement}
            {align}
            {verticalAlign}
            {searchable}
            {searchPlaceholder}
            {maxHeightClass}
            class={popupClass}
            bind:searchQuery
        >
            {#if menu}
                {@render menu()}
            {:else}
                {#each filteredOptions as option (option)}
                    <button
                        type="button"
                        class={[
                            optionClass,
                            option === value
                                ? optionSelectedClass
                                : optionIdleClass,
                        ]}
                        role="option"
                        aria-selected={option === value}
                        onclick={() => select(option)}
                    >
                        {option}
                    </button>
                {/each}
                {#if searchable && searchQuery.trim() !== "" && filteredOptions.length === 0}
                    <p class="px-3 py-4.5 text-body-14-tight text-text-250">
                        No results
                    </p>
                {/if}
            {/if}
        </DropdownPopup>
    {/if}
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
