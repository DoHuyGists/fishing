import { createClient } from "@supabase/supabase-js";
import { createFeatureFetch } from "./featureRequestGate";
import { createMutationRefreshFetch } from "./mutationRefresh";
import { createCatalogMutationFetch } from './catalogRequests';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default createClient(supabaseUrl, supabaseKey, {
  global: { fetch: createCatalogMutationFetch(supabaseUrl, createMutationRefreshFetch(supabaseUrl, createFeatureFetch(supabaseUrl))) },
});
