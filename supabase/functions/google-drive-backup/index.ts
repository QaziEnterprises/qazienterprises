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

async function getOrCreateFolder(accessToken: string, folderName: string): Promise<string> {
  // Search for existing folder
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  
  if (searchData.files?.length > 0) return searchData.files[0].id;

  // Create folder
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

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

    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(jwtToken);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get stored tokens
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("google_drive_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "Google Drive not connected. Please connect first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token if expired
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

    // Fetch all business data
    const tables = [
      "contacts", "products", "product_categories", "purchases", "purchase_items",
      "sale_transactions", "sale_items", "expenses", "expense_categories",
      "daily_summaries", "cash_register", "todos",
    ];

    const backupData: Record<string, unknown[]> = {};
    const backedUpTables: string[] = [];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("*");
      if (!error && data) {
        backupData[table] = data;
        backedUpTables.push(table);
      }
    }

    const backupJson = JSON.stringify(backupData, null, 2);
    const now = new Date();
    const fileName = `QaziEnterprisesBackup_${now.toISOString().slice(0, 10)}_${now.getTime()}.json`;

    // Get or create backup folder
    const folderId = await getOrCreateFolder(accessToken, "QaziEnterprisesBackups");

    // Upload file using multipart upload
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
      mimeType: "application/json",
    });

    const boundary = "backup_boundary_" + Date.now();
    const body = 
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${backupJson}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      // Log backup failure
      await supabase.from("backup_history").insert({
        user_id: userId,
        file_name: fileName,
        status: "failed",
        error_message: JSON.stringify(uploadData),
        tables_backed_up: backedUpTables,
      });
      return new Response(JSON.stringify({ error: "Upload failed", details: uploadData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log success
    await supabase.from("backup_history").insert({
      user_id: userId,
      file_name: fileName,
      drive_file_id: uploadData.id,
      status: "completed",
      tables_backed_up: backedUpTables,
      size_bytes: parseInt(uploadData.size || "0"),
    });

    return new Response(JSON.stringify({
      success: true,
      file_name: fileName,
      drive_file_id: uploadData.id,
      tables_count: backedUpTables.length,
      size_bytes: uploadData.size,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
