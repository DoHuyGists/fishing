<script setup lang="ts">
import type { ShopItem } from "../../../types/model/item";
import { getFormattingLocale, t as tr } from "../../../i18n";


defineProps<{
  item: ShopItem;
  selected: boolean;
  ownedQuantity: number;
}>();

const emit = defineEmits<{
  select: [id: string];
  preview: [image: { src: string; alt: string }];
}>();
</script>

<template>
  <button
    type="button"
    class="shop-item-card slide-fade-in from-bottom player-content-in group flex w-full min-w-0 overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    :aria-pressed="selected"
    :class="
      selected ? 'border-emerald-700 ring-2 ring-emerald-700/20' : 'border-border-default'
    "
    @click="emit('select', item.id)"
  >
    <div class="shop-item-card__art grid h-40 aspect-square shrink-0 place-items-center overflow-hidden bg-surface">
      <img
        v-if="item.image"
        :src="item.image"
        :alt="item.name"
        loading="lazy"
        class="block h-full w-full cursor-zoom-in object-contain p-2"
        :class="{ 'scale-[2.5]': item.category?.trim().toLocaleLowerCase() === 'hook' }"
        @click.stop="emit('preview', { src: item.image, alt: item.name })"
        draggable="false"
      />
      <span v-else class="text-5xl">{{ item.icon || "🎁" }}</span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col p-3">
      <div
        v-if="item.classification"
        class="m-0 text-[10px] font-bold uppercase tracking-wide text-emerald-800"
      >
        {{ item.classification }}
      </div>
      <div class="m-0 truncate text-sm font-extrabold" :title="item.name">{{ item.name }}</div>
      <div class="m-0 mt-1 line-clamp-2 text-xs text-emerald-950/65">{{ item.information }}</div>
      <div
        class="mt-auto flex items-center justify-between gap-1 border-t border-border-default/70 pt-2 text-xs"
      >
        <span class="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-900">{{
          item.category || tr('ShopModal.vat_pham')
        }}</span>
        <strong class="whitespace-nowrap text-amber-700">{{ item.price.toLocaleString(getFormattingLocale()) }} {{ tr('currency.cashUnit') }}</strong>
      </div>
      <div class="m-0 mt-1 text-[10px] text-emerald-950/55">
        {{ tr('ShopModal.so_luong_moi_luot') }}: {{ (item.quantity ?? 1).toLocaleString(getFormattingLocale()) }}
      </div>
      <div class="m-0 mt-1 text-xs font-semibold text-emerald-800">
        {{ tr('ShopModal.dang_so_huu') }}: {{ ownedQuantity.toLocaleString(getFormattingLocale()) }}
      </div>
    </div>
  </button>
</template>

<style scoped>
html.ocean-theme .shop-item-card {
  border-color: color-mix(in srgb, var(--color-ocean-wood) 70%, var(--color-ocean-gold));
  background: var(--color-ocean-panel);
  color: var(--color-ocean-pearl);
  box-shadow: inset 0 1px 0 rgb(245 235 212 / 10%), 0 3px 8px rgb(0 0 0 / 15%);
}

html.ocean-theme .shop-item-card__art {
  background: radial-gradient(circle, color-mix(in srgb, var(--color-ocean-cyan) 18%, var(--color-ocean-panel)), var(--color-ocean-deep));
  border-right: 1px solid color-mix(in srgb, var(--color-ocean-gold) 32%, transparent);
}

html.ocean-theme .shop-item-card:hover {
  border-color: var(--color-ocean-cyan);
}

html.ocean-theme .shop-item-card[aria-pressed="true"] {
  border-color: var(--color-ocean-gold);
  box-shadow: 0 0 0 2px rgb(242 198 109 / 30%), inset 0 1px 0 rgb(245 235 212 / 15%);
}
</style>
