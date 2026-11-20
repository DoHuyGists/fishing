<script setup lang="ts">
import type { UserFriend, FriendDeleteKind } from "../../../types/model/friend";
import { getFormattingLocale, t as tr } from "../../../i18n";
import { useFriendProfiles } from "../../../composables/useFriendProfiles";

const { friendStore, countryStore, currentUserId, filteredFriends, receivedRequests, sentRequests,
  filteredPlayers, searchQuery, getFriendProfile, getSenderProfile, getRecipientProfile,
  getRelation, getAvatarGradient, formatUuid } = useFriendProfiles();
const emit = defineEmits<{
  copy: [id: string];
  delete: [record: UserFriend, kind: FriendDeleteKind];
  respond: [id: string, accept: boolean];
  send: [id: string];
  discover: [];
}>();
</script>

<template>
<div class="space-y-3">
        <div
          v-if="sentRequests.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-emerald-900/10 p-6"
        >
          <div class="text-4xl mb-2">📤</div>
          <div class="m-0 text-sm font-bold text-gray-800">{{ tr("FriendModal.chua_gui_loi_moi_nao") }}</div>
          <div class="m-0 text-xs text-gray-500 mt-1">
            {{ tr("FriendModal.ban_chua_gui_yeu_cau_ket_ban_nao_dang_o_trang_thai_cho") }}
          </div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="record in sentRequests"
            :key="record.id"
            class="slide-fade-in from-bottom player-content-in p-4 rounded-2xl border border-emerald-900/10 bg-white/95 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="size-11 rounded-xl bg-linear-to-br flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0"
                :class="getAvatarGradient(record.friend_id)"
              >
                <img
                  v-if="getRecipientProfile(record)?.avatar_url"
                  :src="getRecipientProfile(record)?.avatar_url ?? ''"
                  :alt="tr('UpdateIdentityModal.anh_dai_dien')"
                  class="h-full w-full rounded-xl object-cover"
                  referrerpolicy="no-referrer"
                />
                <span v-else>{{
                  (getRecipientProfile(record)?.display_name || record.friend_id).slice(0, 2).toUpperCase()
                }}</span>
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-gray-900 font-mono">
                    {{ getRecipientProfile(record)?.display_name || formatUuid(record.friend_id) }}
                  </span>
                  <button
                    type="button"
                    class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                    :title="tr('FriendModal.sao_chep_toan_bo_id')"
                    @click="emit('copy', record.friend_id)"
                  >
                    📋
                  </button>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    {{ tr("FriendModal.dang_cho_dong_y") }}
                  </span>
                </div>

                <div class="mt-1 text-[11px] text-content-caption">
                  {{ countryStore.getCountryName(getRecipientProfile(record)?.country_id) }}
                </div>
                <div v-if="getRecipientProfile(record)" class="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                  <span class="font-bold text-amber-800">
                    {{ tr("UserProfile.cap") }} {{ getRecipientProfile(record)?.level }}
                  </span>
                  <span class="text-gray-500">·</span>
                  <span class="text-gray-400 text-[10px]">
                    {{ tr("FriendModal.gui_luc") }}
                    {{ new Date(record.created_at).toLocaleDateString(getFormattingLocale()) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Nút Hủy / Xóa lời mời -->
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
              :disabled="friendStore.actionLoadingId === record.id"
              @click="emit('delete', record, 'sent_request')"
            >
              {{ tr("FriendModal.huy_loi_moi") }}
            </button>
          </div>
        </div>
      </div>
</template>
