"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email atau password salah.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main
      className="min-h-dvh flex items-center justify-center px-5"
      style={{ background: "#FDFDFD" }}
    >
      <div className="w-full max-w-sm fade-up">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "#022C60" }}
          >
            <Image
              src="/brand/logo-3diner-mark.svg"
              alt="3Diner"
              width={34}
              height={34}
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#022C60" }}>
            Masuk Dashboard
          </h1>
          <p className="text-xs mt-1" style={{ color: "#51698F" }}>
            Kelola menu & lihat analitik kafe kamu
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "#FFFFFF", border: "1px solid #CFD9E4" }}
        >
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#254473" }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "#FDFDFD", border: "1px solid #CFD9E4", color: "#022C60" }}
              placeholder="kamu@kafe.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#254473" }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "#FDFDFD", border: "1px solid #CFD9E4", color: "#022C60" }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "#FD5002" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white active:scale-95 transition-transform"
            style={{ background: "#FD5002", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Masuk
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "#51698F" }}>
          3Diner Dashboard
        </p>
      </div>
    </main>
  );
}
