<script lang="ts" setup>
import Forbidden from "../components/Forbidden.vue";
import Loading from "../components/Loading.vue";
import { useAuthStore } from "../stores/auth";
import { storeToRefs } from "pinia";

const { loading, initialized, adminLoading, isAdmin } = storeToRefs(useAuthStore());


</script>
<template>
  <div v-if="!initialized || loading || adminLoading">
    <Loading />
  </div>
  <template v-else-if="isAdmin">
    <router-view></router-view>
  </template>
  <div v-else>
    <Forbidden />
  </div>
</template>
