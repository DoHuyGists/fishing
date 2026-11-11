<template>
  <Modal :title="tr('DonationModal.ung_ho_phat_trien')" :show-count-data="false" :on-refresh="refreshQr">
    <main class="grid min-h-full w-full items-start gap-5 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-[#24352a] sm:grid-cols-2 sm:p-5">
        <div class="min-w-0 space-y-6">
          <div class="space-y-2">
            <div role="heading" aria-level="2" class="text-xl font-bold sm:text-2xl">{{ tr('DonationModal.cung_duy_tri_va_phat_trien_game') }}</div>
            <div class="text-sm leading-6 sm:text-base">
              {{ tr('DonationModal.su_ung_ho_cua_ban_giup_nha_phat_trien_duy_tri_may_chu_va_tiep_tu') }}
            </div>
          </div>

          <section aria-labelledby="donation-instructions" class="min-w-0 rounded-xl border border-[#cbd9c6] bg-white p-4 sm:p-5">
            <div id="donation-instructions" role="heading" aria-level="2" class="text-lg font-bold">{{ tr('DonationModal.cach_ung_ho') }}</div>
            <div class="mt-4 space-y-4 text-sm leading-6">
              <div>{{ tr('DonationModal.1_mo_ung_dung_ngan_hang_va_quet_ma_qr_trong_cua_so_nay') }}</div>
              <div>{{ tr('DonationModal.2_neu_dang_dung_dien_thoai_tai_anh_qr_roi_chon_anh_trong_muc_que') }}</div>
              <div>{{ tr('DonationModal.3_kiem_tra_thong_tin_nguoi_nhan_nhap_so_tien_ban_muon_ung_ho_roi') }}</div>
            </div>
          </section>

          <div class="space-y-2 text-sm leading-6">
            <div class="font-semibold">{{ tr('DonationModal.cam_on_ban_da_dong_hanh_cung_game') }}</div>
            <div class="text-[#52634f]">
              {{ tr('DonationModal.day_la_khoan_ung_ho_tu_nguyen_khong_phai_giao_dich_mua_ban_va_kh') }}
            </div>
          </div>
        </div>

        <div class="min-w-0 space-y-4">
        <figure class="min-w-0 overflow-hidden rounded-xl border border-[#cbd9c6] bg-white">
          <div v-if="!qrFailed" class="p-4">
            <img :src="qrImageUrl" :alt="tr('DonationModal.ma_qr_ung_ho_nha_phat_trien_chu_tai_khoan_do_huy_so_tai_khoan_06')" class="mx-auto h-auto w-50 max-w-sm object-contain" draggable="false" @error="qrFailed = true" />
          </div>
          <div v-else role="alert" class="px-5 py-12 text-center text-sm leading-6">
            {{ tr('DonationModal.khong_tai_duoc_ma_qr_ban_hay_nhan_lam_moi_de_thu_lai') }}
          </div>
        </figure>

          <dl class="space-y-3 rounded-xl border border-[#cbd9c6] bg-white p-4 text-sm">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt class="text-[#52634f]">{{ tr('DonationModal.ten_tai_khoan') }}</dt>
              <dd class="font-bold">DO HUY</dd>
            </div>
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt class="text-[#52634f]">{{ tr('DonationModal.ngan_hang') }}</dt>
              <dd class="font-semibold">Sacombank</dd>
            </div>
            <div class="border-t border-[#cbd9c6] pt-3">
              <dt class="text-[#52634f]">{{ tr('DonationModal.so_tai_khoan') }}</dt>
              <dd class="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span class="select-all text-lg font-bold tracking-wide tabular-nums">{{ donationAccountNumber }}</span>
                <button type="button" :aria-label="tr('DonationModal.sao_chep_so_tai_khoan')" @click="copyAccountNumber"
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 text-sm font-semibold transition hover:bg-[#e6efdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]">
                  <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                  </svg>
                  {{ tr('DonationModal.sao_chep') }}
                </button>
              </dd>
            </div>
          </dl>
          <a v-if="!qrFailed" :href="donationQrUrl" download="Sacombank_060319966989_DoHuy.png"
            class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#24352a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#36513f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#24352a]">
            {{ tr('DonationModal.tai_anh_qr') }}
          </a>
        </div>

    </main>
  </Modal>
</template>

<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { ref } from "vue";
import Modal from "../../shared/Modal.vue";
import { useToast } from "../../../composables/useToast.ts";

const donationQrUrl = `${import.meta.env.BASE_URL}Sacombank_060319966989_DoHuy.png`;
const donationAccountNumber = "060319966989";
const qrFailed = ref(false);
const qrImageUrl = ref(donationQrUrl);
const toast = useToast();

function refreshQr() {
  qrFailed.value = false;
  qrImageUrl.value = `${donationQrUrl}?refresh=${Date.now()}`;
}

async function copyAccountNumber() {
  try {
    await navigator.clipboard.writeText(donationAccountNumber);
    toast.success(tr('DonationModal.da_sao_chep_so_tai_khoan'));
  } catch {
    toast.error(tr('DonationModal.khong_the_sao_chep_ban_hay_sao_chep_so_tai_khoan_thu_cong'));
  }
}
</script>
