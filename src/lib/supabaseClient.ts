import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://nbdgfnptvfzmvfxlazjd.supabase.co";

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZGdmbnB0dmZ6bXZmeGxhempkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTMwMTYsImV4cCI6MjA5MTU2OTAxNn0.q2KAugEqxuaTz930PEGKo4vh8kAyMuFZoAyMExB43xk";

export const supabase = createClient(supabaseUrl, supabaseKey);
