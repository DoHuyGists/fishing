<script lang="ts" setup>
import { computed, reactive, ref } from "vue";

export interface CrudOption {
  value: string;
  label: string;
}
export interface CrudField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "datetime" | "json";
  required?: boolean;
  readonly?: boolean;
  options?: CrudOption[];
}
export interface CrudColumn {
  key: string;
  label: string;
  format?: (row: any) => string;
}

const props = defineProps<{
  title: string;
  subtitle: string;
  icon: string;
  columns: CrudColumn[];
  fields: CrudField[];
  items: any[];
  loading: boolean;
  error: string;
  save: (payload: Record<string, unknown>, id: string | null) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}>();
const emit = defineEmits<{ (e: "close"): void; (e: "refresh"): void }>();

const search = ref("");
const isOpen = ref(false);
const editingId = ref<string | null>(null);
const form = reactive<Record<string, any>>({});
const formError = ref("");
const saving = ref(false);
const confirmDeleteId = ref<string | null>(null);
const actionError = ref("");

const rows = computed(() =>
  props.items.map((item) => ({
    item,
    cells: props.columns.map((c) => (c.format ? c.format(item) : String(item[c.key] ?? ""))),
  })),
);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((r) => r.cells.some((c) => c.toLowerCase().includes(q)));
});

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function readonlyDisplay(field: CrudField) {
  const v = form[field.key];
  if (field.type === "datetime") return v ? new Date(v).toLocaleString("vi-VN") : "";
  return v ?? "";
}

function openForm(item?: any) {
  formError.value = "";
  editingId.value = item?.id ?? null;
  for (const key of Object.keys(form)) delete form[key];
  for (const f of props.fields) {
    const raw = item ? item[f.key] : undefined;
    if (f.readonly) form[f.key] = raw ?? "";
    else if (f.type === "datetime") form[f.key] = toLocalInput(raw ?? null);
    else if (f.type === "json") form[f.key] = JSON.stringify(raw ?? {}, null, 2);
    else if (f.type === "number") form[f.key] = raw ?? null;
    else form[f.key] = raw ?? "";
  }
  isOpen.value = true;
}

function buildPayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of props.fields) {
    if (f.readonly) continue;
    const v = form[f.key];
    const empty = v === null || v === undefined || v === "";
    if (f.required && empty) throw new Error(`Vui lòng nhập "${f.label}"`);
    if (f.type === "number") payload[f.key] = empty ? null : Number(v);
    else if (f.type === "datetime") payload[f.key] = empty ? null : new Date(v).toISOString();
    else if (f.type === "json") {
      try {
        payload[f.key] = empty ? {} : JSON.parse(v);
      } catch {
        throw new Error(`"${f.label}" không phải JSON hợp lệ`);
      }
    } else payload[f.key] = empty ? null : typeof v === "string" ? v.trim() : v;
  }
  return payload;
}

async function submit() {
  formError.value = "";
  saving.value = true;
  try {
    await props.save(buildPayload(), editingId.value);
    isOpen.value = false;
  } catch (err) {
    formError.value = err instanceof Error ? err.message : "Không thể lưu dữ liệu";
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!confirmDeleteId.value) return;
  actionError.value = "";
  try {
    await props.remove(confirmDeleteId.value);
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : "Không thể xoá";
  } finally {
    confirmDeleteId.value = null;
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col bg-white">
    <div class="px-6 py-4 bg-[#153221] text-white flex items-center justify-between border-b border-emerald-800 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-700/60 border border-emerald-500/40 grid place-items-center text-xl">{{ icon }}</div>
        <div>
          <h2 class="m-0 text-lg font-extrabold tracking-wide">{{ title }}</h2>
          <p class="m-0 text-xs text-emerald-200">{{ subtitle }}</p>
        </div>
      </div>
      <button type="button" class="w-8 h-8 rounded-full border border-emerald-600/50 bg-emerald-900/50 text-white hover:bg-emerald-800 font-bold text-lg cursor-pointer" @click="emit('close')">&times;</button>
    </div>

    <div class="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 shrink-0">
      <input v-model="search" type="text" placeholder="Tìm kiếm..." class="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none" />
      <button type="button" class="px-3 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 text-xs font-bold cursor-pointer" @click="emit('refresh')">Làm mới</button>
      <button type="button" class="px-3 py-1.5 rounded-lg bg-[#153221] hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer" @click="openForm()">+ Thêm mới</button>
    </div>

    <div v-if="error || actionError" class="mx-6 mt-3 px-3 py-2 text-xs rounded-lg bg-red-50 border border-red-200 text-red-700">{{ error || actionError }}</div>

    <div class="flex-1 overflow-auto px-6 py-4">
      <div v-if="loading" class="text-sm text-gray-500">Đang tải...</div>
      <table v-else class="w-full text-xs border-collapse">
        <thead>
          <tr class="bg-gray-100 text-left text-gray-600">
            <th v-for="c in columns" :key="c.key" class="px-3 py-2 font-bold border-b border-gray-200">{{ c.label }}</th>
            <th class="px-3 py-2 border-b border-gray-200 w-40"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.item.id" class="hover:bg-gray-50 border-b border-gray-100">
            <td v-for="(cell, i) in r.cells" :key="i" class="px-3 py-2 text-gray-700">{{ cell }}</td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <template v-if="confirmDeleteId === r.item.id">
                <button type="button" class="px-2 py-1 rounded bg-red-600 text-white font-bold cursor-pointer" @click="confirmDelete">Xác nhận</button>
                <button type="button" class="ml-1 px-2 py-1 rounded border border-gray-300 cursor-pointer" @click="confirmDeleteId = null">Huỷ</button>
              </template>
              <template v-else>
                <button type="button" class="px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 font-bold cursor-pointer" @click="openForm(r.item)">Sửa</button>
                <button type="button" class="ml-1 px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 font-bold cursor-pointer" @click="confirmDeleteId = r.item.id">Xoá</button>
              </template>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td :colspan="columns.length + 1" class="px-3 py-6 text-center text-gray-400">Không có dữ liệu</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="isOpen" class="fixed inset-0 z-60 bg-black/40 grid place-items-center p-4">
      <form class="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl" @submit.prevent="submit">
        <div class="px-5 py-3 border-b border-gray-200 font-extrabold text-sm">{{ editingId ? "Cập nhật" : "Thêm mới" }} - {{ title }}</div>
        <div class="p-5 overflow-auto flex flex-col gap-3">
          <label v-for="f in fields" :key="f.key" class="flex flex-col gap-1 text-xs font-bold text-gray-600">
            <span>{{ f.label }}<span v-if="f.required && !f.readonly" class="text-red-500"> *</span></span>
            <input v-if="f.readonly" :value="readonlyDisplay(f)" disabled class="px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 font-normal" />
            <select v-else-if="f.type === 'select'" v-model="form[f.key]" class="px-2 py-1.5 border border-gray-300 rounded-lg font-normal bg-white">
              <option value="">-- Chọn --</option>
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <textarea v-else-if="f.type === 'json'" v-model="form[f.key]" rows="5" class="px-2 py-1.5 border border-gray-300 rounded-lg font-mono font-normal"></textarea>
            <input v-else-if="f.type === 'number'" v-model.number="form[f.key]" type="number" step="any" class="px-2 py-1.5 border border-gray-300 rounded-lg font-normal" />
            <input v-else-if="f.type === 'datetime'" v-model="form[f.key]" type="datetime-local" class="px-2 py-1.5 border border-gray-300 rounded-lg font-normal" />
            <input v-else v-model="form[f.key]" type="text" class="px-2 py-1.5 border border-gray-300 rounded-lg font-normal" />
          </label>
          <div v-if="formError" class="px-3 py-2 text-xs rounded-lg bg-red-50 border border-red-200 text-red-700">{{ formError }}</div>
        </div>
        <div class="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button type="button" class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold cursor-pointer" @click="isOpen = false">Huỷ</button>
          <button type="submit" :disabled="saving" class="px-3 py-1.5 rounded-lg bg-[#153221] text-white text-xs font-bold cursor-pointer disabled:opacity-50">{{ saving ? "Đang lưu..." : "Lưu" }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
