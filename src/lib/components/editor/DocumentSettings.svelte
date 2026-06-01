<script lang="ts">
    import Icon from "$lib/components/Icon.svelte";
    import PagePanel from "./settings/PagePanel.svelte";
    import ReferencesPanel from "./settings/ReferencesPanel.svelte";

    interface Props {
        open?: boolean;
        section?: SectionId;
        onclose?: () => void;
    }

    let { open = $bindable(false), section = $bindable(undefined), onclose }: Props = $props();

    export type SectionId =
        | "metadata"
        | "page"
        | "references"
        | "format-groups"
        | "preferences";

    interface NavItem {
        id: SectionId;
        label: string;
        icon: string;
    }

    const navGroups: { heading: string; items: NavItem[] }[] = [
        {
            heading: "Document",
            items: [
                { id: "metadata", label: "Metadata", icon: "database" },
                { id: "page", label: "Page", icon: "empty-page" },
                { id: "references", label: "References", icon: "at-sign" },
                {
                    id: "format-groups",
                    label: "Format groups",
                    icon: "text-size",
                },
            ],
        },
        {
            heading: "Editor",
            items: [
                {
                    id: "preferences",
                    label: "Preferences",
                    icon: "preferences",
                },
            ],
        },
    ];

    let active = $state<SectionId>("page");

    $effect(() => {
        if (section) { active = section; section = undefined; }
    });

    function close(): void {
        open = false;
        onclose?.();
    }

    function onKeydown(event: KeyboardEvent): void {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
    }
</script>

<svelte:window onkeydown={open ? onKeydown : undefined} />

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay p-8"
        onclick={close}
    >
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
            class="flex h-full max-h-[880px] w-full max-w-[1320px] overflow-hidden rounded-xl border border-bg-700 bg-bg-950 shadow-[0_4px_40px_0_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-label="Document settings"
            tabindex="-1"
            onclick={(event) => event.stopPropagation()}
        >
            <!-- Sidebar -->
            <nav
                class="flex w-[228px] shrink-0 flex-col gap-5 bg-bg-800 p-2 m-1 rounded-md"
            >
                {#each navGroups as group (group.heading)}
                    <div class="flex flex-col gap-1 pt-3">
                        <span class="pl-1 pb-1 text-body-12 text-text-250"
                            >{group.heading}</span
                        >
                        {#each group.items as item (item.id)}
                            <button
                                type="button"
                                class={[
                                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-body-14 transition-colors duration-150",
                                    active === item.id
                                        ? "bg-bg-700 text-text-100"
                                        : "text-text-150 hover:bg-bg-800",
                                ]}
                                onclick={() => (active = item.id)}
                            >
                                <Icon
                                    name={item.icon}
                                    class="size-4 shrink-0"
                                />
                                {item.label}
                            </button>
                        {/each}
                    </div>
                {/each}
            </nav>

            <!-- Content -->
            <div class="relative min-w-0 flex-1 overflow-y-auto px-12 py-14">
                <button
                    type="button"
                    class="absolute top-6 right-6 flex size-7 items-center justify-center rounded-md text-text-200 transition-colors duration-150 hover:bg-bg-800 hover:text-text-100"
                    aria-label="Close"
                    onclick={close}
                >
                    <Icon name="xmark" class="size-4" />
                </button>

                <div class="mx-auto max-w-[702px]">
                    {#if active === "page"}
                        <PagePanel />
                    {:else if active === "references"}
                        <ReferencesPanel />
                    {:else}
                        <div
                            class="flex h-64 items-center justify-center text-body-14 text-text-200"
                        >
                            Coming soon.
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}
