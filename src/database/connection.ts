import { createClient } from "@supabase/supabase-js";
import { createFeatureFetch } from "./featureRequestGate";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default createClient(supabaseUrl, supabaseKey, {
  global: { fetch: createFeatureFetch(supabaseUrl) },
});
