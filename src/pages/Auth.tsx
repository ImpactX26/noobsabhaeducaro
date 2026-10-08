import { useState, FormEvent, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/store/AuthContext";
import { SiegLogo } from "@/components/SiegLogo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Auth() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Log in · sieg.ai"; }, []);
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: name } },
      });
      if (error) toast.error(error.message);
      else if (!data.session) toast.success("Check your email to confirm your account, then log in.");
      else nav("/dashboard");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      else nav("/dashboard");
    }
    setBusy(false);
  };

  const google = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (res.error) toast.error("Google sign-in failed.");
  };

  const field = "w-full border-2 border-sieg-white/20 bg-transparent px-4 py-3 outline-none focus:border-sieg-yellow";

  return (
    <div className="grid min-h-screen bg-black text-sieg-white lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-sieg-white/10 p-12 lg:flex">
        <Link to="/"><SiegLogo className="text-4xl" /></Link>
        <div>
          <p className="font-display text-7xl uppercase leading-[0.9]">Your path to <span className="text-sieg-yellow">victory</span> in Germany.</p>
          <p className="mt-6 max-w-md text-lg">Every applicant gets their own profile, documents, AI analysis and a personal AI advisor.</p>
        </div>
        <p className="font-mono-label text-[10px]">✦ From documents to your next step</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden"><SiegLogo className="text-3xl" /></Link>
          <div className="mt-8 grid grid-cols-2 border-2 border-sieg-white/20">
            {(["login", "signup"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("font-mono-label py-3 text-xs font-bold", mode === m ? "bg-sieg-yellow text-sieg-black" : "text-sieg-white/60")}>
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
          <h1 className="font-display mt-8 text-5xl uppercase">{mode === "login" ? "Welcome back" : "Start your journey"}</h1>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "signup" && <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className={field} />}
            <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            <input required type="password" minLength={6} placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            <button disabled={busy} className="font-mono-label w-full bg-sieg-red py-4 text-xs font-bold hover:bg-sieg-yellow hover:text-sieg-black disabled:opacity-50">
              {busy ? "Please wait…" : mode === "login" ? "Log in →" : "Create account →"}
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-sieg-white/40"><span className="h-px flex-1 bg-sieg-white/20" />or<span className="h-px flex-1 bg-sieg-white/20" /></div>
          <button onClick={google} className="font-mono-label w-full border-2 border-sieg-white/20 py-4 text-xs font-bold hover:border-sieg-yellow">Continue with Google</button>
        </div>
      </div>
    </div>
  );
}
