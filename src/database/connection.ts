import { createClient } from "@supabase/supabase-js";
import { createFeatureFetch } from "./featureRequestGate";
import { createMutationRefreshFetch } from "./mutationRefresh";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default createClient(supabaseUrl, supabaseKey, {
  global: { fetch: createMutationRefreshFetch(supabaseUrl, createFeatureFetch(supabaseUrl)) },
});
