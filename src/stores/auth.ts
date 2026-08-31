import type { Session, User } from "@supabase/supabase-js";
import { defineStore } from "pinia";
import supabase from "../database/connection";

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
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.session),
  },
  actions: {
    async initialize() {
      if (this.initialized) return;

      this.loading = true;
      const { data, error } = await supabase.auth.getSession();
      this.session = data.session;
      this.user = data.session?.user ?? null;
      this.error = error?.message ?? "";
      this.loading = false;
      this.initialized = true;

      supabase.auth.onAuthStateChange((_event, session) => {
        this.session = session;
        this.user = session?.user ?? null;
      });
    },
    async signIn({ email, password }: Credentials) {
      this.loading = true;
      this.error = "";
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      this.session = data.session;
      this.user = data.user;
      this.error = error?.message ?? "";
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
      }
      this.error = error?.message ?? "";
      this.loading = false;
      return !error;
    },
  },
});
