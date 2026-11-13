import { onScopeDispose, ref, watch } from "vue";
import type ConfettiCannon from "../components/shared/ConfettiCannon.vue";
import { useAuthStore } from "../stores/auth";
import { useUserProfileStore } from "../stores/userProfile";

/** Mount once in App.vue so celebrations survive route changes. */
export function useLevelUpCelebration() {
  const auth = useAuthStore();
  const userProfile = useUserProfileStore();
  const confetti = ref<InstanceType<typeof ConfettiCannon> | null>(null);

  watch(() => auth.user?.id, (userId) => {
    confetti.value?.clear();
    if (!userId) return;
    void userProfile.fetchProfile(userId);
  }, { immediate: true, flush: "sync" });

  watch(
    () => {
      const userId = auth.user?.id;
      const profile = userProfile.profile;
      return { userId, level: userId && profile?.id === userId ? profile.level : null };
    },
    (current, previous) => {
      if (current.userId === previous?.userId && current.level != null &&
          previous?.level != null && current.level > previous.level) {
        confetti.value?.fireCannons();
      }
    },
    { flush: "post" },
  );

  onScopeDispose(() => confetti.value?.clear());

  return { confetti };
}
