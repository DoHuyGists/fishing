<script setup lang="ts">
import AdminModal from "../AdminModal.vue";
import { computed, onMounted, ref } from "vue";
import { useAdminFishingPassRewardsStore } from "./admin-fishing-pass-rewards-store.ts";
import type {
  FishingPassRewardPayload,
  FishingPassRewardRow,
} from "../../../data/supabaseFishingPassRewardsAdminRepository.ts";
import FishingPassRewardsForm from "./FishingPassRewardsFormManagement.vue";

const emit = defineEmits<{ close: [] }>();
const store = useAdminFishingPassRewardsStore();
const search = ref("");
const passFilter = ref("ALL");
const typeFilter = ref<"ALL" | "FREE" | "PREMIUM">("ALL");
const editing = ref<FishingPassRewardRow | null>(null);
const formOpen = ref(false);
const deleting = ref<FishingPassRewardRow | null>(null);
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return store.rewards.filter(
    (reward) =>
      (!query || `${reward.passName} ${reward.itemName}`.toLocaleLowerCase().includes(query)) &&
      (passFilter.value === "ALL" || reward.passId === passFilter.value) &&
      (typeFilter.value === "ALL" || reward.rewardType === typeFilter.value),
  );
});
function create() {
  editing.value = null;
  formOpen.value = true;
}
function edit(reward: FishingPassRewardRow) {
  editing.value = reward;
  formOpen.value = true;
}
async function save(payload: FishingPassRewardPayload) {
  if (await store.save(payload, editing.value?.id)) formOpen.value = false;
}
async function confirmDelete() {
  if (deleting.value && (await store.remove(deleting.value.id))) deleting.value = null;
}
const iconText = (icon: string | null) => (icon ? `${icon} ` : "");
onMounted(() => store.fetchAll());
</script>

<template>
  <AdminModal
    title="Quản lý phần thưởng vé câu"
    subtitle="Thiết lập vật phẩm nhận theo ngày cho vé FREE và PREMIUM."
    @close="emit('close')"
    @keydown.esc="emit('close')"
  >
      <div v-if="formOpen" class="overflow-y-auto p-5 sm:p-7">
        <div class="mb-4 text-base font-bold">{{ editing ? "Sửa phần thưởng" : "Tạo phần thưởng" }}</div>
        <div v-if="store.error" class="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{{ store.error }}</div>
        <div
          v-if="!store.passes.length || !store.items.length"
          class="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          Cần có ít nhất một vé câu và một vật phẩm trước khi tạo phần thưởng.
        </div>
        <FishingPassRewardsForm
          :reward="editing"
          :passes="store.passes"
          :items="store.items"
          :saving="store.saving"
          @save="save"
          @cancel="formOpen = false"
        />
      </div>
      <template v-else>
        <div class="flex flex-wrap items-center gap-3 border-b border-[#cbd9c6] p-4 sm:px-6">
          <input
            v-model="search"
            type="search"
            placeholder="Tìm vé hoặc vật phẩm…"
            class="min-w-44 flex-1 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
          /><select v-model="passFilter" class="max-w-56 rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
            <option value="ALL">Tất cả vé câu</option>
            <option v-for="pass in store.passes" :key="pass.id" :value="pass.id">{{ pass.name }}</option></select
          ><select v-model="typeFilter" class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm">
            <option value="ALL">Tất cả loại</option>
            <option value="FREE">FREE</option>
            <option value="PREMIUM">PREMIUM</option></select
          ><button
            type="button"
            class="rounded-lg border border-[#cbd9c6] bg-white px-3 py-2 text-sm"
            :disabled="store.loading"
            @click="store.fetchAll()"
          >
            {{ store.loading ? "Đang tải…" : "Làm mới" }}</button
          ><button
            type="button"
            :disabled="!store.passes.length || !store.items.length"
            class="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            @click="create"
          >
            + Tạo phần thưởng
          </button>
        </div>
        <div v-if="store.error" class="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:mx-6">
          {{ store.error }}
        </div>
        <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <div v-if="store.loading && !store.rewards.length" class="py-12 text-center text-sm text-[#24352a]/70">
            Đang tải phần thưởng…
          </div>
          <div
            v-else-if="!filtered.length"
            class="rounded-xl border border-dashed border-[#cbd9c6] bg-white p-10 text-center text-sm text-[#24352a]/70"
          >
            Chưa có phần thưởng phù hợp.
          </div>
          <div v-else class="overflow-x-auto rounded-xl border border-[#cbd9c6] bg-white">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead class="bg-[#eaf1e5] text-xs uppercase text-[#24352a]/70">
                <tr>
                  <th class="px-4 py-3">Vé câu</th>
                  <th class="px-4 py-3">Ngày</th>
                  <th class="px-4 py-3">Loại</th>
                  <th class="px-4 py-3">Vật phẩm</th>
                  <th class="px-4 py-3">Số lượng</th>
                  <th class="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="reward in filtered" :key="reward.id" class="border-t border-[#e5ece1]">
                  <td class="px-4 py-3 font-medium">{{ reward.passName }}</td>
                  <td class="px-4 py-3">Ngày {{ reward.dayNumber }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="rounded-full px-2.5 py-1 text-xs font-semibold"
                      :class="reward.rewardType === 'FREE' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'"
                      >{{ reward.rewardType }}</span
                    >
                  </td>
                  <td class="px-4 py-3">{{ iconText(reward.itemIcon) }}{{ reward.itemName }}</td>
                  <td class="px-4 py-3">{{ reward.quantity }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      class="rounded-lg border border-[#cbd9c6] px-3 py-1.5 text-xs font-semibold hover:bg-[#f5f9f0]"
                      @click="edit(reward)"
                    >
                      Sửa</button
                    ><button
                      type="button"
                      class="ml-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      @click="deleting = reward"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    <div v-if="deleting" class="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4">
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div class="font-bold">Xác nhận xoá phần thưởng</div>
        <div class="my-3 text-sm text-slate-600">
          Xoá vật phẩm “{{ deleting.itemName }}” khỏi {{ deleting.passName }}, ngày {{ deleting.dayNumber }}?
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg border px-3 py-2 text-sm" @click="deleting = null">Huỷ</button
          ><button
            type="button"
            class="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
            @click="confirmDelete"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  </AdminModal>
</template>
