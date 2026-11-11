import { t as tr } from "../i18n";
import supabase from "../database/connection";

export async function useTimezoneCheck() {
  // 1. Lấy Epoch timestamp hiện tại trên máy người dùng (bất kể họ chỉnh giờ nào)
  const clientTimeMs = Date.now();
  // 2. Gửi lên Supabase đối chiếu với Server Time
  const { data, error } = await supabase.rpc("verify_client_time", {
    client_epoch_ms: clientTimeMs,
  });

  if (error) {
    console.error("Lỗi kiểm tra:", error);
    return;
  }

  // 3. Xử lý kết quả
  if (data.is_tampered) {
    alert(tr('use_timezone_check.dong_ho_tren_may_ban_dang_lech_value0_phut_so_voi_gio_chuan_vui_', { value0: data.diff_minutes }));
    window.location.reload();
    return;
  }

  //   console.log(data.diff_seconds)
  // Tiến hành cho phép người dùng thực hiện hành động tiếp theo...
}
