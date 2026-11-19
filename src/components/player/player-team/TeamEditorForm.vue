<script setup lang="ts">
import type { TeamEditorFields } from '../../../types/model/team';
import { t as tr } from '../../../i18n';
const createForm = defineModel<TeamEditorFields>({ required: true });
defineProps<{ editing: boolean; loading: boolean; error: string }>();
const emit = defineEmits<{ back: []; submit: [] }>();
</script>
<template>
<div class="max-w-[480px] mx-auto">
        <div class="flex items-center justify-between gap-3 mb-4">
          <button
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-transparent text-[#556655] border border-[#c0d8b8] cursor-pointer hover:bg-[#f0f7ec] active:scale-[0.97] transition-colors"
            @click="emit('back')"
          >
            {{ tr("TeamModal.quay_lai") }}
          </button>
          <div class="m-0 text-base font-bold text-[#1a3a1a]">
            {{ editing ? tr("MyTeamPanel.cap_nhat_to_doi") : tr("TeamModal.tao_nhom_moi") }}
          </div>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="emit('submit')">
          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]">
            {{ tr("TeamModal.ten_nhom") }} <span class="text-[#c0392b]">*</span>
            <input
              v-model="createForm.name"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a] outline-none transition focus:border-[#3b7a57] focus:shadow-[0_0_0_3px_rgba(59,122,87,0.12)]"
              type="text"
              :placeholder="tr('TeamModal.vd_hoi_cau_da_lat')"
              maxlength="50"
              required
            />
          </label>

          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]">
            {{ tr("TeamModal.mo_ta") }}
            <textarea
              v-model="createForm.description"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a] outline-none transition resize-y min-h-[72px] focus:border-[#3b7a57] focus:shadow-[0_0_0_3px_rgba(59,122,87,0.12)]"
              :placeholder="tr('TeamModal.mo_ta_ngan_ve_nhom_cua_ban')"
              rows="3"
              maxlength="200"
            />
          </label>

          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]">
            {{ tr("TeamModal.so_thanh_vien_toi_da") }}
            <div class="flex items-center gap-3">
              <input
                v-model.number="createForm.maxMembers"
                type="range"
                min="2"
                max="10"
                step="1"
                class="flex-1 accent-[#3b7a57]"
              />
              <span class="min-w-[28px] text-center font-bold text-[1.1rem] text-[#3b7a57]">{{
                createForm.maxMembers
              }}</span>
            </div>
          </label>

          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]"
            >{{ tr("TeamModal.trang_thai") }}
            <select
              v-model="createForm.status"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a]"
            >
              <option value="PENDING">{{ tr("TeamModal.cho_duyet_chua_hien_thi") }}</option>
              <option value="OPEN">{{ tr("MyTeamPanel.mo") }}</option>
              <option value="FULL">{{ tr("MyTeamPanel.day") }}</option>
              <option value="FISHING">{{ tr("MyTeamPanel.dang_cau") }}</option>
              <option value="CLOSED">{{ tr("Feedbackmodal.da_dong") }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-[#2a4a2a]"
            >{{ tr("TeamModal.quyen_tham_gia") }}
            <select
              v-model="createForm.joinType"
              class="px-3 py-[9px] border border-[#c0d8b8] rounded-lg bg-[#fafefc] text-[0.9rem] text-[#1a3a1a]"
            >
              <option value="everyone">{{ tr("TeamListSidebar.ai_cung_co_the_tham_gia") }}</option>
              <option value="friend">{{ tr("TeamListSidebar.chi_ban_be_cua_truong_nhom") }}</option>
              <option value="invited">{{ tr("TeamListSidebar.chi_nguoi_duoc_moi") }}</option>
            </select>
          </label>
          <div
            v-if="error"
            class="m-0 text-[#c0392b] bg-[#fef0ef] border border-[#f5c6c3] rounded-lg px-3 py-2 text-[0.83rem]"
          >
            {{ error }}
          </div>

          <button
            type="submit"
            class="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[0.87rem] font-bold bg-linear-to-br from-[#3b7a57] to-[#2e6644] text-white cursor-pointer hover:from-[#2e6644] hover:to-[#245236] active:scale-[0.97] disabled:opacity-55 disabled:cursor-not-allowed transition-all"
            :disabled="loading"
          >
            {{
              loading
                ? tr("ChangePasswordModal.dang_luu")
                : editing
                  ? tr("TeamModal.luu_thay_doi")
                  : tr("TeamModal.tao_nhom")
            }}
          </button>
        </form>
      </div>
</template>
