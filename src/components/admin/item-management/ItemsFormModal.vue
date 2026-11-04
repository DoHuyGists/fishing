<script lang="ts" setup>
import { reactive, watch } from 'vue';
import type { AdminItemRow, ItemPayload } from '../../../data/supabaseItemRepository';

const props = defineProps<{
	item: AdminItemRow | null;
	categories: string[];
	saving: boolean;
	error: string;
}>();

const emit = defineEmits<{
	close: [];
	save: [payload: ItemPayload];
}>();

const form = reactive({
	category: '',
	classification: '',
	name: '',
	information: '',
	image: '',
	icon: '',
	rpc: '',
	quantity: '' as string | number,
	price: 0,
	isDisabled: true,
});

watch(() => props.item, (item) => {
	Object.assign(form, {
		category: item?.category ?? '',
		classification: item?.classification ?? '',
		name: item?.name ?? '',
		information: item?.information ?? '',
		image: item?.image ?? '',
		icon: item?.icon ?? '',
		rpc: item?.rpc ?? '',
		quantity: item?.quantity == null ? '' : Number(item.quantity),
		price: item?.price ?? 0,
		isDisabled: item?.isDisabled !== false,
	});
}, { immediate: true });

function submit() {
	const name = form.name.trim();
	const information = form.information.trim();
	const price = Number(form.price);
	const quantity = form.quantity === '' ? null : Number(form.quantity);
	if (!name || !information) return;
	if (!Number.isSafeInteger(price) || price < 0) return;
	if (quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 0)) return;

	emit('save', {
		category: form.category.trim() || null,
		classification: form.classification.trim() || null,
		name,
		information,
		image: form.image.trim() || null,
		icon: form.icon.trim() || null,
		rpc: form.rpc.trim() || null,
		quantity,
		price,
		isDisabled: form.isDisabled,
	});
}
</script>

<template>
	<div class="absolute inset-0 z-20 bg-black/25 lg:static lg:inset-auto lg:z-auto lg:bg-transparent" @click.self="emit('close')">
		<aside class="ml-auto flex h-full w-full max-w-xl flex-col border-l border-[#cbd9c6] bg-[#f5f9f0] shadow-xl text-[#24352a]">
			<div class="flex shrink-0 items-center justify-between border-b border-[#cbd9c6] px-5 py-4">
				<div>
					<h3 class="m-0 text-base font-extrabold">{{ item ? 'Chỉnh sửa vật phẩm' : 'Thêm vật phẩm' }}</h3>
					<p class="m-0 mt-1 text-xs text-gray-500">Thông tin trong bảng items</p>
				</div>
				<button type="button" aria-label="Đóng biểu mẫu" class="grid size-8 place-items-center rounded-md text-xl text-gray-500 hover:bg-white" @click="emit('close')">&times;</button>
			</div>
			<form id="item-form" class="flex-1 space-y-4 overflow-y-auto p-5" @submit.prevent="submit">
				<div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<label class="flex flex-col gap-1.5 text-xs font-bold sm:col-span-2">Tên vật phẩm *
						<input v-model="form.name" required maxlength="200" class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none" />
					</label>
					<label class="flex flex-col gap-1.5 text-xs font-bold">Danh mục
						<input v-model="form.category" list="item-category-options" placeholder="Chọn hoặc nhập danh mục" maxlength="100" class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none" />
						<datalist id="item-category-options"><option v-for="category in categories" :key="category" :value="category" /></datalist>
					</label>
					<label class="flex flex-col gap-1.5 text-xs font-bold">Phân loại
						<input v-model="form.classification" maxlength="100" placeholder="Ví dụ: Mồi, phụ kiện" class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none" />
					</label>
					<label class="flex flex-col gap-1.5 text-xs font-bold">Biểu tượng
						<input v-model="form.icon" placeholder="Ví dụ: 🎣 hoặc icon class" maxlength="100" class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none" />
					</label>
					<label class="flex flex-col gap-1.5 text-xs font-bold sm:col-span-2">RPC
						<input v-model="form.rpc" type="text" placeholder="Tên hoặc chuỗi tham số RPC" class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none" />
						<span class="font-normal text-gray-500">Lưu nội dung RPC dạng văn bản.</span>
					</label>
					<label class="flex flex-col gap-1.5 text-xs font-bold">Giá (đ)
						<input v-model.number="form.price" type="number" min="0" step="1" required class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none" />
					</label>
					<label class="flex flex-col gap-1.5 text-xs font-bold">Số lượng tồn kho <span class="font-normal text-gray-500">Để trống nếu không giới hạn</span>
						<input v-model="form.quantity" type="number" min="0" step="1" class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none" />
					</label>
					<label class="flex flex-col gap-1.5 text-xs font-bold sm:col-span-2">Đường dẫn hình ảnh
						<input v-model="form.image" type="text" placeholder="https://... hoặc đường dẫn asset" class="rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none" />
					</label>
					<div v-if="form.image" class="sm:col-span-2"><img :src="form.image" :alt="form.name || 'Xem trước vật phẩm'" class="h-36 w-full rounded-md border border-[#cbd9c6] bg-white object-contain" /></div>
					<label class="flex flex-col gap-1.5 text-xs font-bold sm:col-span-2">Thông tin *
						<textarea v-model="form.information" required rows="6" class="resize-y rounded-md border border-[#cbd9c6] bg-white px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none"></textarea>
					</label>
					<label class="flex items-center gap-3 rounded-md border border-[#cbd9c6] bg-white px-3 py-3 text-sm font-semibold sm:col-span-2">
						<input v-model="form.isDisabled" type="checkbox" class="size-4 accent-emerald-800" />
						<span>Tắt hiển thị vật phẩm</span>
					</label>
				</div>
			</form>
			<div class="flex shrink-0 items-center justify-end gap-2 border-t border-[#cbd9c6] px-5 py-4">
				<button type="button" class="rounded-lg border border-[#cbd9c6] bg-white px-4 py-2 text-sm font-bold hover:bg-[#f5f9f0]" @click="emit('close')">Huỷ</button>
				<button type="submit" form="item-form" :disabled="saving" class="rounded-lg bg-[#153221] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{{ saving ? 'Đang lưu...' : 'Lưu vật phẩm' }}</button>
			</div>
		</aside>
	</div>
</template>
