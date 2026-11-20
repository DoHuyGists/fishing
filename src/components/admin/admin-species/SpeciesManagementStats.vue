<script setup lang="ts">
import type { SpeciesRow } from "../../../types/table/species";

defineProps<{ species: SpeciesRow }>();

const fields = [
  { key: "active_time", label: "Thời gian hoạt động" },
  { key: "fish_type", label: "Loại cá" },
  { key: "experience_point", label: "Điểm kinh nghiệm" },
  { key: "strength", label: "Sức mạnh kéo" },
  { key: "alertness", label: "Độ cảnh giác" },
  { key: "burst_multiplier", label: "Hệ số bùng nổ" },
  { key: "rare_weight", label: "Trọng số độ hiếm" },
  { key: "season_weight", label: "Trọng số theo mùa" },
] as const;
</script>

<template>
  <dl class="m-0 grid grid-cols-2 gap-3 text-xs">
    <div v-for="field in fields" :key="field.key" class="min-w-0">
      <dt class="text-gray-500">{{ field.label }}</dt>
      <dd class="m-0 mt-1 break-words text-content">{{ species[field.key] ?? "—" }}</dd>
    </div>
  </dl>
</template>
