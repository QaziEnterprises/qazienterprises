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
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;

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

// Universal schema metadata so any AI can reconstruct the app
const TABLE_SCHEMAS = {
  contacts: {
    description: "Business contacts - customers, suppliers, and other parties",
    columns: {
      id: "uuid primary key",
      name: "text, contact full name",
      type: "text, one of: customer | supplier | both",
      phone: "text, phone number",
      email: "text, email address",
      address: "text, street address",
      city: "text, city name",
      opening_balance: "numeric, starting balance when contact was added",
      current_balance: "numeric, current outstanding balance (positive = they owe us, negative = we owe them)",
      notes: "text, additional notes",
      created_at: "timestamp",
      updated_at: "timestamp",
    },
    relationships: ["Referenced by purchases.supplier_id", "Referenced by sale_transactions.customer_id"],
  },
  products: {
    description: "Product catalog with inventory tracking",
    columns: {
      id: "uuid primary key",
      name: "text, product name",
      sku: "text, stock keeping unit code",
      brand: "text, product brand",
      description: "text, product description",
      category_id: "uuid, references product_categories.id",
      purchase_price: "numeric, cost price per unit",
      selling_price: "numeric, retail price per unit",
      quantity: "numeric, current stock quantity",
      unit: "text, unit of measure (pcs, kg, etc.)",
      alert_threshold: "numeric, minimum stock level before low-stock alert triggers",
      created_at: "timestamp",
      updated_at: "timestamp",
    },
    relationships: ["Belongs to product_categories via category_id", "Referenced by purchase_items and sale_items"],
  },
  product_categories: {
    description: "Categories for organizing products",
    columns: {
      id: "uuid primary key",
      name: "text, category name",
      description: "text, category description",
      created_at: "timestamp",
    },
    relationships: ["Referenced by products.category_id"],
  },
  purchases: {
    description: "Purchase orders from suppliers",
    columns: {
      id: "uuid primary key",
      date: "date, purchase date",
      supplier_id: "uuid, references contacts.id (type=supplier)",
      total: "numeric, total purchase amount",
      discount: "numeric, discount applied",
      payment_method: "text, cash | bank | cheque | credit",
      payment_status: "text, paid | due | partial",
      reference_no: "text, external reference number",
      notes: "text, purchase notes",
      created_by: "uuid, user who created this",
      created_at: "timestamp",
    },
    relationships: ["References contacts via supplier_id", "Has many purchase_items"],
  },
  purchase_items: {
    description: "Individual line items within a purchase order",
    columns: {
      id: "uuid primary key",
      purchase_id: "uuid, references purchases.id",
      product_id: "uuid, references products.id",
      quantity: "numeric, quantity purchased",
      unit_price: "numeric, price per unit",
      subtotal: "numeric, quantity × unit_price",
    },
    relationships: ["Belongs to purchases", "References products"],
  },
  sale_transactions: {
    description: "Sales/invoices to customers",
    columns: {
      id: "uuid primary key",
      date: "date, sale date",
      invoice_no: "text, auto-generated invoice number (INV-XXXXXX)",
      customer_id: "uuid, references contacts.id (type=customer), null for walk-in",
      customer_type: "text, walk-in | registered",
      subtotal: "numeric, total before discount",
      discount: "numeric, discount amount",
      total: "numeric, final amount after discount",
      payment_method: "text, cash | bank | cheque | credit",
      payment_status: "text, paid | due | partial",
      notes: "text, sale notes",
      created_by: "uuid, user who created this",
      created_at: "timestamp",
    },
    relationships: ["References contacts via customer_id", "Has many sale_items"],
  },
  sale_items: {
    description: "Individual line items within a sale/invoice",
    columns: {
      id: "uuid primary key",
      sale_id: "uuid, references sale_transactions.id",
      product_id: "uuid, references products.id",
      product_name: "text, product name at time of sale (denormalized)",
      quantity: "numeric, quantity sold",
      unit_price: "numeric, selling price per unit",
      subtotal: "numeric, quantity × unit_price",
    },
    relationships: ["Belongs to sale_transactions", "References products"],
  },
  expenses: {
    description: "Business expenses and overhead costs",
    columns: {
      id: "uuid primary key",
      date: "date, expense date",
      amount: "numeric, expense amount",
      description: "text, what the expense was for",
      category_id: "uuid, references expense_categories.id",
      payment_method: "text, cash | bank | cheque",
      reference_no: "text, receipt or reference number",
      created_by: "uuid, user who recorded this",
      created_at: "timestamp",
    },
    relationships: ["References expense_categories via category_id"],
  },
  expense_categories: {
    description: "Categories for organizing expenses (rent, utilities, transport, etc.)",
    columns: {
      id: "uuid primary key",
      name: "text, category name",
      created_at: "timestamp",
    },
    relationships: ["Referenced by expenses.category_id"],
  },
  daily_summaries: {
    description: "Aggregated daily business metrics",
    columns: {
      id: "uuid primary key",
      date: "date, summary date (unique per day)",
      total_sales: "numeric, total sales revenue for the day",
      sales_count: "integer, number of sales transactions",
      total_purchases: "numeric, total purchase costs for the day",
      purchases_count: "integer, number of purchase orders",
      total_expenses: "numeric, total expenses for the day",
      expenses_count: "integer, number of expense entries",
      net_profit: "numeric, total_sales - total_purchases - total_expenses",
      created_at: "timestamp",
      updated_at: "timestamp",
    },
    relationships: [],
  },
  cash_register: {
    description: "Daily cash drawer tracking with open/close reconciliation",
    columns: {
      id: "uuid primary key",
      date: "date, register date",
      opening_balance: "numeric, cash in drawer at start of day",
      cash_in: "numeric, total cash received during day",
      cash_out: "numeric, total cash paid out during day",
      expected_balance: "numeric, opening + cash_in - cash_out",
      actual_balance: "numeric, physically counted cash at end of day",
      discrepancy: "numeric, actual - expected (positive = surplus, negative = shortage)",
      status: "text, open | closed",
      notes: "text, end-of-day notes",
      opened_by: "uuid, user who opened register",
      closed_by: "uuid, user who closed register",
      created_at: "timestamp",
      updated_at: "timestamp",
    },
    relationships: [],
  },
  todos: {
    description: "Quick notes and task reminders",
    columns: {
      id: "uuid primary key",
      title: "text, note/task content",
      completed: "boolean, whether task is done",
      priority: "text, normal | high | urgent",
      created_by: "uuid, user who created this",
      created_at: "timestamp",
      updated_at: "timestamp",
    },
    relationships: [],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string | null = null;

    // Check if this is a scheduled (cron) call or user-initiated
    const authHeader = req.headers.get("Authorization");
    const bodyText = await req.text();
    const bodyJson = bodyText ? JSON.parse(bodyText).catch?.(() => ({})) : {};
    let isScheduled = false;

    try {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      isScheduled = parsed.scheduled === true;
    } catch {}

    if (isScheduled) {
      // Cron job: backup for ALL users who have connected Google Drive
      const { data: allTokens } = await supabase.from("google_drive_tokens").select("user_id");
      if (!allTokens || allTokens.length === 0) {
        return new Response(JSON.stringify({ message: "No connected users to backup" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = [];
      for (const tokenEntry of allTokens) {
        try {
          const result = await performBackup(supabase, tokenEntry.user_id);
          results.push({ user_id: tokenEntry.user_id, ...result });
        } catch (err) {
          results.push({ user_id: tokenEntry.user_id, error: err.message });
        }
      }

      return new Response(JSON.stringify({ scheduled: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-initiated: validate JWT
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
    userId = claimsData.claims.sub as string;

    const result = await performBackup(supabase, userId);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function performBackup(supabase: any, userId: string) {
    // Get stored tokens
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("google_drive_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (tokenErr || !tokenRow) {
      throw new Error("Google Drive not connected for user " + userId);
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
    const tableNames = Object.keys(TABLE_SCHEMAS);
    const tableData: Record<string, unknown[]> = {};
    const backedUpTables: string[] = [];
    const tableCounts: Record<string, number> = {};

    for (const table of tableNames) {
      const { data, error } = await supabase.from(table).select("*");
      if (!error && data) {
        tableData[table] = data;
        backedUpTables.push(table);
        tableCounts[table] = data.length;
      }
    }

    // Build universal backup document
    const now = new Date();
    const universalBackup = {
      _metadata: {
        format_version: "2.0",
        type: "universal_business_backup",
        description: "Complete business data backup for Qazi Enterprises. This file is self-documenting and can be used by any AI system to reconstruct the full business application, migrate data to another platform, or analyze business operations.",
        business_name: "Qazi Enterprises",
        business_type: "Trading / Wholesale & Retail",
        currency: "PKR (Pakistani Rupee)",
        created_at: now.toISOString(),
        created_date: now.toISOString().slice(0, 10),
        tables_included: backedUpTables,
        record_counts: tableCounts,
        total_records: Object.values(tableCounts).reduce((a, b) => a + b, 0),
        instructions_for_ai: [
          "This backup contains the complete database of a business management application.",
          "Each table has a schema section describing columns, data types, and relationships.",
          "Use the schema section to create database tables with proper foreign keys.",
          "The data section contains all records for each table.",
          "Monetary values are in PKR (Pakistani Rupee) unless noted otherwise.",
          "UUIDs are used as primary keys throughout. Preserve them to maintain relationships.",
          "Timestamps are in ISO 8601 format with timezone.",
          "To rebuild the app: 1) Create tables using schemas, 2) Import data, 3) Build UI for POS, inventory, contacts, purchases, sales, expenses, reports, and cash register.",
          "Key features: Point of Sale, Invoice generation (INV-XXXXXX format), Inventory with low-stock alerts, Customer/Supplier ledger with balances, Daily cash register reconciliation, Expense tracking by category, Daily profit summaries, Khata (credit book) system.",
        ],
      },
      schema: TABLE_SCHEMAS,
      data: tableData,
    };

    const backupJson = JSON.stringify(universalBackup, null, 2);
    const fileName = `QaziEnterprisesBackup_${now.toISOString().slice(0, 10)}_${now.getTime()}.json`;

    // Get or create backup folder
    const folderId = await getOrCreateFolder(accessToken, "QaziEnterprisesBackups");

    // Upload file
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
      await supabase.from("backup_history").insert({
        user_id: userId,
        file_name: fileName,
        status: "failed",
        error_message: JSON.stringify(uploadData),
        tables_backed_up: backedUpTables,
      });
      throw new Error("Upload failed: " + JSON.stringify(uploadData));
    }

    await supabase.from("backup_history").insert({
      user_id: userId,
      file_name: fileName,
      drive_file_id: uploadData.id,
      status: "completed",
      tables_backed_up: backedUpTables,
      size_bytes: parseInt(uploadData.size || "0"),
    });

    return {
      success: true,
      file_name: fileName,
      drive_file_id: uploadData.id,
      tables_count: backedUpTables.length,
      total_records: Object.values(tableCounts).reduce((a, b) => a + b, 0),
      size_bytes: uploadData.size,
    };
}
