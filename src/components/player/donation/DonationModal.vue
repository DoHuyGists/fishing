<template>
  <Modal title="Ủng hộ nhà phát triển" sub-title="Quyên góp tự nguyện">
    <main class="mx-auto flex w-full max-w-xl flex-col items-center gap-5 py-4 text-center text-[#24352a]">
      <p class="max-w-lg text-sm leading-6 sm:text-base">
        Đây là khoản quyên góp tự nguyện để hỗ trợ nhà phát triển duy trì server và tiếp tục nâng cấp game. Khoản ủng hộ này không phải là giao dịch mua bán và không thể hoàn lại.
      </p>

      <div class="rounded-2xl border border-[#cbd9c6] bg-[#f5f9f0] p-4 shadow-sm">
        <img
          :src="donationQrUrl"
          alt="Mã QR quyên góp"
          class="mx-auto aspect-square w-64 max-w-full rounded-lg object-contain sm:w-72"
        />
      </div>

      <p class="text-sm font-semibold">Quét mã QR bằng ứng dụng ngân hàng để ủng hộ.</p>
    </main>
  </Modal>
</template>

<script lang="ts" setup>
import Modal from "../../shared/Modal.vue";

const donationQrUrl = "/donation/qr.png";
</script>
