import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase env vars saknas. Kontrollera att VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY är satta i .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
