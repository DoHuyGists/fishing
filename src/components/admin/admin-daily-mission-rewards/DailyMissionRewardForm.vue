<script setup lang="ts">
import { useAdminDailyMissionRewardStore } from "./admin-daily-mission-rewards-store";
const store = useAdminDailyMissionRewardStore();
</script>

<template>
  <div v-if="store.isFormOpen" class="fixed inset-0 z-60 flex justify-end bg-content/40" role="dialog" aria-modal="true" aria-label="Biểu mẫu phần thưởng" @click.self="store.closeForm()">
    <form class="flex h-full w-full max-w-xl flex-col bg-white text-content shadow-xl" @submit.prevent="store.save()">
      <header class="flex shrink-0 items-center justify-between gap-3 border-b border-accent bg-content-strong p-5 text-white">
        <div class="text-lg font-bold">{{ store.form.id ? "Chỉnh sửa" : "Thêm mới" }} phần thưởng</div>
        <button type="button" aria-label="Đóng biểu mẫu" class="grid size-9 place-items-center rounded-lg border border-accent hover:bg-accent disabled:opacity-50" :disabled="store.isSaving" @click="store.closeForm()">✕</button>
      </header>
      <fieldset :disabled="store.isSaving" class="min-h-0 flex-1 space-y-5 overflow-y-auto bg-white/60 p-5 text-sm">
        <label class="grid gap-2 text-xs font-semibold text-content">Mốc điểm *<input v-model.number="store.form.required_points" type="number" min="1" max="2147483647" step="1" required class="rounded-lg border border-border-default bg-white px-3 py-2.5 text-sm font-normal text-content focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15" /></label>
<label class="grid gap-2 text-xs font-semibold text-content">Phần thưởng (mảng JSON) *<textarea v-model="store.form.reward_data" rows="12" required spellcheck="false" class="rounded-lg border border-border-default bg-white px-3 py-2.5 text-sm font-normal text-content focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 font-mono" /></label>
        <label class="flex items-center gap-2 rounded-lg border border-border-default bg-surface p-3 text-sm font-medium"><input v-model="store.form.is_active" type="checkbox" /> Đang bật</label>
        <div v-if="store.formError" role="alert" class="rounded-lg bg-surface p-3 text-danger">{{ store.formError }}</div>
      </fieldset>
      <footer class="flex shrink-0 justify-end gap-3 border-t border-border-default bg-white p-5">
        <button type="button" :disabled="store.isSaving" class="rounded-lg border border-border-default px-4 py-2 disabled:opacity-50" @click="store.closeForm()">Huỷ</button>
        <button type="submit" :disabled="store.isSaving" class="rounded-lg bg-content-strong px-5 py-2.5 text-sm font-bold text-white hover:bg-accent disabled:opacity-50">{{ store.isSaving ? "Đang lưu..." : "Lưu" }}</button>
      </footer>
    </form>
  </div>
</template>
