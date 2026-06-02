<script lang="ts">
    import type { Snippet } from "svelte";
    import type { ClassValue } from "svelte/elements";

    export type DropdownPopupPlacement = "below" | "right";
    /** Horizontal alignment when `placement` is `below`. */
    export type DropdownPopupAlign = "stretch" | "start" | "end";
    /** Vertical alignment when `placement` is `right`. */
    export type DropdownPopupVerticalAlign = "start" | "center" | "end";

    interface Props {
        placement?: DropdownPopupPlacement;
        align?: DropdownPopupAlign;
        verticalAlign?: DropdownPopupVerticalAlign;
        searchable?: boolean;
        searchPlaceholder?: string;
        searchQuery?: string;
        /** When set, overrides absolute positioning with fixed positioning (for overflow-escape). */
        fixedStyle?: string;
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
        fixedStyle = "",
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

    let scrollEl = $state<HTMLElement | null>(null);
    let showScrollFade = $state(false);

    function updateScrollFade(): void {
        if (!scrollEl) { showScrollFade = false; return; }
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        showScrollFade =
            scrollHeight > clientHeight + 1 &&
            scrollTop + clientHeight < scrollHeight - 1;
    }

    $effect(() => {
        const el = scrollEl;
        if (!el) return;
        updateScrollFade();
        el.addEventListener("scroll", updateScrollFade, { passive: true });
        const ro = new ResizeObserver(() => updateScrollFade());
        ro.observe(el);
        return () => {
            el.removeEventListener("scroll", updateScrollFade);
            ro.disconnect();
        };
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class={[
        "z-10 min-w-[150px] overflow-hidden rounded-[6px] border border-border-checkbox-off bg-bg-850 shadow-tooltip",
        fixedStyle ? "fixed" : ["absolute", placementClass],
        className,
    ]}
    style={fixedStyle || undefined}
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
    <div bind:this={scrollEl} class={["overflow-y-auto", maxHeightClass, listClass]} role="listbox">
        {@render children()}
    </div>
    {#if showScrollFade}
        <div class="scroll-fade pointer-events-none absolute inset-x-0 bottom-0 h-6" aria-hidden="true"></div>
    {/if}
</div>

<style>
    .scroll-fade {
        background: linear-gradient(
            to top,
            var(--color-bg-850) 0%,
            color-mix(in srgb, var(--color-bg-850) 65%, transparent) 45%,
            transparent 100%
        );
    }
</style>
