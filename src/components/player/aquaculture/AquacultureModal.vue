<script setup lang="ts">
import { t as tr } from "../../../i18n";

import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Modal from '../../shared/Modal.vue'
import Fishfarm from './Fishfarm.vue'
import { useAquacultureStore } from '../../../stores/aquaculture'
import { useAuthStore } from '../../../stores/auth'

const farm = useAquacultureStore()
const auth = useAuthStore()
const paused = ref(document.hidden)
watch(() => auth.user?.id ?? '', id => { void farm.initialize(id) }, { immediate: true, flush: 'sync' })

let timer: ReturnType<typeof setInterval> | undefined
function onVisibilityChange() {
  paused.value = document.hidden
  if (!document.hidden) { farm.updateClock(); void farm.refresh(true) }
}
onMounted(() => {
  timer = setInterval(() => { if (!document.hidden) void farm.poll() }, 15000)
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <Modal :title="tr('AquacultureModal.nong_trai_ca')" :sub-title="tr('AquacultureModal.nuoi_thong_tha')" :on-refresh="() => farm.refresh(true)">
    <Fishfarm :paused="paused" />
  </Modal>
</template>
