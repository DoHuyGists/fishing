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
          v-if="filteredFriends.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-accent/10 p-6"
        >
          <div class="text-4xl mb-2">🤝</div>
          <div class="m-0 text-sm font-bold text-content">{{ tr("FriendModal.chua_co_ban_be_nao") }}</div>
          <div class="m-0 text-xs text-content mt-1">
            {{
              searchQuery
                ? tr("FriendModal.khong_tim_thay_ban_be_phu_hop_voi_tim_kiem")
                : tr("FriendModal.hay_chuyen_sang_tab_them_ban_be_de_ket_ban_cung_nhung_ngu_thu_kh")
            }}
          </div>
          <button
            v-if="!searchQuery"
            type="button"
            class="mt-4 px-4 py-2 rounded-xl bg-accent hover:bg-accent text-white text-xs font-bold transition shadow-sm cursor-pointer"
            @click="emit('discover')"
          >
            {{ tr("FriendModal.tim_ban_moi_ngay") }}
          </button>
        </div>

        <div v-else class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="record in filteredFriends"
            :key="record.id"
            class="slide-fade-in from-bottom player-content-in p-4 rounded-2xl border border-accent/10 bg-white/95 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <!-- Avatar -->
                <div
                  class="size-11 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0"
                  :class="getAvatarColor(record.user_id === currentUserId ? record.friend_id : record.user_id)"
                >
                  <img
                    v-if="getFriendProfile(record)?.avatar_url"
                    :src="getFriendProfile(record)?.avatar_url ?? ''"
                    :alt="tr('UpdateIdentityModal.anh_dai_dien')"
                    class="h-full w-full rounded-xl object-cover"
                    referrerpolicy="no-referrer"
                  />
                  <span v-else>{{
                    (
                      getFriendProfile(record)?.display_name ||
                      (record.user_id === currentUserId ? record.friend_id : record.user_id)
                    )
                      .slice(0, 2)
                      .toUpperCase()
                  }}</span>
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-content font-mono">
                      {{
                        getFriendProfile(record)?.display_name ||
                        formatUuid(record.user_id === currentUserId ? record.friend_id : record.user_id)
                      }}
                    </span>
                    <button
                      type="button"
                      class="text-content hover:text-content text-xs cursor-pointer"
                      :title="tr('FriendModal.sao_chep_toan_bo_id')"
                      @click="emit('copy', record.user_id === currentUserId ? record.friend_id : record.user_id)"
                    >
                      📋
                    </button>
                  </div>

                  <div class="mt-1 text-[11px] text-content-caption">
                    {{ countryStore.getCountryName(getFriendProfile(record)?.country_id) }}
                  </div>
                  <!-- Thông số hồ sơ nếu có -->
                  <div v-if="getFriendProfile(record)" class="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                    <span
                      class="px-2 py-0.5 rounded-full bg-surface text-gold font-bold border border-gold"
                    >
                      {{ tr("UserProfile.cap") }} {{ getFriendProfile(record)?.level }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full bg-surface text-content font-medium">
                      ✨
                      {{
                        Number(getFriendProfile(record)?.experience_point ?? 0).toLocaleString(getFormattingLocale())
                      }}
                      EXP
                    </span>
                  </div>
                  <div v-else class="text-[10px] text-content mt-0.5">
                    {{ tr("FriendModal.chua_tai_du_lieu_ho_so") }}
                  </div>
                </div>
              </div>

              <!-- Nút Xóa bạn -->
              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg border border-danger bg-surface hover:bg-surface text-danger text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
                :disabled="friendStore.actionLoadingId === record.id"
                @click="emit('delete', record, 'friend')"
              >
                {{ tr("FriendModal.xoa_ban") }}
              </button>
            </div>

            <!-- Thời gian kết bạn -->
            <div
              class="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-content"
            >
              <span
                >{{ tr("FriendModal.da_ket_ban_tu") }}
                {{ new Date(record.created_at).toLocaleDateString(getFormattingLocale()) }}</span
              >
              <span class="text-content font-semibold">{{ tr("FriendModal.ban_be_2") }}</span>
            </div>
          </div>
        </div>
      </div>
</template>
