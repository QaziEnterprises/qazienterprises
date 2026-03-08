import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cloud, CloudOff, Download, RefreshCw, CheckCircle2, XCircle, Loader2, HardDrive, Clock } from "lucide-react";
import { format } from "date-fns";

interface BackupRecord {
  id: string;
  file_name: string;
  drive_file_id: string | null;
  status: string;
  tables_backed_up: string[] | null;
  size_bytes: number | null;
  error_message: string | null;
  created_at: string;
}

export default function BackupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [history, setHistory] = useState<BackupRecord[]>([]);

  useEffect(() => {
    checkConnection();
    loadHistory();
    if (searchParams.get("connected") === "true") {
      toast({ title: "Google Drive Connected!", description: "You can now create backups." });
    }
  }, []);

  async function checkConnection() {
    setLoading(true);
    const { data } = await supabase
      .from("google_drive_tokens")
      .select("id")
      .eq("user_id", user?.id || "")
      .maybeSingle();
    setConnected(!!data);
    setLoading(false);
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("backup_history")
      .select("*")
      .eq("user_id", user?.id || "")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data as unknown as BackupRecord[]);
  }

  async function connectDrive() {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("google-drive-auth", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast({ title: "Error", description: res.data?.error || "Failed to get auth URL", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setConnecting(false);
  }

  async function runBackup() {
    setBackingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("google-drive-backup", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.data?.success) {
        toast({ title: "Backup Complete!", description: `${res.data.tables_count} tables backed up to Google Drive.` });
        loadHistory();
      } else {
        toast({ title: "Backup Failed", description: res.data?.error || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setBackingUp(false);
  }

  async function disconnectDrive() {
    await supabase.from("google_drive_tokens").delete().eq("user_id", user?.id || "");
    setConnected(false);
    toast({ title: "Disconnected", description: "Google Drive has been disconnected." });
  }

  function formatBytes(bytes: number | null) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Google Drive Backup</h1>
        <p className="text-muted-foreground">Keep your business data safe with automated backups to Google Drive.</p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {connected ? <Cloud className="h-5 w-5 text-green-600" /> : <CloudOff className="h-5 w-5 text-muted-foreground" />}
            Google Drive Connection
          </CardTitle>
          <CardDescription>
            {connected
              ? "Your Google Drive is connected and ready for backups."
              : "Connect your Google account to enable cloud backups."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {connected ? (
            <>
              <Button onClick={runBackup} disabled={backingUp}>
                {backingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDrive className="mr-2 h-4 w-4" />}
                {backingUp ? "Backing up..." : "Backup Now"}
              </Button>
              <Button variant="outline" onClick={disconnectDrive}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={connectDrive} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
              Connect Google Drive
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Backup History
          </CardTitle>
          <CardDescription>Your recent backups stored in the QaziEnterprisesBackups folder.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No backups yet. Connect Google Drive and create your first backup.</p>
          ) : (
            <div className="space-y-3">
              {history.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {b.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{b.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(b.created_at), "MMM d, yyyy h:mm a")} · {b.tables_backed_up?.length || 0} tables · {formatBytes(b.size_bytes)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={b.status === "completed" ? "default" : "destructive"}>
                    {b.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={loadHistory}>
              <RefreshCw className="mr-2 h-3 w-3" /> Refresh
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What gets backed up?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
            {["Contacts", "Products", "Categories", "Purchases", "Sales", "Expenses", "Daily Summaries", "Cash Register", "Todos"].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> {t}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
