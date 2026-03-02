import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const admins = [
      { email: "muazbinshafi@gmail.com", password: "Mu@z!3!2" },
      { email: "imrankhalilqazi@gmail.com", password: "Imr@n@786" },
    ];

    const results = [];

    for (const admin of admins) {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email === admin.email);

      if (existing) {
        // Ensure admin role exists
        const { data: roleExists } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", existing.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleExists) {
          await supabase.from("user_roles").insert({ user_id: existing.id, role: "admin" });
        }
        results.push({ email: admin.email, status: "exists", id: existing.id });
        continue;
      }

      // Create user
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true,
        user_metadata: { display_name: admin.email.split("@")[0] },
      });

      if (error) {
        results.push({ email: admin.email, status: "error", error: error.message });
        continue;
      }

      // Assign admin role
      await supabase.from("user_roles").insert({ user_id: newUser.user.id, role: "admin" });
      results.push({ email: admin.email, status: "created", id: newUser.user.id });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
