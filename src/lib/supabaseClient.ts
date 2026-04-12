import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://yhcvbqeklahwvtytqtil.supabase.co";

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloY3ZicWVrbGFod3Z0eXRxdGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODc1MTIsImV4cCI6MjA5MDM2MzUxMn0.tihpQ1M8TzGxYseuov9iFm7Icb-WHNFahFnUX2lfhto";

export const supabase = createClient(supabaseUrl, supabaseKey);
