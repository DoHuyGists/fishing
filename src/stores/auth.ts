import type { UserProfile } from "../types/model/userProfile";
import { t as tr } from "../i18n";
import type { Session, User } from "@supabase/supabase-js";
import { defineStore } from "pinia";
import supabase from "../database/connection";
import { supabaseAuthRepository } from "../data/supabaseAuthRepository";
import { supabaseUserProfileRepository } from "../data/supabaseUserProfileRepository";

type Credentials = {
  email: string;
  password: string;
};

let initializationPromise: Promise<void> | null = null;
let adminStatusRequest = 0;

export const useAuthStore = defineStore("auth", {
  state: () => ({
    session: null as Session | null,
    user: null as User | null,
    profile: null as UserProfile | null,
    loading: false,
    initialized: false,
    error: "",
    isAdmin: false,
    adminLoading: false,
    recoveringPassword: false,
    passwordBusy: false,
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
    async requestPasswordReset(email: string) {
      if (this.passwordBusy) return;
      this.passwordBusy = true;
      try { await supabaseAuthRepository.requestPasswordReset(email.trim()); }
      finally { this.passwordBusy = false; }
    },
    async updatePassword(password: string, confirmation: string, currentPassword?: string) {
      if (this.passwordBusy) throw new Error(tr('auth.dang_xu_ly_mat_khau'));
      if (password.length < 8) throw new Error(tr('auth.mat_khau_can_it_nhat_8_ky_tu'));
      if (password !== confirmation) throw new Error(tr('auth.mat_khau_xac_nhan_khong_khop'));
      this.passwordBusy = true;
      try {
        await supabaseAuthRepository.updatePassword(password, currentPassword);
        this.recoveringPassword = false;
      } finally { this.passwordBusy = false; }
    },
    async resendConfirmation(email: string) {
      await supabaseAuthRepository.resendConfirmation(email.trim());
    },
    applySession(session: Session | null) {
      if (this.user?.id !== session?.user.id) {
        adminStatusRequest++;
        this.profile = null;
        this.isAdmin = false;
        this.adminLoading = Boolean(session?.user);
      }
      this.session = session;
      this.user = session?.user ?? null;
    },
    async initialize() {
      if (this.initialized) return;
      if (initializationPromise) return initializationPromise;

      this.loading = true;
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") this.recoveringPassword = true;
        this.applySession(session);
        if (!this.initialized || !session?.user) return;

        // Run database requests after the auth callback releases its lock.
        const userId = session.user.id;
        setTimeout(() => {
          if (this.user?.id === userId) void this.loadAdminStatus(userId);
        }, 0);
      });

      initializationPromise = (async () => {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          this.applySession(data.session);
          if (this.user) await this.loadAdminStatus(this.user.id);
        } catch (err) {
          this.error = err instanceof Error ? err.message : tr('auth.khong_the_tai_phien_dang_nhap');
        } finally {
          this.loading = false;
          this.initialized = true;
        }
      })();
      return initializationPromise;
    },
    async signIn({ email, password }: Credentials) {
      this.loading = true;
      this.error = "";
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      this.applySession(data.session);
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
        this.applySession(null);
      }
      this.error = error?.message ?? "";
      this.loading = false;
      return !error;
    },
    async loadAdminStatus(userId: string) {
      if (this.user?.id !== userId) return;
      const request = ++adminStatusRequest;
      this.adminLoading = true;
      try {
        const profile = await supabaseUserProfileRepository.fetchUserProfile(userId);
        if (this.user?.id === userId && request === adminStatusRequest) {
          this.isAdmin = profile?.is_admin ?? false;
          this.profile = profile;
        }
      } catch (err) {
        if (this.user?.id === userId && request === adminStatusRequest) {
          this.isAdmin = false;
          this.error = err instanceof Error ? err.message : tr('auth.khong_the_tai_quyen_quan_tri');
        }
      } finally {
        if (this.user?.id === userId && request === adminStatusRequest) {
          this.adminLoading = false;
        }
      }
    },
  },
});
