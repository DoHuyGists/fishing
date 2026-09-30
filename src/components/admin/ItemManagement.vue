<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { supabaseItemRepository, type AdminItemRow, type ItemPayload } from '../../data/supabaseItemRepository';

const emit = defineEmits(['close']);

const items = ref<AdminItemRow[]>([]);
const search = ref('');
const categoryFilter = ref('ALL');
const statusFilter = ref<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
const isLoading = ref(false);
const loadError = ref('');
const isFormOpen = ref(false);
const isSaving = ref(false);
const formError = ref('');
const deletingId = ref<string | null>(null);
const updatingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

const emptyForm = () => ({
	id: null as string | null,
	category: '',
	name: '',
	information: '',
	image: '',
	icon: '',
	isDisabled: true,
});

const form = reactive(emptyForm());

const categories = computed(() => [...new Set(items.value.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'vi')));

const filteredItems = computed(() => {
	const keyword = search.value.trim().toLocaleLowerCase();
	return items.value.filter((item) => {
		const matchesSearch = !keyword || [item.name, item.category, item.information, item.image, item.icon]
			.some((value) => value?.toLocaleLowerCase().includes(keyword));
		const matchesCategory = categoryFilter.value === 'ALL' || item.category === categoryFilter.value;
		const matchesStatus = statusFilter.value === 'ALL' ||
			(statusFilter.value === 'ENABLED' && item.isDisabled === false) ||
			(statusFilter.value === 'DISABLED' && item.isDisabled !== false);
		return matchesSearch && matchesCategory && matchesStatus;
	});
});

async function loadItems() {
	isLoading.value = true;
	loadError.value = '';
	try {
		items.value = await supabaseItemRepository.fetchAll();
	} catch (error) {
		loadError.value = error instanceof Error ? error.message : 'Không thể tải danh sách vật phẩm';
	} finally {
		isLoading.value = false;
	}
}

function openCreateForm() {
	Object.assign(form, emptyForm());
	formError.value = '';
	isFormOpen.value = true;
}

function openEditForm(item: AdminItemRow) {
	Object.assign(form, {
		id: item.id,
		category: item.category ?? '',
		name: item.name,
		information: item.information,
		image: item.image ?? '',
		icon: item.icon ?? '',
		isDisabled: item.isDisabled !== false,
	});
	formError.value = '';
	isFormOpen.value = true;
}

function closeForm() {
	isFormOpen.value = false;
	formError.value = '';
}

function buildPayload(): ItemPayload | null {
	const name = form.name.trim();
	const information = form.information.trim();
	if (!name || !information) {
		formError.value = 'Tên và thông tin vật phẩm là bắt buộc';
		return null;
	}

	return {
		category: form.category.trim() || null,
		name,
		information,
		image: form.image.trim() || null,
		icon: form.icon.trim() || null,
		isDisabled: form.isDisabled,
	};
}

async function handleSave() {
	formError.value = '';
	const payload = buildPayload();
	if (!payload) return;

	isSaving.value = true;
	try {
		if (form.id) await supabaseItemRepository.update(form.id, payload);
		else await supabaseItemRepository.create(payload);
		closeForm();
		await loadItems();
	} catch (error) {
		formError.value = error instanceof Error ? error.message : 'Không thể lưu vật phẩm';
	} finally {
		isSaving.value = false;
	}
}

async function toggleEnabled(item: AdminItemRow) {
	updatingId.value = item.id;
	loadError.value = '';
	try {
		await supabaseItemRepository.update(item.id, {
			category: item.category,
			name: item.name,
			information: item.information,
			image: item.image,
			icon: item.icon,
			isDisabled: item.isDisabled === false,
		});
		await loadItems();
	} catch (error) {
		loadError.value = error instanceof Error ? error.message : 'Không thể cập nhật trạng thái vật phẩm';
	} finally {
		updatingId.value = null;
	}
}

async function handleDelete() {
	if (!confirmDeleteId.value) return;
	deletingId.value = confirmDeleteId.value;
	try {
		await supabaseItemRepository.delete(confirmDeleteId.value);
		if (form.id === confirmDeleteId.value) closeForm();
		confirmDeleteId.value = null;
		await loadItems();
	} catch (error) {
		loadError.value = error instanceof Error ? error.message : 'Không thể xoá vật phẩm';
	} finally {
		deletingId.value = null;
	}
}

function formatDate(value: string | null) {
	return value ? new Date(value).toLocaleString('vi-VN') : '—';
}

onMounted(loadItems);
</script>

<template>
	<div class="fixed inset-0 z-50 flex flex-col bg-gray-50">
		<header class="flex shrink-0 items-center justify-between gap-4 border-b border-emerald-900 bg-[#153221] px-5 py-4 text-white md:px-7">
			<div class="flex min-w-0 items-center gap-3">
				<div class="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-800 text-xl">🎒</div>
				<div class="min-w-0">
					<h2 class="m-0 text-lg font-extrabold">Quản lý vật phẩm</h2>
					<p class="m-0 text-xs text-emerald-200">{{ items.length }} vật phẩm trong danh mục</p>
				</div>
			</div>
			<button type="button" title="Đóng" aria-label="Đóng" class="grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-600 bg-emerald-900/50 text-xl hover:bg-emerald-800" @click="emit('close')">&times;</button>
		</header>

		<div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 md:px-7">
			<div class="min-w-55 flex-1">
				<input v-model="search" type="search" placeholder="Tìm tên, mô tả, biểu tượng, đường dẫn..." class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none" />
			</div>
			<label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
				Danh mục
				<select v-model="categoryFilter" class="max-w-44 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700">
					<option value="ALL">Tất cả</option>
					<option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
				</select>
			</label>
			<label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
				Hiển thị
				<select v-model="statusFilter" class="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700">
					<option value="ALL">Tất cả</option>
					<option value="ENABLED">Đang bật</option>
					<option value="DISABLED">Đang tắt</option>
				</select>
			</label>
			<div class="ml-auto flex items-center gap-2">
				<span class="hidden text-xs text-gray-500 sm:inline">{{ filteredItems.length }} kết quả</span>
				<button type="button" title="Làm mới danh sách" class="grid size-9 place-items-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50" :disabled="isLoading" @click="loadItems">
					<svg class="size-4" :class="{ 'animate-spin': isLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
				</button>
				<button type="button" class="rounded-lg bg-[#153221] px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-800" @click="openCreateForm">+ Thêm vật phẩm</button>
			</div>
		</div>

		<main class="relative flex min-h-0 flex-1">
			<section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
				<div v-if="loadError" class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					<span>{{ loadError }}</span>
					<button type="button" class="font-bold underline" @click="loadItems">Thử lại</button>
				</div>
				<div v-if="isLoading" class="grid min-h-64 place-items-center text-sm text-gray-500">Đang tải danh sách vật phẩm...</div>
				<div v-else-if="!filteredItems.length" class="grid min-h-64 place-items-center text-center text-sm text-gray-500">
					<div><span class="mb-2 block text-3xl">🎒</span>{{ items.length ? 'Không tìm thấy vật phẩm phù hợp.' : 'Chưa có vật phẩm nào.' }}</div>
				</div>
				<div v-else class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
					<table class="w-full min-w-280 border-separate border-spacing-0 text-left text-sm">
						<thead class="text-[11px] uppercase text-gray-600">
							<tr>
								<th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Vật phẩm</th>
								<th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Danh mục</th>
								<th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Biểu tượng</th>
								<th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Hiển thị</th>
								<th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Ngày tạo</th>
								<th class="sticky top-0 z-10 bg-gray-100 px-4 py-3">Cập nhật</th>
								<th class="sticky top-0 z-10 bg-gray-100 px-4 py-3 text-right">Thao tác</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="item in filteredItems" :key="item.id" class="border-t border-gray-100 hover:bg-emerald-50/40">
								<td class="max-w-120 px-4 py-3">
									<div class="flex items-center gap-3">
										<img v-if="item.image" :src="item.image" :alt="item.name" class="size-12 shrink-0 rounded-md border border-gray-200 bg-gray-50 object-cover" loading="lazy" />
										<div v-else class="grid size-12 shrink-0 place-items-center rounded-md border border-gray-200 bg-gray-50 text-xl">{{ item.icon || '🎒' }}</div>
										<div class="min-w-0">
											<div class="truncate font-bold text-gray-800" :title="item.name">{{ item.name }}</div>
											<div class="mt-1 max-w-104 truncate text-xs text-gray-500" :title="item.information">{{ item.information }}</div>
											<div v-if="item.image" class="mt-1 max-w-104 truncate text-[10px] text-emerald-700" :title="item.image">{{ item.image }}</div>
										</div>
									</div>
								</td>
								<td class="px-4 py-3 text-gray-700">{{ item.category || '—' }}</td>
								<td class="px-4 py-3 text-2xl">{{ item.icon || '—' }}</td>
								<td class="px-4 py-3"><span class="rounded-full border px-2.5 py-1 text-xs font-semibold" :class="item.isDisabled === false ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-100 text-gray-600'">{{ item.isDisabled === false ? 'Đang bật' : 'Đang tắt' }}</span></td>
								<td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ formatDate(item.createdAt) }}</td>
								<td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ formatDate(item.updatedAt) }}</td>
								<td class="px-4 py-3">
									<div class="flex justify-end gap-2">
										<button type="button" class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50" :disabled="updatingId === item.id" @click="toggleEnabled(item)">{{ updatingId === item.id ? '...' : item.isDisabled === false ? 'Tắt' : 'Bật' }}</button>
										<button type="button" class="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100" @click="openEditForm(item)">Sửa</button>
										<button type="button" class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50" @click="confirmDeleteId = item.id">Xoá</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>

			<div v-if="isFormOpen" class="absolute inset-0 z-20 bg-black/25 lg:static lg:inset-auto lg:z-auto lg:bg-transparent" @click.self="closeForm">
				<aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl">
					<div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
						<div>
							<h3 class="m-0 text-base font-extrabold text-[#153221]">{{ form.id ? 'Chỉnh sửa vật phẩm' : 'Thêm vật phẩm' }}</h3>
							<p class="m-0 mt-1 text-xs text-gray-500">Thông tin trong bảng items</p>
						</div>
						<button type="button" aria-label="Đóng biểu mẫu" class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-gray-100" @click="closeForm">&times;</button>
					</div>
					<form class="flex-1 space-y-4 overflow-y-auto p-5" @submit.prevent="handleSave">
						<div v-if="formError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError }}</div>
						<div class="grid gap-4 sm:grid-cols-2">
							<label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600 sm:col-span-2">Tên vật phẩm *
								<input v-model="form.name" required maxlength="200" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" />
							</label>
							<label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Danh mục
								<input v-model="form.category" list="item-category-options" placeholder="Chọn hoặc nhập danh mục" maxlength="100" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" />
								<datalist id="item-category-options"><option v-for="category in categories" :key="category" :value="category" /></datalist>
							</label>
							<label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600">Biểu tượng
								<input v-model="form.icon" placeholder="Ví dụ: 🎣 hoặc icon class" maxlength="100" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" />
							</label>
							<label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600 sm:col-span-2">Đường dẫn hình ảnh
								<input v-model="form.image" type="text" placeholder="https://... hoặc đường dẫn asset" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none" />
							</label>
							<div v-if="form.image" class="sm:col-span-2">
								<img :src="form.image" :alt="form.name || 'Xem trước vật phẩm'" class="h-36 w-full rounded-md border border-gray-200 bg-gray-50 object-contain" />
							</div>
							<label class="flex flex-col gap-1.5 text-xs font-bold text-gray-600 sm:col-span-2">Thông tin *
								<textarea v-model="form.information" required rows="6" class="resize-y rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-800 focus:border-emerald-600 focus:outline-none"></textarea>
							</label>
							<label class="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-700 sm:col-span-2">
								<input v-model="form.isDisabled" type="checkbox" class="size-4 accent-emerald-800" />
								<span>Tắt hiển thị vật phẩm</span>
							</label>
						</div>
					</form>
					<div class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
						<button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100" @click="closeForm">Huỷ</button>
						<button type="button" :disabled="isSaving" class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50" @click="handleSave">{{ isSaving ? 'Đang lưu...' : 'Lưu vật phẩm' }}</button>
					</div>
				</aside>
			</div>
		</main>

		<div v-if="confirmDeleteId" class="fixed inset-0 z-40 grid place-items-center bg-black/45 p-4">
			<div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
				<h3 class="m-0 text-base font-extrabold text-gray-800">Xác nhận xoá vật phẩm?</h3>
				<p class="my-3 text-sm text-gray-600">Thao tác này không thể hoàn tác. Các dữ liệu liên quan có thể bị ràng buộc bởi cơ sở dữ liệu.</p>
				<div class="flex justify-end gap-2">
					<button type="button" class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700" @click="confirmDeleteId = null">Huỷ</button>
					<button type="button" :disabled="deletingId === confirmDeleteId" class="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" @click="handleDelete">{{ deletingId ? 'Đang xoá...' : 'Xoá vật phẩm' }}</button>
				</div>
			</div>
		</div>
	</div>
</template>
