import { useState, useRef, useCallback } from "react";
import { Package, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // 1 minute
const ATTEMPT_WINDOW_MS = 300_000; // 5 minutes

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const attemptsRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLockoutTimer = useCallback((endTime: number) => {
    setLockoutEnd(endTime);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const left = Math.ceil((endTime - Date.now()) / 1000);
      if (left <= 0) {
        setLockoutEnd(null);
        setRemainingSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setRemainingSeconds(left);
      }
    }, 1000);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check lockout
    if (lockoutEnd && Date.now() < lockoutEnd) {
      toast.error(`Too many attempts. Try again in ${remainingSeconds}s.`);
      return;
    }

    // Clean old attempts outside window
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter(t => now - t < ATTEMPT_WINDOW_MS);

    // Check rate limit
    if (attemptsRef.current.length >= MAX_ATTEMPTS) {
      const lockEnd = now + LOCKOUT_DURATION_MS;
      startLockoutTimer(lockEnd);
      toast.error("Too many failed attempts. Locked for 60 seconds.");
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      attemptsRef.current.push(Date.now());
      const remaining = MAX_ATTEMPTS - attemptsRef.current.length;
      if (remaining > 0) {
        toast.error(`${error} (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`);
      } else {
        const lockEnd = Date.now() + LOCKOUT_DURATION_MS;
        startLockoutTimer(lockEnd);
        toast.error("Too many failed attempts. Locked for 60 seconds.");
      }
    } else {
      attemptsRef.current = [];
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
            <Package className="h-6 w-6 text-accent-foreground" />
          </div>
          <CardTitle className="text-2xl">Qazi Enterprises</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {lockoutEnd && Date.now() < lockoutEnd && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Account locked. Try again in {remainingSeconds}s.</span>
              </div>
            )}
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading || (!!lockoutEnd && Date.now() < lockoutEnd)}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
