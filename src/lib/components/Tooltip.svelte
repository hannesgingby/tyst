<script lang="ts">
    import type { ClassValue } from "svelte/elements";
    import type { Snippet } from "svelte";

    type Position = "top" | "bottom" | "left" | "right";

    interface Props {
        children: Snippet;
        label: string;
        shortcut?: string;
        position?: Position;
        openDelay?: number;
        disabled?: boolean;
        class?: ClassValue;
    }

    let {
        children,
        label,
        shortcut,
        position = "top",
        openDelay = 120,
        disabled = false,
        class: className,
    }: Props = $props();

    let open = $state(false);
    let openTimeout: ReturnType<typeof setTimeout> | null = null;

    function show(): void {
        if (disabled) return;
        if (openTimeout) clearTimeout(openTimeout);
        openTimeout = setTimeout(() => {
            open = true;
            openTimeout = null;
        }, openDelay);
    }

    function hide(): void {
        if (openTimeout) {
            clearTimeout(openTimeout);
            openTimeout = null;
        }
        open = false;
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (event.key === "Escape") hide();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class={["relative inline-flex", className]}
    onmouseenter={show}
    onmouseleave={hide}
    onfocusin={show}
    onfocusout={hide}
    onkeydown={handleKeydown}
    onclick={hide}
>
    {@render children()}

    <div
        role="tooltip"
        class={[
            "pointer-events-none absolute z-[60] inline-flex items-center gap-x-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs font-medium text-bg-900 shadow-tooltip transition-all duration-150",
            {
                "left-1/2 bottom-full -translate-x-1/2 mb-1.5":
                    position === "top",
                "left-1/2 top-full -translate-x-1/2 mt-1.5":
                    position === "bottom",
                "right-full top-1/2 -translate-y-1/2 mr-1.5":
                    position === "left",
                "left-full top-1/2 -translate-y-1/2 ml-1.5":
                    position === "right",
                "scale-100 opacity-100": open,
                "scale-95 opacity-0": !open,
            },
        ]}
    >
        <span>{label}</span>
        {#if shortcut}
            <span class="text-text-200">{shortcut}</span>
        {/if}
    </div>
</div>
