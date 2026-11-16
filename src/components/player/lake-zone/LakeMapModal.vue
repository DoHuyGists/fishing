<script setup lang="ts">
import { t as tr } from '../../../i18n'
import Modal from '../../shared/Modal.vue'
import Map from './Map.vue';


</script>

<template>
  <Modal :title="tr('LakeMapModal.title')">
    <Map/>
  </Modal>
</template>
