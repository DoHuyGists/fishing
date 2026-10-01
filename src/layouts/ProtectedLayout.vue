<script lang="ts" setup>
import { onBeforeMount, onBeforeUnmount } from 'vue';
import { useSingleSession } from '../composables/use-single-session';
import { useAuthStore } from '../stores/auth';
import { useTimezoneCheck } from '../composables/use-timezone-check';
import { useAreaUserSocket } from '../composables/use-area-check';
import { useRouter } from 'vue-router';

const router = useRouter();
const authStore = useAuthStore();
const areaUserSocket = useAreaUserSocket(authStore.userId, router)

const {
  showConflictModal,
  modalMessage,
  closeCurrentTab,
  logoutAccount,
} = useSingleSession(authStore.userId);

onBeforeMount(async ()=>{
  await useTimezoneCheck()
  areaUserSocket.subcribe()
})


onBeforeUnmount(() => {
  areaUserSocket.unSubscribe()
});

</script>

<template>
  <div class="layout-container">
    <router-view />

    <!-- Dialog Cảnh Báo Trùng Tab / Cross-Browser -->
    <Teleport to="body">
      <div v-if="showConflictModal" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <h3>⚠️ Phát hiện trùng phiên truy cập</h3>
          </div>
          
          <div class="modal-body">
            <p>{{ modalMessage }}</p>
            <p class="sub-text">Bạn vui lòng chọn thao tác tiếp theo:</p>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" @click="closeCurrentTab">
              Đóng tab này
            </button>
            <button class="btn btn-danger" @click="logoutAccount">
              Đăng xuất tài khoản
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.modal-card {
  background: #ffffff;
  padding: 24px;
  border-radius: 12px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header h3 {
  margin: 0 0 12px 0;
  color: #b91c1c;
  font-size: 1.25rem;
}

.modal-body p {
  margin: 0 0 8px 0;
  color: #374151;
  font-size: 0.95rem;
}

.modal-body .sub-text {
  color: #6b7280;
  font-size: 0.85rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: #e5e7eb;
  color: #1f2937;
}

.btn-danger {
  background: #dc2626;
  color: #ffffff;
}
</style>