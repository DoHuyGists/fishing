import type { Session, User } from "@supabase/supabase-js";
import { defineStore } from "pinia";
import supabase from "../database/connection";
import { supabaseUserProfileRepository, type UserProfile } from "../data/supabaseUserProfileRepository";

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
      supabase.auth.onAuthStateChange((_, session) => {
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
          this.error = err instanceof Error ? err.message : "Không thể tải phiên đăng nhập";
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
          this.error = err instanceof Error ? err.message : "Không thể tải quyền quản trị";
        }
      } finally {
        if (this.user?.id === userId && request === adminStatusRequest) {
          this.adminLoading = false;
        }
      }
    },
  },
});
