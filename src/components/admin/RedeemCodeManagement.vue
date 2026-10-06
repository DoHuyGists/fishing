<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { supabaseRedeemCodeRepository, type RedeemCodePayload, type RedeemCodeRow } from "../../data/supabaseRedeemCodeRepository";

const emit = defineEmits(["close"]);
const codes = ref<RedeemCodeRow[]>([]);
const search = ref("");
const statusFilter = ref<"ALL" | "ACTIVE" | "DISABLED" | "EXPIRED">("ALL");
const isLoading = ref(false);
const loadError = ref("");
const isFormOpen = ref(false);
const isSaving = ref(false);
const formError = ref("");
const deletingId = ref<string | null>(null);
const updatingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

const emptyForm = () => ({ id: null as string | null, code: "", cash: "", expiresAt: "", isDisabled: false });
const form = reactive(emptyForm());

const filteredCodes = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase();
  const now = Date.now();
  return codes.value.filter((item) => {
    const matchesSearch = !keyword || item.code.toLocaleLowerCase().includes(keyword);
    const expired = item.expiresAt !== null && new Date(item.expiresAt).getTime() <= now;
    const matchesStatus = statusFilter.value === "ALL" ||
      (statusFilter.value === "ACTIVE" && !item.isDisabled && !expired) ||
      (statusFilter.value === "DISABLED" && item.isDisabled) ||
      (statusFilter.value === "EXPIRED" && expired);
    return matchesSearch && matchesStatus;
  });
});

async function loadCodes() {
  isLoading.value = true;
  loadError.value = "";
  try {
    codes.value = await supabaseRedeemCodeRepository.fetchAll();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Không thể tải danh sách mã đổi thưởng";
  } finally {
    isLoading.value = false;
  }
}

function openCreateForm() {
  Object.assign(form, emptyForm());
  formError.value = "";
  isFormOpen.value = true;
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function openEditForm(item: RedeemCodeRow) {
  Object.assign(form, {
    id: item.id,
    code: item.code,
    cash: String(item.cash),
    expiresAt: toDateTimeLocal(item.expiresAt),
    isDisabled: item.isDisabled,
  });
  formError.value = "";
  isFormOpen.value = true;
}

function closeForm() {
  isFormOpen.value = false;
  formError.value = "";
}

function buildPayload(): RedeemCodePayload | null {
  const code = form.code.trim();
  const cash = Number(form.cash);
  if (!code) {
    formError.value = "Mã đổi thưởng là bắt buộc";
    return null;
  }
  if (!Number.isSafeInteger(cash) || cash <= 0) {
    formError.value = "Tiền thưởng phải là số nguyên dương hợp lệ";
    return null;
  }

  const expiresAt = form.expiresAt ? new Date(form.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    formError.value = "Thời hạn không hợp lệ";
    return null;
  }

  return {
    code,
    cash,
    is_disabled: form.isDisabled,
    expires_at: expiresAt?.toISOString() ?? null,
  };
}

async function handleSave() {
  formError.value = "";
  const payload = buildPayload();
  if (!payload) return;

  isSaving.value = true;
  try {
    if (form.id) await supabaseRedeemCodeRepository.update(form.id, payload);
    else await supabaseRedeemCodeRepository.create(payload);
    closeForm();
    await loadCodes();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Không thể lưu mã đổi thưởng";
  } finally {
    isSaving.value = false;
  }
}

async function toggleEnabled(item: RedeemCodeRow) {
  updatingId.value = item.id;
  loadError.value = "";
  try {
    await supabaseRedeemCodeRepository.update(item.id, {
      code: item.code,
      cash: item.cash,
      is_disabled: !item.isDisabled,
      expires_at: item.expiresAt,
    });
    await loadCodes();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Không thể cập nhật trạng thái mã";
  } finally {
    updatingId.value = null;
  }
}

async function handleDelete() {
  if (!confirmDeleteId.value) return;
  deletingId.value = confirmDeleteId.value;
  try {
    await supabaseRedeemCodeRepository.delete(confirmDeleteId.value);
    confirmDeleteId.value = null;
    await loadCodes();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Không thể xoá mã đổi thưởng";
  } finally {
    deletingId.value = null;
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Không hết hạn";
}

function isExpired(item: RedeemCodeRow) {
  return item.expiresAt !== null && new Date(item.expiresAt).getTime() <= Date.now();
}

onMounted(loadCodes);
</script>

<template>
	<div class="fixed inset-0 z-50 flex flex-col bg-gray-50">
		<header class="flex shrink-0 items-center justify-between gap-4 border-b border-emerald-900 bg-[#153221] px-5 py-4 text-white md:px-7">
			<div class="flex min-w-0 items-center gap-3">
				<div class="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-800 text-xl">🎟️</div>
				<div class="min-w-0"><h2 class="m-0 text-lg font-extrabold">Quản lý mã đổi thưởng</h2><p class="m-0 text-xs text-emerald-200">{{ codes.length }} mã trong danh sách</p></div>
			</div>
			<button type="button" title="Đóng" aria-label="Đóng" class="grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-600 bg-emerald-900/50 text-xl hover:bg-emerald-800" @click="emit('close')">&times;</button>
		</header>

		<div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
			<div class="min-w-55 flex-1"><input v-model="search" type="search" placeholder="Tìm mã đổi thưởng..." class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none" /></div>
			<label class="flex items-center gap-2 text-xs font-semibold text-gray-600">Trạng thái
				<select v-model="statusFilter" class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700">
					<option value="ALL">Tất cả</option><option value="ACTIVE">Đang bật</option><option value="DISABLED">Đang tắt</option><option value="EXPIRED">Đã hết hạn</option>
				</select>
			</label>
			<div class="ml-auto flex items-center gap-2">
				<span class="hidden text-xs text-gray-500 sm:inline">{{ filteredCodes.length }} kết quả</span>
				<button type="button" title="Làm mới danh sách" class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50" :disabled="isLoading" @click="loadCodes"><svg class="size-4" :class="{ 'animate-spin': isLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
				<button type="button" class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800" @click="openCreateForm">+ Thêm mã</button>
			</div>
		</div>

		<main class="relative flex min-h-0 flex-1">
			<section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
				<div v-if="loadError" class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{{ loadError }}</span><button type="button" class="font-bold underline" @click="loadCodes">Thử lại</button></div>
				<div v-if="isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">Đang tải danh sách mã...</div>
				<div v-else-if="!filteredCodes.length" class="grid min-h-64 place-items-center text-center text-sm text-gray-500"><div><span class="mb-2 block text-3xl">🎟️</span>{{ codes.length ? 'Không tìm thấy mã phù hợp.' : 'Chưa có mã đổi thưởng nào.' }}</div></div>
				<div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
					<table class="w-full min-w-220 border-separate border-spacing-0 text-left text-sm">
						<thead class="text-[11px] uppercase text-gray-600"><tr><th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Mã</th><th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Phần thưởng</th><th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Trạng thái</th><th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Hạn dùng</th><th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Ngày tạo</th><th class="sticky top-0 z-10 bg-gray-100 px-4 py-3 text-right">Thao tác</th></tr></thead>
						<tbody><tr v-for="item in filteredCodes" :key="item.id" class="border-t border-gray-100 hover:bg-emerald-50/40">
							<td class="px-4 py-3"><span class="rounded bg-gray-100 px-2 py-1 font-mono font-bold text-gray-800">{{ item.code }}</span></td>
							<td class="whitespace-nowrap px-4 py-3 font-semibold text-emerald-800">{{ item.cash.toLocaleString('vi-VN') }} xu</td>
							<td class="px-4 py-3"><span class="rounded-full border px-2.5 py-1 text-xs font-semibold" :class="item.isDisabled ? 'border-gray-200 bg-gray-100 text-gray-600' : isExpired(item) ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'">{{ item.isDisabled ? 'Đang tắt' : isExpired(item) ? 'Đã hết hạn' : 'Đang bật' }}</span></td>
							<td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ formatDate(item.expiresAt) }}</td><td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ new Date(item.createdAt).toLocaleString('vi-VN') }}</td>
							<td class="px-4 py-3"><div class="flex justify-end gap-2"><button type="button" class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50" :disabled="updatingId === item.id" @click="toggleEnabled(item)">{{ updatingId === item.id ? '...' : item.isDisabled ? 'Bật' : 'Tắt' }}</button><button type="button" class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100" @click="openEditForm(item)">Sửa</button><button type="button" class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50" @click="confirmDeleteId = item.id">Xoá</button></div></td>
						</tr></tbody>
					</table>
				</div>
			</section>

			<div v-if="isFormOpen" class="absolute inset-0 z-20 bg-black/25 lg:static lg:inset-auto lg:z-auto lg:bg-transparent" @click.self="closeForm">
				<aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl">
					<div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4"><div><h3 class="m-0 text-base font-extrabold text-[#153221]">{{ form.id ? 'Chỉnh sửa mã' : 'Thêm mã đổi thưởng' }}</h3><p class="m-0 mt-1 text-xs text-gray-500">Mã đổi xu cho người chơi</p></div><button type="button" aria-label="Đóng biểu mẫu" class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100" @click="closeForm">&times;</button></div>
					<form class="flex-1 space-y-4 overflow-y-auto p-5" @submit.prevent="handleSave">
						<div v-if="formError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError }}</div>
						<label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Mã đổi thưởng *<input v-model="form.code" required maxlength="100" autocomplete="off" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-mono font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" /></label>
						<label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Số xu thưởng *<input v-model="form.cash" type="number" required min="1" step="1" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" /></label>
						<label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Hạn sử dụng<input v-model="form.expiresAt" type="datetime-local" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" /><span class="font-normal text-gray-500">Để trống nếu mã không hết hạn.</span></label>
						<label class="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-700"><input v-model="form.isDisabled" type="checkbox" class="size-4 accent-emerald-800" /><span>Tắt mã đổi thưởng</span></label>
					</form>
					<div class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-4"><button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100" @click="closeForm">Huỷ</button><button type="button" :disabled="isSaving" class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50" @click="handleSave">{{ isSaving ? 'Đang lưu...' : 'Lưu mã' }}</button></div>
				</aside>
			</div>
		</main>

		<div v-if="confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4"><div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"><h3 class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá mã?</h3><p class="my-3 text-sm text-gray-600">Thao tác này không thể hoàn tác.</p><div class="flex justify-end gap-2"><button type="button" class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700" @click="confirmDeleteId = null">Huỷ</button><button type="button" :disabled="deletingId === confirmDeleteId" class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" @click="handleDelete">{{ deletingId ? 'Đang xoá...' : 'Xoá mã' }}</button></div></div></div>
	</div>
</template>
