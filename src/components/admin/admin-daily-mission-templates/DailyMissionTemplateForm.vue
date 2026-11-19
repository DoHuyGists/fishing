<script setup lang="ts">
import { useAdminDailyMissionTemplateStore } from "./admin-daily-mission-templates-store";
const store = useAdminDailyMissionTemplateStore();
</script>

<template>
  <div v-if="store.isFormOpen" class="fixed inset-0 z-60 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Biểu mẫu nhiệm vụ" @click.self="store.closeForm()">
    <form class="flex h-full w-full max-w-xl flex-col bg-white text-[#24352a] shadow-xl" @submit.prevent="store.save()">
      <header class="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-900 bg-[#153221] p-5 text-white">
        <div class="text-lg font-bold">{{ store.form.id ? "Chỉnh sửa" : "Thêm mới" }} mẫu nhiệm vụ</div>
        <button type="button" aria-label="Đóng biểu mẫu" class="grid size-9 place-items-center rounded-lg border border-emerald-600 hover:bg-emerald-800 disabled:opacity-50" :disabled="store.isSaving" @click="store.closeForm()">✕</button>
      </header>
      <fieldset :disabled="store.isSaving" class="min-h-0 flex-1 space-y-5 overflow-y-auto bg-gray-50/60 p-5 text-sm">
        <label class="grid gap-2 text-xs font-semibold text-slate-600">Mã nhiệm vụ *<input v-model="store.form.code" required class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"  /></label>
<label class="grid gap-2 text-xs font-semibold text-slate-600">Tên nhiệm vụ *<input v-model="store.form.name" required class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"  /></label>
<label class="grid gap-2 text-xs font-semibold text-slate-600">Loại sự kiện *<input v-model="store.form.event_type" required class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"  /></label>
<label class="grid gap-2 text-xs font-semibold text-slate-600">Độ khó *<input v-model="store.form.difficulty" required class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" list="daily-mission-difficulties" /></label>
<datalist id="daily-mission-difficulties"><option value="EASY" /><option value="MEDIUM" /><option value="HARD" /></datalist>
<label class="grid gap-2 text-xs font-semibold text-slate-600">Mô tả<textarea v-model="store.form.description" rows="3" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" /></label>
<label class="grid gap-2 text-xs font-semibold text-slate-600">Mục tiêu *<input v-model.number="store.form.target_value" type="number" step="any" min="0"  required class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" /></label>
<label class="grid gap-2 text-xs font-semibold text-slate-600">Điểm nhiệm vụ *<input v-model.number="store.form.mission_points" type="number" step="1" min="1" max="2147483647" required class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" /></label>
<label class="grid gap-2 text-xs font-semibold text-slate-600">Trọng số *<input v-model.number="store.form.weight" type="number" step="1" min="0" max="2147483647" required class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" /></label>
<label class="grid gap-2 text-xs font-semibold text-slate-600">Cấu hình (object JSON) *<textarea v-model="store.form.config" rows="8" required spellcheck="false" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2.5 text-sm font-normal text-[#24352a] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 font-mono" /></label>
        <label class="flex items-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-sm font-medium"><input v-model="store.form.is_active" type="checkbox" /> Đang bật</label>
        <div v-if="store.formError" role="alert" class="rounded-lg bg-red-50 p-3 text-red-700">{{ store.formError }}</div>
      </fieldset>
      <footer class="flex shrink-0 justify-end gap-3 border-t border-[#cbd9c6] bg-white p-5">
        <button type="button" :disabled="store.isSaving" class="rounded-lg border border-[#cbd9c6] px-4 py-2 disabled:opacity-50" @click="store.closeForm()">Huỷ</button>
        <button type="submit" :disabled="store.isSaving" class="rounded-lg bg-[#153221] px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{{ store.isSaving ? "Đang lưu..." : "Lưu" }}</button>
      </footer>
    </form>
  </div>
</template>
