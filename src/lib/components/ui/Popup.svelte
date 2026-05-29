<script lang="ts">
    import type { Snippet } from "svelte";
    import type { ClassValue } from "svelte/elements";

    export type PopupPadding = 16 | 12 | 8;

    interface Props {
        children: Snippet;
        padding?: PopupPadding;
        class?: ClassValue;
    }

    let { children, padding = 16, class: className }: Props = $props();

    const paddingClass = $derived(
        padding === 16 ? "p-4" : padding === 12 ? "p-3" : "p-2",
    );
</script>

<div class={["shell rounded-lg my-4 mx-6", paddingClass, className]}>
    {@render children()}
</div>
