<script setup lang="ts">
import { useFishingStore, type FishingTool } from "../stores/fishing";

const store = useFishingStore();
const tools: { id: FishingTool; icon: string; name: string; detail: string }[] = [
  { id: "rod", icon: "🎣", name: "Cần câu", detail: "Cần tre" },
  { id: "bait", icon: "🪱", name: "Mồi câu", detail: "Giun đất" },
  { id: "lure", icon: "🪶", name: "Mồi giả", detail: "Cá nhỏ" },
  { id: "net", icon: "🕸", name: "Vợt cá", detail: "Sợi mảnh" },
];
</script>

<template>
  <nav class="equipment-menu" aria-label="Dụng cụ câu cá">
    <button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      class="tool"
      :class="{ selected: store.selectedTool === tool.id }"
      @click="store.selectTool(tool.id)"
    >
      <span class="tool-icon">{{ tool.icon }}</span>
      <span
        ><strong>{{ tool.name }}</strong
        ><small>{{ tool.detail }}</small></span
      >
      <span v-if="store.selectedTool === tool.id" class="selected-mark">✓</span>
    </button>
  </nav>
</template>

<style scoped>
.equipment-menu {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.tool {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px;
  border: 1px solid #e4dfd4;
  border-radius: 14px;
  background: #fffefa;
  color: #345344;
  cursor: pointer;
  text-align: left;
  transition: 0.18s ease;
}
.tool:hover {
  border-color: #9fc17a;
  transform: translateY(-2px);
}
.tool.selected {
  border-color: #5d9a5b;
  background: #eef8e9;
  box-shadow: inset 0 0 0 1px #b9dba7;
}
.tool-icon {
  display: grid;
  flex: 0 0 33px;
  place-items: center;
  width: 33px;
  height: 33px;
  border-radius: 10px;
  background: #f3ead8;
  font-size: 18px;
  filter: saturate(0.85);
}
.selected .tool-icon {
  background: #d8edc9;
}
.tool strong,
.tool small {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tool strong {
  font-size: 11px;
}
.tool small {
  margin-top: 3px;
  color: #7b8d81;
  font-size: 9px;
}
.selected-mark {
  position: absolute;
  top: 6px;
  right: 7px;
  color: #4d9556;
  font-size: 11px;
  font-weight: 900;
}
@media (max-width: 620px) {
  .equipment-menu {
    grid-template-columns: repeat(2, 1fr);
  }
  .tool {
    padding: 9px;
  }
}
</style>
