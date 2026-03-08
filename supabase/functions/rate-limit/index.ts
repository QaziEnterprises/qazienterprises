import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, action } = await req.json();

    if (!email || !action) {
      return new Response(
        JSON.stringify({ error: "Missing email or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const identifier = email.toLowerCase().trim();
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    if (action === "check") {
      // Count recent attempts
      const { count, error } = await supabase
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("identifier", identifier)
        .gte("attempted_at", windowStart);

      if (error) {
        console.error("Rate limit check error:", error);
        // Fail open - don't block login if rate limiter has issues
        return new Response(
          JSON.stringify({ allowed: true, remaining: MAX_ATTEMPTS }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const attempts = count ?? 0;
      const allowed = attempts < MAX_ATTEMPTS;
      const remaining = Math.max(0, MAX_ATTEMPTS - attempts);

      return new Response(
        JSON.stringify({ allowed, remaining, retryAfterMinutes: allowed ? 0 : WINDOW_MINUTES }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "record") {
      // Record a failed attempt
      const { error } = await supabase
        .from("login_attempts")
        .insert({ identifier });

      if (error) {
        console.error("Rate limit record error:", error);
      }

      return new Response(
        JSON.stringify({ recorded: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "clear") {
      // Clear attempts on successful login
      const { error } = await supabase
        .from("login_attempts")
        .delete()
        .eq("identifier", identifier);

      if (error) {
        console.error("Rate limit clear error:", error);
      }

      return new Response(
        JSON.stringify({ cleared: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Rate limit function error:", err);
    return new Response(
      JSON.stringify({ allowed: true, remaining: MAX_ATTEMPTS }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
