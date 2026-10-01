import { type _RouterClassic } from "vue-router";
import { supabaseUserInAreaRepository } from "../data/supabaseUserInAreaRepository";

let channel: ReturnType<typeof supabaseUserInAreaRepository.subscribeToAreaUsers> | null = null;

/** Lắng nghe thay đổi ở bảng user_in_area */
export function useAreaUserSocket(userId : string, router: _RouterClassic) {
  async function syncArea() {
    const currentAreaId = await supabaseUserInAreaRepository.getCurrentUserArea(userId);
    if (currentAreaId) {
      router.replace({ name: "fishing" });
    } else {
      router.replace({ name: "home" });
    }
  }

  function subcribe() {
    if(channel != null){
      channel = supabaseUserInAreaRepository.subscribeToAreaUsers(async () => {
        await syncArea();
      });
    }
  }

  function unSubscribe() {
    if (channel) {
      supabaseUserInAreaRepository.unsubscribe(channel);
    } else {
      console.warn("Not subscribe yet");
    }
  }

  return {
    subcribe,
    unSubscribe,
  };
}
