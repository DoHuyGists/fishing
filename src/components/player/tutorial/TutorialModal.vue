<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Modal from "../../shared/Modal.vue";
import { useModalStore } from "../../../stores/modal";
import { useTutorialStore } from "../../../stores/tutorial";

const router = useRouter();
const modalStore = useModalStore();
const store = useTutorialStore();
const opening = ref(false);
const navigationError = ref("");
const modes = [{ value: "list", label: "Danh sách" }, { value: "grid", label: "Lưới" }] as const;

async function enterLesson(slug: string) {
  if (opening.value) return;
  opening.value = true;
  navigationError.value = "";
  try {
    const failure = await router.push({ name: "tutorial", params: { slug } });
    if (!failure) modalStore.close();
  } catch {
    navigationError.value = "Không thể mở màn hướng dẫn. Vui lòng thử lại.";
  } finally {
    opening.value = false;
  }
}
onMounted(() => store.load());
</script>

<template>
  <Modal title="Thực hành câu cá" sub-title="Học cơ chế qua các màn chơi hướng dẫn" :show-count-data="false" :on-refresh="store.load">
    <div class="space-y-4 p-2 text-[#24352a] sm:p-4">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-4">
        <div class="max-w-2xl text-sm leading-6">Tập luyện với trang bị có sẵn. Cá, mồi và tiến độ trong màn hướng dẫn chỉ tồn tại trong lượt chơi này.</div>
        <div class="flex gap-1 rounded-lg border border-[#cbd9c6] bg-white p-1" role="group" aria-label="Chế độ hiển thị">
          <button v-for="mode in modes" :key="mode.value" type="button" :aria-pressed="store.viewMode === mode.value"
            class="rounded-md px-3 py-2 text-xs font-bold hover:bg-[#e2ecdc]"
            :class="store.viewMode === mode.value ? 'bg-[#e2ecdc]' : ''" @click="store.setViewMode(mode.value)">{{ mode.label }}</button>
        </div>
      </div>
      <div v-if="navigationError" role="alert" class="text-sm text-red-700">{{ navigationError }}</div>
      <div v-if="store.loading" role="status" class="py-12 text-center">Đang tải màn hướng dẫn...</div>
      <div v-else-if="store.error" role="alert" class="rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] p-5 text-sm">
        <div>{{ store.error }}</div>
        <button type="button" class="mt-3 font-bold underline" @click="store.load">Thử lại</button>
      </div>
      <div v-else-if="!store.tutorials.length" class="py-12 text-center">Chưa có màn hướng dẫn nào.</div>
      <div v-else class="grid gap-4" :class="store.viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'" aria-label="Các màn hướng dẫn">
        <button v-for="lesson in store.tutorials" :key="lesson.id" type="button" :disabled="opening" :aria-label="`Chơi màn ${lesson.title}`"
          class="overflow-hidden rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] text-left transition hover:border-[#70a77e] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:opacity-50"
          :class="store.viewMode === 'list' ? 'flex flex-col sm:flex-row' : ''" @click="enterLesson(lesson.slug)">
          <img :src="lesson.thumbnail" alt="" loading="lazy" class="object-cover" :class="store.viewMode === 'list' ? 'h-40 w-full sm:h-auto sm:w-56' : 'aspect-video w-full'">
          <div class="flex flex-1 flex-col gap-3 p-4">
            <div class="text-xs font-semibold text-[#61745d]">Khoảng {{ lesson.duration_minutes }} phút · Tập luyện tự do</div>
            <div class="text-lg font-bold">{{ lesson.title }}</div>
            <div class="text-sm leading-6">{{ lesson.description }}</div>
            <span class="mt-auto pt-2 text-sm font-bold text-emerald-800">Bắt đầu thực hành →</span>
          </div>
        </button>
      </div>
    </div>
  </Modal>
</template>
