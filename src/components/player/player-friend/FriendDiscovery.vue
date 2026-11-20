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
        <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-gray-600 px-1">
          <span>{{ tr("FriendModal.danh_sach_nguoi_choi_tu_he_thong") }}{{ filteredPlayers.length }})</span>
          <span class="text-[11px] text-gray-400">{{ tr("FriendModal.sap_xep_theo_cap_do_cao_xuong_thap") }}</span>
        </div>

        <div
          v-if="filteredPlayers.length === 0"
          class="py-14 text-center bg-white/60 rounded-2xl border border-emerald-900/10 p-6"
        >
          <div class="text-4xl mb-2">🔍</div>
          <div class="m-0 text-sm font-bold text-gray-800">{{ tr("FriendModal.khong_tim_thay_nguoi_choi") }}</div>
          <div class="m-0 text-xs text-gray-500 mt-1">
            {{ tr("FriendModal.khong_co_nguoi_choi_nao_khop_voi_tu_khoa_tim_kiem") }}
          </div>
        </div>

        <div v-else class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            v-for="player in filteredPlayers"
            :key="player.id"
            class="slide-fade-in from-bottom player-content-in p-4 rounded-2xl border border-emerald-900/10 bg-white/95 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <!-- Avatar -->
                <div
                  class="size-11 rounded-xl bg-linear-to-br flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0"
                  :class="getAvatarGradient(player.id)"
                >
                  <img
                    v-if="player.avatar_url"
                    :src="player.avatar_url"
                    :alt="tr('UpdateIdentityModal.anh_dai_dien')"
                    class="h-full w-full rounded-xl object-cover"
                    referrerpolicy="no-referrer"
                  />
                  <span v-else>{{ (player.display_name || player.id).slice(0, 2).toUpperCase() }}</span>
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-gray-900 font-mono">
                      {{ player.display_name || formatUuid(player.id) }}
                    </span>
                    <button
                      type="button"
                      class="text-gray-400 hover:text-emerald-700 text-xs cursor-pointer"
                      :title="tr('FriendModal.sao_chep_toan_bo_id')"
                      @click="emit('copy', player.id)"
                    >
                      📋
                    </button>
                  </div>

                  <div class="mt-1 text-[11px] text-content-caption">
                    {{ countryStore.getCountryName(player.country_id) }}
                  </div>
                  <!-- Thông số: Cấp & EXP -->
                  <div class="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                    <span
                      class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200"
                    >
                      {{ tr("UserProfile.cap") }} {{ player.level }}
                    </span>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                      ✨ {{ Number(player.experience_point).toLocaleString(getFormattingLocale()) }} EXP
                    </span>
                  </div>
                </div>
              </div>

              <!-- Trạng thái hoặc Nút kết bạn -->
              <div class="flex shrink-0 items-center gap-2">
                <!-- Đã là bạn bè -->
                <span
                  v-if="getRelation(player.id).type === 'ACCEPTED'"
                  class="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold"
                >
                  {{ tr("FriendModal.ban_be_3") }}
                </span>

                <!-- Đã gửi lời mời đang chờ -->
                <div v-else-if="getRelation(player.id).type === 'SENT_PENDING'" class="flex items-center gap-1.5">
                  <span
                    class="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold"
                  >
                    {{ tr("FriendModal.da_gui") }}
                  </span>
                  <button
                    type="button"
                    class="px-2 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold cursor-pointer"
                    :title="tr('FriendModal.huy_loi_moi')"
                    @click="
                      emit('delete',
                        (getRelation(player.id) as { type: 'SENT_PENDING'; record: UserFriend }).record,
                        'sent_request',
                      )
                    "
                  >
                    ✕
                  </button>
                </div>

                <!-- Người này đã gửi lời mời cho mình -->
                <div v-else-if="getRelation(player.id).type === 'RECEIVED_PENDING'" class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                    @click="
                      emit('respond',
                        (getRelation(player.id) as { type: 'RECEIVED_PENDING'; record: UserFriend }).record.id,
                        true,
                      )
                    "
                  >
                    {{ tr("PostProduction.dong_y") }}
                  </button>
                  <button
                    type="button"
                    class="px-2 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold cursor-pointer"
                    @click="
                      emit('respond',
                        (getRelation(player.id) as { type: 'RECEIVED_PENDING'; record: UserFriend }).record.id,
                        false,
                      )
                    "
                  >
                    {{ tr("FriendModal.tu_choi") }}
                  </button>
                </div>

                <!-- Chưa có quan hệ: Nút Thêm bạn -->
                <button
                  v-else
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-content-strong hover:bg-palette-1c432d text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  :disabled="friendStore.actionLoadingId === player.id"
                  @click="emit('send', player.id)"
                >
                  <span
                    v-if="friendStore.actionLoadingId === player.id"
                    class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                  ></span>
                  <span>{{ tr("FriendModal.them_ban") }}</span>
                </button>
              </div>
            </div>

            <!-- Dung lượng túi & Kho cá -->
            <div
              class="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-gray-500"
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{{ tr("FriendModal.tui") }} {{ player.inventory_capacity }} {{ tr("UserProfile.o") }}</span>
                <span>{{ tr("FriendModal.kho") }} {{ player.species_storage_capacity }} {{ tr("UserProfile.o") }}</span>
              </div>
              <span
                >{{ tr("FriendModal.tham_gia") }}
                {{ new Date(player.created_at).toLocaleDateString(getFormattingLocale()) }}</span
              >
            </div>
          </div>
        </div>
      </div>
</template>
