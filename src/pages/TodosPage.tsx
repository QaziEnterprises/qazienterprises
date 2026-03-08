import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, StickyNote, CheckCircle2, Circle, Flag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  created_at: string;
}

export default function TodosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const fetchTodos = async () => {
    try {
      const { data } = await supabase.from("todos").select("*").order("created_at", { ascending: false });
      setTodos((data as unknown as Todo[]) || []);
    } catch (e) {
      console.error("Todos fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTodos(); }, []);

  const addTodo = async () => {
    if (!newTitle.trim()) return;
    try {
      const { error } = await supabase.from("todos").insert({
        title: newTitle.trim(),
        priority: newPriority,
        created_by: user?.id,
      });
      if (error) throw error;
      setNewTitle("");
      setNewPriority("normal");
      fetchTodos();
    } catch (e: any) {
      toast({ title: "Error adding note", description: e.message, variant: "destructive" });
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    await supabase.from("todos").update({ completed: !completed }).eq("id", id);
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, completed: !completed } : t));
  };

  const deleteTodo = async (id: string) => {
    await supabase.from("todos" as any).delete().eq("id", id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const filtered = todos.filter((t) =>
    filter === "all" ? true : filter === "active" ? !t.completed : t.completed
  );
  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  const priorityColor = (p: string) => p === "high" ? "text-destructive" : p === "low" ? "text-muted-foreground" : "text-primary";

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Quick Notes & To-Do</h1>
        <p className="text-muted-foreground">Daily reminders, tasks, and notes for your shop</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("all")}>
          <CardContent className="flex items-center gap-3 p-4">
            <StickyNote className="h-5 w-5 text-muted-foreground" />
            <div><div className="text-2xl font-bold">{todos.length}</div><p className="text-xs text-muted-foreground">Total Notes</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("active")}>
          <CardContent className="flex items-center gap-3 p-4">
            <Circle className="h-5 w-5 text-primary" />
            <div><div className="text-2xl font-bold text-primary">{activeCount}</div><p className="text-xs text-muted-foreground">Pending</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("completed")}>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div><div className="text-2xl font-bold text-green-600">{completedCount}</div><p className="text-xs text-muted-foreground">Done</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Add New */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Add a note or reminder..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTodo()} className="flex-1 min-w-[200px]" />
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">🔴 High</SelectItem>
                <SelectItem value="normal">🟡 Normal</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addTodo} disabled={!newTitle.trim()}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "active", "completed"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((todo) => (
            <motion.div key={todo.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} layout>
              <div className={`flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30 ${todo.completed ? "opacity-60" : ""}`}>
                <Checkbox checked={todo.completed} onCheckedChange={() => toggleTodo(todo.id, todo.completed)} />
                <Flag className={`h-3.5 w-3.5 flex-shrink-0 ${priorityColor(todo.priority)}`} />
                <span className={`flex-1 text-sm ${todo.completed ? "line-through text-muted-foreground" : "font-medium"}`}>{todo.title}</span>
                <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{new Date(todo.created_at).toLocaleDateString()}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTodo(todo.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">{filter === "all" ? "No notes yet" : `No ${filter} notes`}</p>
            <p className="text-sm mt-1">Add a note above to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
