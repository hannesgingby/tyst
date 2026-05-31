<script lang="ts">
    import type { Snippet } from "svelte";
    import type { ClassValue } from "svelte/elements";

    export type DropdownPopupPlacement = "below" | "right";
    /** Horizontal alignment when `placement` is `below`. */
    export type DropdownPopupAlign = "stretch" | "start" | "end";
    /** Vertical alignment when `placement` is `right`. */
    export type DropdownPopupVerticalAlign = "start" | "center";

    interface Props {
        placement?: DropdownPopupPlacement;
        align?: DropdownPopupAlign;
        verticalAlign?: DropdownPopupVerticalAlign;
        searchable?: boolean;
        searchPlaceholder?: string;
        searchQuery?: string;
        class?: ClassValue;
        listClass?: ClassValue;
        maxHeightClass?: string;
        children: Snippet;
    }

    let {
        placement = "below",
        align = "stretch",
        verticalAlign = "start",
        searchable = false,
        searchPlaceholder = "Search…",
        searchQuery = $bindable(""),
        class: className,
        listClass,
        maxHeightClass = "max-h-60",
        children,
    }: Props = $props();

    const placementClass = $derived(
        placement === "right"
            ? [
                  "left-full ml-1",
                  verticalAlign === "center"
                      ? "top-1/2 -translate-y-1/2"
                      : "top-0",
              ].join(" ")
            : align === "end"
              ? "top-full right-0 mt-1 w-max"
              : align === "start"
                ? "top-full left-0 mt-1 w-max"
                : "top-full right-0 left-0 mt-1",
    );
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class={[
        "absolute z-10 min-w-[150px] overflow-hidden rounded-[6px] border border-border-checkbox-off bg-bg-850 shadow-tooltip",
        placementClass,
        className,
    ]}
    onpointerdown={(event) => event.stopPropagation()}
>
    {#if searchable}
        <div
            class="shrink-0 border-b border-border-checkbox-off px-2.5 py-2"
        >
            <input
                type="text"
                role="searchbox"
                autocomplete="off"
                spellcheck="false"
                bind:value={searchQuery}
                placeholder={searchPlaceholder}
                class="w-full border-none bg-transparent px-0.5 text-body-14-tight text-text-100 outline-none placeholder:text-text-250"
                onpointerdown={(event) => event.stopPropagation()}
                onclick={(event) => event.stopPropagation()}
            />
        </div>
    {/if}
    <div class={["overflow-y-auto", maxHeightClass, listClass]} role="listbox">
        {@render children()}
    </div>
</div>
