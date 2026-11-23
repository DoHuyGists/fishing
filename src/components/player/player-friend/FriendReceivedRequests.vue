<script setup lang="ts">
import type { UserFriend, FriendDeleteKind } from "../../../types/model/friend";
import { getFormattingLocale, t as tr } from "../../../i18n";
import { useFriendProfiles } from "../../../composables/useFriendProfiles";

const { friendStore, countryStore, currentUserId, filteredFriends, receivedRequests, sentRequests,
  filteredPlayers, searchQuery, getFriendProfile, getSenderProfile, getRecipientProfile,
  getRelation, getAvatarColor, formatUuid } = useFriendProfiles();
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
          v-if="receivedRequests.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-accent/10 p-6"
        >
          <div class="text-4xl mb-2">📬</div>
          <div class="m-0 text-sm font-bold text-content">{{ tr("FriendModal.khong_co_loi_moi_nao") }}</div>
          <div class="m-0 text-xs text-content mt-1">
            {{ tr("FriendModal.hien_tai_ban_chua_nhan_duoc_yeu_cau_ket_ban_nao_tu_nguoi_choi_kh") }}
          </div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="record in receivedRequests"
            :key="record.id"
            class="slide-fade-in from-bottom player-content-in p-4 rounded-2xl border border-gold/60 bg-surface/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="size-11 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0"
                :class="getAvatarColor(record.user_id)"
              >
                <img
                  v-if="getSenderProfile(record)?.avatar_url"
                  :src="getSenderProfile(record)?.avatar_url ?? ''"
                  :alt="tr('UpdateIdentityModal.anh_dai_dien')"
                  class="h-full w-full rounded-xl object-cover"
                  referrerpolicy="no-referrer"
                />
                <span v-else>{{
                  (getSenderProfile(record)?.display_name || record.user_id).slice(0, 2).toUpperCase()
                }}</span>
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-content font-mono">
                    {{ getSenderProfile(record)?.display_name || formatUuid(record.user_id) }}
                  </span>
                  <button
                    type="button"
                    class="text-content hover:text-content text-xs cursor-pointer"
                    :title="tr('FriendModal.sao_chep_toan_bo_id')"
                    @click="emit('copy', record.user_id)"
                  >
                    📋
                  </button>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gold text-gold">
                    {{ tr("FriendModal.muon_ket_ban") }}
                  </span>
                </div>

                <div class="mt-1 text-[11px] text-content-caption">
                  {{ countryStore.getCountryName(getSenderProfile(record)?.country_id) }}
                </div>
                <div v-if="getSenderProfile(record)" class="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                  <span class="font-bold text-gold">
                    {{ tr("UserProfile.cap") }} {{ getSenderProfile(record)?.level }}
                  </span>
                  <span class="text-content">·</span>
                  <span class="text-content font-medium">
                    {{
                      Number(getSenderProfile(record)?.experience_point ?? 0).toLocaleString(getFormattingLocale())
                    }}
                    EXP
                  </span>
                  <span class="text-content">·</span>
                  <span class="text-content text-[10px]">
                    {{ new Date(record.created_at).toLocaleDateString(getFormattingLocale()) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Hành động phản hồi: Đồng ý, Từ chối, Xóa -->
            <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
              <button
                type="button"
                class="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
                :disabled="friendStore.actionLoadingId === record.id"
                @click="emit('respond', record.id, true)"
              >
                <span
                  v-if="friendStore.actionLoadingId === record.id"
                  class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                ></span>
                <span>{{ tr("FriendModal.dong_y") }}</span>
              </button>

              <button
                type="button"
                class="px-3 py-1.5 rounded-xl border border-content bg-white hover:bg-surface text-content text-xs font-bold transition cursor-pointer disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                @click="emit('respond', record.id, false)"
              >
                {{ tr("FriendModal.tu_choi") }}
              </button>

              <button
                type="button"
                class="px-2.5 py-1.5 rounded-xl border border-danger bg-surface hover:bg-surface text-danger text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                :title="tr('FriendModal.xoa_yeu_cau_nay')"
                @click="emit('delete', record, 'received_request')"
              >
                {{ tr("FriendModal.xoa") }}
              </button>
            </div>
          </div>
        </div>
      </div>
</template>
