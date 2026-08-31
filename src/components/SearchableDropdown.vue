<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { EquipmentVariant } from "../data/equipmentCatalog";

const props = defineProps<{
  options: EquipmentVariant[];
  modelValue: string;
}>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

const open = ref(false);
const search = ref("");
const root = ref<HTMLElement | null>(null);

const selected = computed(() => props.options.find((o) => o.id === props.modelValue) ?? null);
const filteredOptions = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return props.options;
  return props.options.filter((o) => o.name.toLowerCase().includes(term) || o.detail.toLowerCase().includes(term));
});

function isImageIcon(icon: string) {
  return icon.startsWith("/") || icon.startsWith("http");
}
function toggleOpen() {
  open.value = !open.value;
  if (open.value) search.value = "";
}
function pick(variant: EquipmentVariant) {
  emit("update:modelValue", variant.id);
  open.value = false;
}
function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener("mousedown", onClickOutside));
onBeforeUnmount(() => document.removeEventListener("mousedown", onClickOutside));
watch(open, (value) => {
  if (!value) search.value = "";
});
</script>

<template>
  <div ref="root" class="relative flex-1 min-w-0">
    <button
      type="button"
      class="flex items-center gap-2 w-full px-2 py-1.5 rounded-[9px] border border-[#d9d2c2] bg-[#fbf8f0] text-[#345344] text-left cursor-pointer outline-none focus:border-[#9fc17a]"
      :class="{ 'border-[#9fc17a]': open }"
      @click.stop="toggleOpen"
    >
      <span class="flex-none grid place-items-center w-5 h-5 text-sm">
        <img
          v-if="selected && isImageIcon(selected.icon)"
          :src="selected.icon"
          :alt="selected.name"
          class="w-full h-full object-cover rounded-[5px]"
        />
        <template v-else>{{ selected?.icon ?? "❔" }}</template>
      </span>
      <span class="flex-1 min-w-0 flex flex-col leading-tight">
        <strong class="text-[11px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{{
          selected?.name ?? "Chọn trang bị"
        }}</strong>
        <small class="text-[10px] text-[#6c7d6e] whitespace-nowrap overflow-hidden text-ellipsis">{{
          selected?.detail
        }}</small>
      </span>
      <span class="flex-none text-[10px] text-[#6c7d6e]">▾</span>
    </button>
    <div
      v-if="open"
      class="absolute w-fit z-20 bottom-[calc(100%+4px)] left-0 right-0 flex flex-col gap-1.5 p-2 rounded-[10px] border border-[#d9d2c2] bg-[#fffefa] shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
      @click.stop
    >
      <input
        v-model="search"
        type="text"
        class="px-2 py-1.5 rounded-lg border border-[#d9d2c2] bg-[#fbf8f0] text-[#345344] text-[11px] outline-none focus:border-[#9fc17a]"
        placeholder="Tìm kiếm..."
        autofocus
      />
      <ul class="max-h-[200px] overflow-y-auto flex flex-col gap-0.5 m-0 p-0">
        <li v-if="!filteredOptions.length" class="p-2 text-[11px] text-center">
          Không tìm thấy kết quả
        </li>
        <li
          v-for="variant in filteredOptions"
          :key="variant.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#eef8e9]"
          :class="{ 'bg-[#eef8e9] shadow-[inset_0_0_0_1px_#b9dba7]': variant.id === modelValue }"
          @click="pick(variant)"
        >
          <span class="flex-none grid place-items-center w-5 h-5 text-sm">
            <img
              v-if="isImageIcon(variant.icon)"
              :src="variant.icon"
              :alt="variant.name"
              class="w-full h-full object-cover rounded-[5px]"
            />
            <template v-else>{{ variant.icon }}</template>
          </span>
          <span class="flex-1 min-w-0 flex flex-col leading-tight text-black">
            <strong class="text-[11px] font-bold whitespace-nowrap">{{
              variant.name
            }}</strong>
            <small class="text-[10px] whitespace-nowrap">{{
              variant.detail
            }}</small>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
