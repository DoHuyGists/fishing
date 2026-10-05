// Phát hiện truy cập trên tab khác, đảm bảo chỉ được dùng trên một màn hình

import { ref, watch, onUnmounted} from 'vue';
import { RealtimeChannel } from '@supabase/supabase-js';
import supabase from "../database/connection";

export interface ActiveSession {
  user_id: string;
  active_session_id: string;
  updated_at?: string;
}

export function useSingleSession(userId: string) {
  // Trạng thái bật/tắt dialog cảnh báo
  const showConflictModal = ref<boolean>(false);
  const modalMessage = ref<string>('');
  
  // Phân loại nguồn xung đột: 'SAME_BROWSER' (cùng trình duyệt) hay 'CROSS_BROWSER' (khác trình duyệt)
  const conflictType = ref<'SAME_BROWSER' | 'CROSS_BROWSER' | null>(null);

  const currentSessionId = crypto.randomUUID();
  let realtimeChannel: RealtimeChannel | null = null;
  let broadcastChannel: BroadcastChannel | null = null;

  // -------------------------------------------------------------
  // 1. KIỂM TRA CÙNG TRÌNH DUYỆT (BroadcastChannel)
  // -------------------------------------------------------------
  const initTabCheck = () => {
    broadcastChannel = new BroadcastChannel('single_tab_channel');

    // Hỏi xem có tab nào khác đang mở không
    broadcastChannel.postMessage({ type: 'PING' });

    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'PING') {
        // Tab cũ đang sống -> Phản hồi lại
        broadcastChannel?.postMessage({ type: 'PONG' });
      } else if (event.data?.type === 'PONG') {
        // Tab mới nhận phản hồi -> Phát hiện trùng tab cùng trình duyệt
        conflictType.value = 'SAME_BROWSER';
        modalMessage.value = 'Ứng dụng đã được mở ở một tab khác trên trình duyệt này.';
        showConflictModal.value = true;
      }
    };
  };

  // -------------------------------------------------------------
  // 2. KIỂM TRA KHÁC TRÌNH DUYỆT/THIẾT BỊ (Supabase Realtime)
  // -------------------------------------------------------------
  const registerAndListenRealtime = async (uid: string) => {
    // Đăng ký Session ID của tab này lên Supabase
    const { error } = await supabase
      .from('active_sessions')
      .upsert(
        {
          user_id: uid,
          active_session_id: currentSessionId,
          updated_at: new Date().toISOString(),
        } as ActiveSession,
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[Session Error] Lỗi đăng ký session:', error.message);
      return;
    }

    // Lắng nghe xem có trình duyệt/thiết bị khác ghi đè Session ID không
    realtimeChannel = supabase
      .channel(`user-session:${uid}`)
      .on<ActiveSession>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_sessions',
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const newSessionId = payload.new.active_session_id;

          // Nếu Session ID ở DB bị đổi sang giá trị khác -> Trình duyệt cũ bị kick
          if (newSessionId !== currentSessionId) {
            conflictType.value = 'CROSS_BROWSER';
            modalMessage.value = 'Tài khoản của bạn vừa được đăng nhập trên một trình duyệt/thiết bị khác.';
            showConflictModal.value = true;
          }
        }
      )
      .subscribe();
  };

  // -------------------------------------------------------------
  // 3. CÁC HÀM XỬ LÝ SỰ KIỆN TỪ DIALOG
  // -------------------------------------------------------------

  // Option 1: Đóng tab hiện tại (Giữ nguyên Session của tab/thiết bị cũ)
  const closeCurrentTab = () => {
    cleanup();
    
    // Thử đóng tab
    window.close();

    // Trường hợp trình duyệt chặn window.close() (do tab không mở qua script)
    // Tự động chuyển hướng ra trang thông báo tĩnh
    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 300);
  };

  // Option 2: Đăng xuất hoàn toàn trên hệ thống
  const logoutAccount = async () => {
    cleanup();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const cleanup = () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
  };

  // Theo dõi userId (nhận từ computed/ref)
  watch(
    () => userId,
    (newUid) => {
      if (newUid) {
        initTabCheck();
        registerAndListenRealtime(newUid);
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    cleanup();
  });

  return {
    showConflictModal,
    modalMessage,
    conflictType,
    closeCurrentTab,
    logoutAccount,
  };
}