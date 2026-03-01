import { useState, useEffect } from "react";
import { UserPlus, Trash2, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface UserProfile {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  role: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    if (profiles) {
      const userList = profiles.map((p: any) => {
        const userRole = roles?.find((r: any) => r.user_id === p.user_id);
        return {
          user_id: p.user_id,
          email: p.email,
          display_name: p.display_name,
          created_at: p.created_at,
          role: userRole?.role || "user",
        };
      });
      setUsers(userList);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const addUser = async () => {
    if (!newEmail || !newPassword) {
      toast.error("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      // Use edge function to create user (needs service role)
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email: newEmail, password: newPassword, displayName: newName || newEmail.split("@")[0] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`User ${newEmail} created`);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    }
    setLoading(false);
  };

  const removeUser = async (userId: string, email: string) => {
    // Don't allow removing admin users
    const adminEmails = ["muazbinshafi@gmail.com", "imrankhalilqazi@gmail.com"];
    if (adminEmails.includes(email)) {
      toast.error("Cannot remove admin users");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`User ${email} removed`);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove user");
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users and access control</p>
      </div>

      {/* Add User Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password *</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 chars" />
            </div>
            <div className="flex items-end">
              <Button onClick={addUser} disabled={loading} className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <UserPlus className="h-4 w-4" /> {loading ? "Adding..." : "Add User"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users found.</p>
          ) : (
            <div className="space-y-3">
              {users.map((u, i) => (
                <motion.div
                  key={u.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${u.role === "admin" ? "bg-accent/20" : "bg-muted"}`}>
                      {u.role === "admin" ? <Shield className="h-4 w-4 text-accent" /> : <User className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium">{u.display_name || u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                    {u.role !== "admin" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeUser(u.user_id, u.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
