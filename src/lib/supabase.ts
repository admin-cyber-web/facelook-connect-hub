import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qjkojvoypynmsvqvqlyk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa29qdm95cHlubXN2cXZxbHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTU3MDAsImV4cCI6MjA4OTc3MTcwMH0.dJrUWygyVnBE4Pr9K8o89C2PnjNKWVbGzKkHxKqXYpA";

export const supabase = createClient(supabaseUrl, supabaseKey);
