<script lang="ts">
    import Icon from "$lib/components/Icon.svelte";

    export type TagVariant = "purple" | "blue";

    const slotWidth: Record<TagVariant, string> = {
        purple: "73px",
        blue: "63px",
    };

    interface Props {
        label: string;
        variant: TagVariant;
        linked?: boolean;
        onUnlink?: () => void;
        onLink?: () => void;
    }

    let {
        label,
        variant,
        linked = $bindable(true),
        onUnlink,
        onLink,
    }: Props = $props();

    function unlink(): void {
        linked = false;
        onUnlink?.();
    }

    function link(): void {
        linked = true;
        onLink?.();
    }
</script>

<div class="relative ml-auto h-5 shrink-0" style:width={slotWidth[variant]}>
    {#if linked}
        <button
            type="button"
            class={[
                "absolute top-0 right-0 flex h-5 items-center gap-1 rounded px-2 text-body-12",
                variant === "purple" && "bg-tag-purple-bg text-tag-purple-text",
                variant === "blue" && "bg-tag-blue-bg text-tag-blue-text",
            ]}
            onclick={unlink}
        >
            {label}
            <Icon name="link-xmark" class="size-4 shrink-0" />
        </button>
    {:else}
        <button
            type="button"
            class="absolute top-0.5 right-0 flex size-4 items-center justify-center text-icon transition-colors duration-150 ease-out hover:text-text-200"
            aria-label="Link {label}"
            onclick={link}
        >
            <Icon name="link" class="size-4" />
        </button>
    {/if}
</div>
