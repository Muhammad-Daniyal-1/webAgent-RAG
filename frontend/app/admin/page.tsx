"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      router.push("/admin/dashboard");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/[0.07] rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 items-center justify-center mb-5">
            <span className="text-indigo-400 text-lg font-bold">W</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Welcome back
          </h1>
          <p className="text-zinc-500 text-sm mt-1.5">
            Sign in to WebAgent Admin
          </p>
        </div>

        <div className="rounded-2xl border border-white/6 bg-white/2 backdrop-blur-sm p-6 flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Email"
            autoComplete="username"
            className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
          />
          {error && <p className="text-red-400 text-xs px-1">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white py-3 text-sm font-medium transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
