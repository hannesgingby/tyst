<script lang="ts">
    import Document from "./Document.svelte";
    import Toolbar from "./Toolbar.svelte";
    import Topbar from "./Topbar.svelte";
</script>

<div class="fixed inset-0 flex flex-col overflow-hidden bg-bg-900">
    <main
        class="flex min-h-0 flex-1 flex-col items-center overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-28"
    >
        <div
            class="flex w-full max-w-[1240px] flex-col"
            style="padding-top: clamp(2rem, 9vh, 5.625rem);"
        >
            <Topbar />
            <Document />
        </div>
    </main>
    <Toolbar />
</div>
