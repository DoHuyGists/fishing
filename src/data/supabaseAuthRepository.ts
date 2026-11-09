import supabase from "../database/connection";

export const supabaseAuthRepository = {
  async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL(`${import.meta.env.BASE_URL}reset-password`, window.location.origin).href,
    });
    if (error) throw new Error(error.message);
  },
  async updatePassword(password: string, currentPassword?: string) {
    const { error } = await supabase.auth.updateUser({ password, ...(currentPassword ? { current_password: currentPassword } : {}) });
    if (error) throw new Error(error.message);
  },
  async resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: "signup", email,
      options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href } });
    if (error) throw new Error(error.message);
  },
};
