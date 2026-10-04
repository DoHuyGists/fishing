<script lang="ts" setup>
import { onUnmounted, ref, watch } from 'vue'
import { useModalStore } from '../stores/modal';

const props = withDefaults(
    defineProps<{ 
        title?: string;
        subTitle?: string;
        canRefresh?: boolean;
    }>(),
    {
        title: "",
        subTitle: "",
        canRefresh: true,
    }
)
const emit = defineEmits<{
  refresh: []
}>()

const modalStore = useModalStore();
const REFRESH_COOLDOWN = 5;
const isRefreshing = ref<boolean>(false);
const refreshCooldown = ref(0)

function handleRefresh() {
    emit("refresh")
    isRefreshing.value = true;
    refreshCooldown.value = REFRESH_COOLDOWN;
}

let status : number | undefined = undefined;
let cooldown : number | undefined = undefined;
watch(isRefreshing, (refreshing) => {
    if (refreshing) {
        status = setTimeout(() => {
            isRefreshing.value = false;
        }, REFRESH_COOLDOWN * 1000);
        cooldown = setInterval(() => {
            refreshCooldown.value--;
        }, 1000)
    } else {
        if (status) clearTimeout(status)
        if (cooldown) clearInterval(cooldown)

        status = undefined
        cooldown = undefined
    }
})

onUnmounted(() => {
    if (status) clearTimeout(status)
    if (cooldown) clearInterval(cooldown)
})

</script>

<template>
    <div class="fixed w-screen h-screen inset-0 z-[9999] bg-white flex flex-col">
        <header
            class="flex items-center justify-between gap-4 px-5 py-4 sm:px-7 border-b border-emerald-950/10 bg-[#e7ecda]">
            <div>
                <p class="m-0 text-[10px] font-extrabold tracking-[0.14em] uppercase text-emerald-800">{{ props.title }}</p>
                <h2 class="m-0 mt-1 text-xl sm:text-2xl font-bold">{{ props.subTitle }}</h2>
            </div>
            <div class="flex items-center gap-2">
                <button v-if="props.canRefresh" type="button"
                    class="px-3 py-2 rounded-md border border-emerald-900/15 bg-white/70 text-sm font-bold text-emerald-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isRefreshing" @click="handleRefresh">
                    <span aria-hidden="true" class="mr-1">↻</span>{{ isRefreshing ? `${refreshCooldown}s` : "Làm mới" }}
                </button>
                <button type="button"
                    class="w-9 h-9 rounded-full border border-emerald-900/15 bg-white/70 text-emerald-950 hover:bg-white text-2xl leading-none cursor-pointer"
                    aria-label="Đóng" @click="modalStore.close">
                    &times;
                </button>
            </div>
        </header>
        <div class="grow">
            <slot></slot>
        </div>
    </div>
</template>