import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

async function getValidToken(supabase: any, userId: string) {
  const { data: tokenRow, error } = await supabase
    .from("google_drive_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !tokenRow) return null;

  let accessToken = tokenRow.access_token;
  if (new Date(tokenRow.expires_at) <= new Date()) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    accessToken = refreshed.access_token;
    await supabase.from("google_drive_tokens").update({
      access_token: accessToken,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  }
  return accessToken;
}

// Tables in dependency order (parents first)
const RESTORE_ORDER = [
  "expense_categories",
  "product_categories",
  "contacts",
  "products",
  "purchases",
  "purchase_items",
  "sale_transactions",
  "sale_items",
  "expenses",
  "daily_summaries",
  "cash_register",
  "todos",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accessToken = await getValidToken(supabase, userId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Google Drive not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    // === LIST backup files ===
    if (action === "list") {
      const folderSearch = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='QaziEnterprisesBackups' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const folderData = await folderSearch.json();

      if (!folderData.files?.length) {
        return new Response(JSON.stringify({ files: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const folderId = folderData.files[0].id;
      const filesRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=30`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const filesData = await filesRes.json();

      return new Response(JSON.stringify({ files: filesData.files || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === RESTORE from a backup file ===
    if (action === "restore") {
      const fileId = body.file_id;
      if (!fileId) {
        return new Response(JSON.stringify({ error: "file_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Download file from Drive
      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!downloadRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to download backup file from Drive" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const backupContent = await downloadRes.json();
      const data = backupContent.data || backupContent;

      // Validate backup structure
      if (!data || typeof data !== "object") {
        return new Response(JSON.stringify({ error: "Invalid backup file format" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: Record<string, { deleted: number; inserted: number; error?: string }> = {};

      // Delete in reverse order (children first) then insert in forward order (parents first)
      const deleteOrder = [...RESTORE_ORDER].reverse();

      for (const table of deleteOrder) {
        if (data[table] && Array.isArray(data[table])) {
          const { error: delErr } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (delErr) {
            results[table] = { deleted: 0, inserted: 0, error: `Delete failed: ${delErr.message}` };
          }
        }
      }

      // Insert in dependency order
      for (const table of RESTORE_ORDER) {
        const rows = data[table];
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          results[table] = { deleted: 0, inserted: 0 };
          continue;
        }

        // Insert in batches of 500
        let insertedCount = 0;
        let insertError = "";

        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error: insErr } = await supabase.from(table).upsert(batch, { onConflict: "id" });
          if (insErr) {
            insertError = insErr.message;
          } else {
            insertedCount += batch.length;
          }
        }

        results[table] = {
          deleted: rows.length,
          inserted: insertedCount,
          ...(insertError ? { error: insertError } : {}),
        };
      }

      const totalInserted = Object.values(results).reduce((s, r) => s + r.inserted, 0);
      const tablesRestored = Object.keys(results).filter(t => results[t].inserted > 0);

      return new Response(JSON.stringify({
        success: true,
        tables_restored: tablesRestored.length,
        total_records: totalInserted,
        details: results,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'list' or 'restore'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
