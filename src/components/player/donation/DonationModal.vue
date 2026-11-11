<template>
  <Modal title="Ủng hộ phát triển" :show-count-data="false" :on-refresh="refreshQr">
    <main class="grid min-h-full w-full items-start gap-5 rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-3 text-[#24352a] sm:grid-cols-2 sm:p-5">
        <div class="min-w-0 space-y-6">
          <div class="space-y-2">
            <div role="heading" aria-level="2" class="text-xl font-bold sm:text-2xl">Cùng duy trì và phát triển game</div>
            <div class="text-sm leading-6 sm:text-base">
              Sự ủng hộ của bạn giúp nhà phát triển duy trì máy chủ và tiếp tục nâng cấp game.
              Mọi khoản đóng góp đều hoàn toàn tự nguyện, với số tiền do bạn lựa chọn.
            </div>
          </div>

          <section aria-labelledby="donation-instructions" class="min-w-0 rounded-xl border border-[#cbd9c6] bg-white p-4 sm:p-5">
            <div id="donation-instructions" role="heading" aria-level="2" class="text-lg font-bold">Cách ủng hộ</div>
            <div class="mt-4 space-y-4 text-sm leading-6">
              <div>1. Mở ứng dụng ngân hàng và quét mã QR trong cửa sổ này.</div>
              <div>2. Nếu đang dùng điện thoại, tải ảnh QR rồi chọn ảnh trong mục quét QR của ứng dụng ngân hàng.</div>
              <div>3. Kiểm tra thông tin người nhận, nhập số tiền bạn muốn ủng hộ rồi xác nhận chuyển khoản.</div>
            </div>
          </section>

          <div class="space-y-2 text-sm leading-6">
            <div class="font-semibold">Cảm ơn bạn đã đồng hành cùng game!</div>
            <div class="text-[#52634f]">
              Đây là khoản ủng hộ tự nguyện, không phải giao dịch mua bán và không thể hoàn lại.
              Vui lòng kiểm tra kỹ thông tin trước khi chuyển khoản.
            </div>
          </div>
        </div>

        <div class="min-w-0 space-y-4">
        <figure class="min-w-0 overflow-hidden rounded-xl border border-[#cbd9c6] bg-white">
          <div v-if="!qrFailed" class="p-4">
            <img :src="qrImageUrl" alt="Mã QR ủng hộ nhà phát triển, chủ tài khoản DO HUY, số tài khoản 060319966989" class="mx-auto h-auto w-50 max-w-sm object-contain" draggable="false" @error="qrFailed = true" />
          </div>
          <div v-else role="alert" class="px-5 py-12 text-center text-sm leading-6">
            Không tải được mã QR. Bạn hãy nhấn Làm mới để thử lại.
          </div>
        </figure>

          <dl class="space-y-3 rounded-xl border border-[#cbd9c6] bg-white p-4 text-sm">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt class="text-[#52634f]">Tên tài khoản</dt>
              <dd class="font-bold">DO HUY</dd>
            </div>
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt class="text-[#52634f]">Ngân hàng</dt>
              <dd class="font-semibold">Sacombank</dd>
            </div>
            <div class="border-t border-[#cbd9c6] pt-3">
              <dt class="text-[#52634f]">Số tài khoản</dt>
              <dd class="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span class="select-all text-lg font-bold tracking-wide tabular-nums">{{ donationAccountNumber }}</span>
                <button type="button" aria-label="Sao chép số tài khoản" @click="copyAccountNumber"
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#cbd9c6] bg-[#f5f9f0] px-3 text-sm font-semibold transition hover:bg-[#e6efdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24352a]">
                  <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                  </svg>
                  Sao chép
                </button>
              </dd>
            </div>
          </dl>
          <a v-if="!qrFailed" :href="donationQrUrl" download="Sacombank_060319966989_DoHuy.png"
            class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#24352a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#36513f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#24352a]">
            Tải ảnh QR
          </a>
        </div>

    </main>
  </Modal>
</template>

<script lang="ts" setup>
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
    toast.success("Đã sao chép số tài khoản");
  } catch {
    toast.error("Không thể sao chép. Bạn hãy sao chép số tài khoản thủ công.");
  }
}
</script>
