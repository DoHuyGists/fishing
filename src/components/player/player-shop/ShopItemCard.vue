<script setup lang="ts">
import type { ShopItem } from "../../../types/model/item";
import { getFormattingLocale, t as tr } from "../../../i18n";
import Cash from "../player-currency/Cash.vue";


defineProps<{
  item: ShopItem;
  selected: boolean;
  ownedQuantity: number;
  layout?: 'grid' | 'list';
}>();

const emit = defineEmits<{
  select: [id: string];
  preview: [image: { src: string; alt: string }];
}>();
</script>

<template>
  <button
    type="button"
    class="shop-item-card slide-fade-in from-bottom player-content-in group grid w-full min-w-0 overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    :aria-pressed="selected"
    :class="
      [selected ? 'border-accent ring-2 ring-accent/20' : 'border-border-default', { 'shop-item-card--list': layout === 'list' }]
    "
    @click="emit('select', item.id)"
  >
    <div class="shop-item-card__art relative grid min-w-0 place-items-center overflow-hidden bg-surface">
      <img
        v-if="item.image"
        :src="item.image"
        :alt="item.name"
        loading="lazy"
        class="absolute inset-0 block h-full w-full cursor-zoom-in object-contain p-4"
        :class="{ 'scale-[2.5]': item.category?.trim().toLocaleLowerCase() === 'hook' }"
        @click.stop="emit('preview', { src: item.image, alt: item.name })"
        draggable="false"
      />
      <span v-else class="text-5xl">{{ item.icon || "🎁" }}</span>
    </div>
    <div class="flex min-w-0 flex-col p-4">
      <div
        v-if="item.classification"
        class="m-0 text-[10px] font-bold uppercase tracking-wide text-content"
      >
        {{ item.classification }}
      </div>
      <div class="m-0 mt-1 line-clamp-2 text-base font-bold leading-snug" :title="item.name">{{ item.name }}</div>
      <div class="m-0 mt-1 line-clamp-2 text-xs text-content/65">{{ item.information }}</div>
      <div class="mt-3 text-xs">
        <span class="inline-block rounded-md border border-border-default bg-surface px-2 py-1 text-content">{{
          item.category || tr('ShopModal.vat_pham')
        }}</span>
      </div>
    </div>
    <div class="shop-item-card__footer min-w-0 space-y-3 border-t border-border-default bg-surface/60 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm font-medium text-content">{{ tr('ShopModal.don_gia') }}</span>
        <Cash :amount="item.price" :interactive="false" class="max-w-full text-base font-bold tabular-nums [&>span]:min-w-0 [&>span]:break-all [&>img]:shrink-0" />
      </div>
      <div class="grid grid-cols-2 gap-3 border-t border-border-default/60 pt-3 text-xs leading-relaxed text-content">
        <div class="min-w-0">
          <div>{{ tr('ShopModal.so_luong_moi_luot') }}</div>
          <div class="mt-1 text-sm font-semibold tabular-nums">{{ (item.quantity ?? 1).toLocaleString(getFormattingLocale()) }}</div>
        </div>
        <div class="min-w-0 border-l border-border-default pl-3">
          <div>{{ tr('ShopModal.dang_so_huu') }}</div>
          <div class="mt-1 text-sm font-semibold tabular-nums">{{ ownedQuantity.toLocaleString(getFormattingLocale()) }}</div>
        </div>
      </div>
    </div>
  </button>
</template>

<style scoped>
.shop-item-card {
  grid-template-rows: 10rem 1fr auto;
  align-content: start;
}

.shop-item-card__art {
  border-bottom: 1px solid var(--color-border);
}

.shop-item-card--list {
  grid-template-columns: 7rem minmax(0, 1fr);
  grid-template-rows: auto auto;
}

.shop-item-card--list .shop-item-card__art {
  min-height: 10rem;
  border-bottom: 0;
  border-right: 1px solid var(--color-border);
}

.shop-item-card__footer {
  grid-column: 1 / -1;
}

@media (min-width: 640px) {
  .shop-item-card--list { grid-template-columns: 10rem minmax(0, 1fr); }
}

html.ocean-theme .shop-item-card {
  border-color: var(--color-border);
  background: var(--color-white);
  color: var(--color-content);
  box-shadow: var(--shadow-xs);
}

html.ocean-theme .shop-item-card__art {
  background: var(--color-surface);
}

html.ocean-theme .shop-item-card:hover {
  border-color: var(--color-ocean-cyan);
  box-shadow: var(--shadow-md);
}

html.ocean-theme .shop-item-card[aria-pressed="true"] {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 15%, transparent), var(--shadow-sm);
}
</style>
