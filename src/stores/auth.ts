import type { Session, User } from "@supabase/supabase-js";
import { defineStore } from "pinia";
import supabase from "../database/connection";
import { supabaseUserProfileRepository } from "../data/supabaseUserProfileRepository";

type Credentials = {
  email: string;
  password: string;
};

export const useAuthStore = defineStore("auth", {
  state: () => ({
    session: null as Session | null,
    user: null as User | null,
    loading: false,
    initialized: false,
    error: "",
    isAdmin: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.session),
    userId: (state) => {
      if(state.user?.id){
        return state.user.id;
      }else{
        throw new Error("Missing user id");
      }
    }
  },
  actions: {
    async initialize() {
      if (this.initialized) return;

      this.loading = true;
      
      // Đăng ký listener TRƯỚC khi gọi getSession hoặc để Supabase tự quản lý
      supabase.auth.onAuthStateChange(async (event, session) => {
        
        const previousUserId = this.user?.id;
        this.session = session;
        this.user = session?.user ?? null;
        
        if (!session?.user) {
          this.isAdmin = false;
          return;
        }
        
        if (previousUserId !== session.user.id) {
          this.isAdmin = false;
        }
        
        // Gọi loadAdminStatus tại đây là đủ cho mọi trường hợp (khởi động, login, token refresh)

        await this.loadAdminStatus(session.user.id);
      });

      // Chỉ cần gọi getSession để ép Supabase trigger event ban đầu (nếu SDK chưa tự chạy)
      // Hoặc thậm chí để onAuthStateChange tự bắt session hiện tại của trình duyệt.
      const { data } = await supabase.auth.getSession();
      
      if (data.session?.user != null) {
        this.loading = false;
        this.initialized = true;
      }
    },
    async signIn({ email, password }: Credentials) {
      this.loading = true;
      this.error = "";
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      this.session = data.session;
      this.user = data.user;
      this.error = error?.message ?? "";
      this.isAdmin = false;
      if (!error && data.user) {
        await this.loadAdminStatus(data.user.id);
      }
      this.loading = false;
      return !error;
    },
    async signOut() {
      this.loading = true;
      this.error = "";
      const { error } = await supabase.auth.signOut();
      if (!error) {
        this.session = null;
        this.user = null;
        this.isAdmin = false;
      }
      this.error = error?.message ?? "";
      this.loading = false;
      return !error;
    },
    async loadAdminStatus(userId: string) {
      try {
        const profile = await supabaseUserProfileRepository.fetchUserProfile(userId);
        if (this.user?.id === userId) {
          this.isAdmin = profile?.is_admin ?? false;
        }
      } catch (err) {
        if (this.user?.id === userId) {
          this.isAdmin = false;
          this.error = err instanceof Error ? err.message : "Không thể tải quyền quản trị";
        }
      }
    },
  },
});
