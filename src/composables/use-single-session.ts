import { ref, watch, toValue, onUnmounted, type MaybeRefOrGetter } from 'vue';
import { t as tr } from '../i18n';
import { supabaseSessionRepository } from '../data/supabaseSessionRepository';
import { useAuthStore } from '../stores/auth';
import { createUuid } from '../utils/uuid';

export function useSingleSession(userId: MaybeRefOrGetter<string | null | undefined>) {
  const showConflictModal = ref(false);
  const modalMessage = ref('');
  const conflictType = ref<'SAME_BROWSER' | 'CROSS_BROWSER' | null>(null);
  const sessionReady = ref(false);
  const sessionError = ref('');
  const attempt = ref(0);
  const auth = useAuthStore();
  let stopSession = () => {};

  const stopWatch = watch([() => toValue(userId), attempt], ([uid], _, onCleanup) => {
    showConflictModal.value = false;
    conflictType.value = null;
    modalMessage.value = '';
    sessionReady.value = false;
    sessionError.value = '';
    if (!uid) return;

    const controller = new AbortController();
    const sessionId = createUuid();
    let stopped = false;
    let claimed = false;
    let readVersion = 0;
    let releaseLock = () => {};
    let stopRealtime = () => {};
    const current = () => !stopped && toValue(userId) === uid;
    const cleanup = () => {
      stopped = true;
      controller.abort();
      stopRealtime();
      releaseLock();
    };
    stopSession = cleanup;
    onCleanup(cleanup);

    const conflict = (type: 'SAME_BROWSER' | 'CROSS_BROWSER') => {
      if (!current()) return;
      conflictType.value = type;
      modalMessage.value = tr(type === 'SAME_BROWSER'
        ? 'use_single_session.ung_dung_da_duoc_mo_o_mot_tab_khac_tren_trinh_duyet_nay'
        : 'use_single_session.tai_khoan_cua_ban_vua_duoc_dang_nhap_tren_mot_trinh_duyet_thiet_');
      sessionReady.value = false;
      showConflictModal.value = true;
      cleanup();
    };
    const fail = (error: unknown) => {
      if (!current()) return;
      console.error('[Session Error]', error);
      sessionReady.value = false;
      sessionError.value = tr('use_single_session.registrationError');
      cleanup();
    };
    const verify = async () => {
      const version = ++readVersion;
      const owner = await supabaseSessionRepository.fetchOwner(uid, controller.signal);
      if (!current() || version !== readVersion) return;
      if (owner !== sessionId) conflict('CROSS_BROWSER');
      else sessionReady.value = true;
    };

    // Atomic account-scoped arbitration covers tabs opened simultaneously.
    // Rejected tabs never touch the server row. Hold the lock until cleanup.
    if (!navigator.locks) {
      sessionError.value = tr('use_single_session.unsupportedBrowser');
      return;
    }
    void navigator.locks.request(`single-player-session:${uid}`, { ifAvailable: true }, async lock => {
      if (!current()) return;
      if (!lock) { conflict('SAME_BROWSER'); return; }
      const released = new Promise<void>(resolve => { releaseLock = resolve; });
      try {
        const subscription = supabaseSessionRepository.listen(uid, () => {
          if (current() && claimed) void verify().catch(fail);
        }, connected => {
          if (!current()) return;
          // Discard in-flight reads from the previous connection. Keep the
          // mounted game during transient reconnects to preserve fishing state.
          ++readVersion;
          if (connected && claimed) void verify().catch(fail);
        });
        stopRealtime = subscription.stop;
        if (!await subscription.ready || !current()) return;
        await supabaseSessionRepository.claim(uid, sessionId, controller.signal);
        if (!current()) return;
        claimed = true;
        // Reconcile writes missed during registration and after reconnect.
        await verify();
        await released;
      } catch (error) {
        fail(error);
      } finally {
        stopRealtime();
      }
    }).catch(fail);
  }, { immediate: true, flush: 'sync' });

  onUnmounted(() => { stopWatch(); stopSession(); });

  const closeCurrentTab = () => {
    stopWatch();
    stopSession();
    window.close();
    setTimeout(() => { window.location.href = 'about:blank'; }, 300);
  };
  const logoutAccount = async () => {
    stopSession();
    if (await auth.signOut()) window.location.href = '/login';
    else {
      showConflictModal.value = false;
      sessionError.value = auth.error || tr('use_single_session.registrationError');
    }
  };

  return { showConflictModal, modalMessage, conflictType, sessionReady, sessionError,
    retrySession: () => { attempt.value++; }, closeCurrentTab, logoutAccount };
}
