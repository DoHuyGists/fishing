<script setup lang="ts">
import { useGameCatalogRefresh } from "../../../composables/useGameCatalogRefresh";
import { t as tr } from "../../../i18n";

import { watch } from "vue";
import Modal from "../../shared/Modal.vue";
import SkillCard from "./SkillCard.vue";
import { useSkillStore } from "../../../stores/player-skill-store.ts";
import { useAuthStore } from "../../../stores/auth";
import { useToast } from "../../../composables/useToast";

useGameCatalogRefresh(["skills"]);

const skillStore = useSkillStore();
const authStore = useAuthStore();
const toast = useToast();

async function refresh(force = false) {
  if (skillStore.upgradingId) return;
  if (!(await skillStore.fetchSkills(force)) && skillStore.error) {
    toast.error(skillStore.error, {
      get title() {
        return tr("SkillModal.khong_the_tai_ky_nang");
      },
    });
  }
}

watch(
  () => authStore.user?.id,
  () => refresh(),
  { immediate: true },
);

async function upgrade(skillId: string) {
  const result = await skillStore.upgradeSkill(skillId);
  if (result) {
    toast.success(
      tr("SkillModal.da_nang_value0_len_cap_value1", { value0: result.skill_name, value1: result.current_level }),
      {
        get title() {
          return tr("SkillModal.nang_cap_thanh_cong");
        },
      },
    );
  } else if (skillStore.upgradeError) {
    toast.error(skillStore.upgradeError, {
      get title() {
        return tr("SkillModal.nang_cap_that_bai");
      },
    });
  }
}
</script>

<template>
  <Modal :title="tr('SkillModal.ky_nang')" :on-refresh="() => refresh(true)">
    <section
      class="skill-board bg-palette-edf2e6 bg-[radial-gradient(var(--color-border-default)_0.7px,transparent_0.7px)] bg-size-[12px_12px] min-h-full w-full space-y-4 rounded-2xl p-3 text-content sm:p-4"
      :aria-busy="skillStore.loading"
    >
      <button
        v-if="skillStore.error"
        type="button"
        class="cursor-pointer text-sm font-bold text-emerald-800 underline disabled:opacity-50"
        :disabled="skillStore.loading || !!skillStore.upgradingId"
        @click="refresh(true)"
      >
        {{ tr("SkillModal.tai_lai_ky_nang") }}
      </button>
      <div v-if="skillStore.loading" role="status" class="py-4 text-center text-sm">
        {{ tr("SkillModal.dang_tai_ky_nang") }}
      </div>
      <div
        v-else-if="!skillStore.error && !skillStore.skillCards.length"
        class="rounded-xl border border-dashed border-border-default p-8 text-center text-sm"
      >
        {{ tr("SkillModal.chua_co_ky_nang_nao") }}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="m-0 text-[11px] font-extrabold uppercase tracking-[0.18em] text-palette-60745d">
          {{ tr("SkillModal.chon_ky_nang_de_ren_luyen") }}
        </div>
        <span aria-hidden="true" class="h-px flex-1 bg-border-default"></span>
        <div
          v-if="skillStore.remainingSkillPoints !== null"
          role="status"
          class="m-0 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs text-palette-52634c"
        >
          <span aria-hidden="true" class="mr-1 text-palette-8b651b">✦</span> {{ tr("SkillModal.diem_ky_nang") }}
          <strong class="tabular-nums text-emerald-800">{{ skillStore.remainingSkillPoints }}</strong>
        </div>
      </div>

      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-3">
        <SkillCard
          v-for="skill in skillStore.skillCards"
          :key="skill.id"
          :skill="skill"
          :disabled="skillStore.loading || !!skillStore.upgradingId || !!skillStore.error"
          :upgrading="skillStore.upgradingId === skill.id"
          @upgrade="upgrade"
        />
      </div>
    </section>
  </Modal>
</template>
