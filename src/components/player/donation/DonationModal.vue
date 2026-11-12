<template>
  <Modal :title="tr('DonationModal.ung_ho_phat_trien')" :show-count-data="false" :on-refresh="refreshQr">
    <main class="min-h-full w-full rounded-2xl bg-[#f5f9f0] p-4 text-[#24352a] sm:p-6 lg:p-8">
      <div class="mx-auto w-full max-w-6xl space-y-6">
        <div class="max-w-3xl space-y-3">
          <div role="heading" aria-level="2" class="text-xl font-bold tracking-tight sm:text-2xl">{{ tr('DonationModal.cung_duy_tri_va_phat_trien_game') }}</div>
          <div class="text-sm leading-6 text-[#52634f] sm:text-base">
            {{ tr('DonationModal.su_ung_ho_cua_ban_giup_nha_phat_trien_duy_tri_may_chu_va_tiep_tu') }}
          </div>
        </div>

        <div class="grid items-stretch gap-5 lg:grid-cols-2">
          <section aria-labelledby="donation-bank-title" class="slide-fade-in from-left player-content-in flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#cbd9c6] bg-white">
            <div class="flex items-center gap-3 border-b border-[#cbd9c6] bg-[#edf3e7] px-5 py-4">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#cbd9c6] bg-white text-[#36513f]">
                <svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 9 9-6 9 6H3Zm2 2v7m7-7v7m7-7v7M3 21h18" />
                </svg>
              </div>
              <div id="donation-bank-title" role="heading" aria-level="2" class="min-w-0 flex-1 text-base font-bold sm:text-lg">{{ tr('DonationModal.bankTransfer') }}</div>
              <span class="shrink-0 rounded-full border border-[#cbd9c6] bg-white px-2.5 py-1 text-xs font-semibold text-[#52634f]">VND</span>
            </div>

            <div class="flex flex-1 flex-col gap-5 p-5">
              <div class="grid items-center gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
                <figure class="mx-auto flex min-h-40 w-40 items-center justify-center overflow-hidden rounded-xl border border-[#cbd9c6] bg-white p-2">
                  <img v-if="!qrFailed" :src="qrImageUrl" :alt="tr('DonationModal.ma_qr_ung_ho_nha_phat_trien_chu_tai_khoan_do_huy_so_tai_khoan_06')"
                    class="h-auto w-full object-contain" draggable="false" @error="qrFailed = true" />
                  <div v-else role="alert" class="p-2 text-center text-xs leading-5 text-[#52634f]">{{ tr('DonationModal.khong_tai_duoc_ma_qr_ban_hay_nhan_lam_moi_de_thu_lai') }}</div>
                </figure>

                <dl class="min-w-0 space-y-3 text-sm">
                  <div class="space-y-1">
                    <dt class="text-xs text-[#52634f]">{{ tr('DonationModal.ten_tai_khoan') }}</dt>
                    <dd class="font-bold">DO HUY</dd>
                  </div>
                  <div class="space-y-1">
                    <dt class="text-xs text-[#52634f]">{{ tr('DonationModal.ngan_hang') }}</dt>
                    <dd class="font-semibold">Sacombank</dd>
                  </div>
                  <div class="space-y-1 border-t border-[#cbd9c6] pt-3">
                    <dt class="text-xs text-[#52634f]">{{ tr('DonationModal.so_tai_khoan') }}</dt>
                    <dd class="select-all break-all text-lg font-bold tracking-wide tabular-nums">{{ donationAccountNumber }}</dd>
                  </div>
                </dl>
              </div>

              <div class="mt-auto grid gap-3 sm:grid-cols-2">
                <button type="button" :aria-label="tr('DonationModal.sao_chep_so_tai_khoan')" @click="copyAccountNumber"
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cbd9c6] bg-[#f5f9f0] px-3 py-3 text-sm font-semibold transition hover:bg-[#e6efdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]">
                  <svg aria-hidden="true" class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                  </svg>
                  {{ tr('DonationModal.sao_chep') }}
                </button>
                <a v-if="!qrFailed" :href="donationQrUrl" download="Sacombank_060319966989_DoHuy.png"
                  class="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#24352a] px-3 py-3 text-sm font-semibold text-white no-underline transition hover:bg-[#36513f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]">
                  {{ tr('DonationModal.tai_anh_qr') }}
                </a>
              </div>
            </div>
          </section>

          <DonationPayment />
        </div>

        <section aria-labelledby="donation-instructions" class="slide-fade-in from-bottom player-content-in rounded-2xl border border-[#cbd9c6] bg-white p-5">
          <div id="donation-instructions" role="heading" aria-level="2" class="font-bold">{{ tr('DonationModal.bankInstructions') }}</div>
          <div class="mt-4 grid gap-3 text-sm leading-6 text-[#52634f] md:grid-cols-3">
            <div class="rounded-xl bg-[#f5f9f0] p-4">{{ tr('DonationModal.1_mo_ung_dung_ngan_hang_va_quet_ma_qr_trong_cua_so_nay') }}</div>
            <div class="rounded-xl bg-[#f5f9f0] p-4">{{ tr('DonationModal.2_neu_dang_dung_dien_thoai_tai_anh_qr_roi_chon_anh_trong_muc_que') }}</div>
            <div class="rounded-xl bg-[#f5f9f0] p-4">{{ tr('DonationModal.3_kiem_tra_thong_tin_nguoi_nhan_nhap_so_tien_ban_muon_ung_ho_roi') }}</div>
          </div>
        </section>

        <div class="space-y-2 px-1 text-sm leading-6">
          <div class="font-semibold">{{ tr('DonationModal.cam_on_ban_da_dong_hanh_cung_game') }}</div>
          <div class="text-[#52634f]">{{ tr('DonationModal.day_la_khoan_ung_ho_tu_nguyen_khong_phai_giao_dich_mua_ban_va_kh') }}</div>
        </div>
      </div>
    </main>
  </Modal>
</template>

<script lang="ts" setup>
import { t as tr } from "../../../i18n";

import { ref } from "vue";
import Modal from "../../shared/Modal.vue";
import DonationPayment from "./DonationPayment.vue";
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
