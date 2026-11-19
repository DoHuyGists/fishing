<script lang="ts" setup>
import Forbidden from "../components/Forbidden.vue";
import Loading from "../components/Loading.vue";
import { useAuthStore } from "../stores/auth";
import { storeToRefs } from "pinia";

const { loading, initialized, adminLoading, isAdmin } = storeToRefs(useAuthStore());


</script>
<template>
  <!-- Preserve the view and its drafts while the current admin's role is refreshed. -->
  <router-view v-if="initialized && isAdmin" />
  <div v-else-if="!initialized || loading || adminLoading">
    <Loading />
  </div>
  <div v-else>
    <Forbidden />
  </div>
</template>
