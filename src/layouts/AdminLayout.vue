<script lang="ts" setup>
import Forbidden from "../components/Forbidden.vue";
import Loading from "../components/Loading.vue";
import { useAuthStore } from "../stores/auth";

const { loading, isAdmin } = useAuthStore();


</script>
<template>
  <div v-if="loading">
    <Loading />
  </div>
  <template v-else-if="isAdmin">
    <router-view></router-view>
  </template>
  <div v-else>
    <Forbidden />
  </div>
</template>
