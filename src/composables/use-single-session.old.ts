import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { RealtimeChannel } from '@supabase/supabase-js';
import supabase from "../database/connection";

export interface ActiveSession {
  user_id: string;
  active_session_id: string;
  updated_at?: string;
}

export function useSingleSession(userId: string) {
  const isTerminated = ref<boolean>(false);
  const currentSessionId = crypto.randomUUID();
  
  let realtimeChannel: RealtimeChannel | null = null;
  let broadcastChannel: BroadcastChannel | null = null;

  // 1. Kiểm tra nhanh giữa các Tab trên CÙNG TRÌNH DUYỆT (Client-side)
  const initTabCheck = () => {
    broadcastChannel = new BroadcastChannel('single_tab_channel');

    // Hỏi xem có tab nào đang mở không
    broadcastChannel.postMessage({ type: 'PING' });

    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'PING') {
        // Trả lời cho tab mới rằng tab này đang sống
        broadcastChannel?.postMessage({ type: 'PONG' });
      } else if (event.data?.type === 'PONG') {
        // Tab mới nhận được PONG -> Phát hiện tab trùng lập
        handleTermination('Ứng dụng đã được mở ở một tab khác trên trình duyệt này!');
      }
    };
  };

  // 2. Kiểm tra giữa các TRÌNH DUYỆT/THIẾT BỊ KHÁC NHAU (Supabase Realtime)
  const initCrossBrowserCheck = async (uid: string) => {
    // Đăng ký Session ID mới lên Supabase DB
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
      console.error('[Session Error] Khởi tạo session thất bại:', error.message);
      return;
    }

    // Lắng nghe realtime thay đổi dòng dữ liệu của user này
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
          
          // Nếu Session ID trên DB khác với Session ID của Tab hiện tại
          if (newSessionId !== currentSessionId) {
            handleTermination('Tài khoản của bạn vừa được đăng nhập ở một trình duyệt/thiết bị khác!');
          }
        }
      )
      .subscribe();
  };

  // Xử lý khi phát hiện phiên trùng lặp
  const handleTermination = async (reason: string) => {
    if (isTerminated.value) return;
    isTerminated.value = true;

    alert(reason);

    // Hủy kết nối
    cleanup();

    // Đăng xuất và điều hướng
    await supabase.auth.signOut();
    window.location.href = '/login?reason=duplicate_session';
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

  onMounted(() => {
    // Chạy kiểm tra tab nội bộ trước
    initTabCheck();

    // Nếu đã có userId thì đăng ký kết nối Supabase
    if (userId) {
      initCrossBrowserCheck(userId);
    }
  });

  onUnmounted(() => {
    cleanup();
  });

  return {
    isTerminated,
  };
}