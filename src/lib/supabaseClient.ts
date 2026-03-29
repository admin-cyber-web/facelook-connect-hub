import { createClient } from "@supabase/supabase-js";

// तुम्हारी नई डिटेल्स यहाँ डाल दी हैं
const supabaseUrl = "https://yhcvbqeklahwvtytqtil.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloY3ZicWVrbGFod3Z0eXRxdGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODc1MTIsImV4cCI6MjA5MDM2MzUxMn0.tihpQ1M8TzGxYseuov9iFm7Icb-WHNFahFnUX2lfhto";

export const supabase = createClient(supabaseUrl, supabaseKey);
