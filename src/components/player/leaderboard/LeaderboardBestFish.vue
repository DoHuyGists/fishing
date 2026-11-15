<script setup lang="ts">
import LeaderboardBoard from './LeaderboardBoard.vue';
import LeaderboardSeason from './LeaderboardSeason.vue';
</script>

<template>
  <LeaderboardBoard>
    <template #controls>
      <LeaderboardSeason />
    </template>
  </LeaderboardBoard>
</template>
