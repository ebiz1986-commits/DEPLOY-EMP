import React, { useState } from "react";
import { UserRole } from "../types";
import { KeyRound, ShieldAlert, Sparkles, User as UserIcon } from "lucide-react";

interface LoginViewProps {
  onLogin: (username: string, role: UserRole, name: string) => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    { label: "Sanken Overseas Recruiter", username: "recruiter", role: "recruiter", name: "Farid (Recruiter)", badge: "Role 1" },
    { label: "Engineer (Gate)", username: "engineer", role: "engineer", name: "Ir. Tan (Engineer)", badge: "Role 2" },
    { label: "Ops Manager", username: "ops", role: "ops", name: "Sarah (Operations)", badge: "Role 3" },
    { label: "System Admin", username: "admin", role: "admin", name: "Admin (System Admin)", badge: "Role 4" },
    { label: "Executive Viewer", username: "viewer", role: "viewer", name: "Viewer (Dashboard Only)", badge: "Role 5" }
  ];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLogin(data.user.username, data.user.role, data.user.name);
      } else {
        setError(data.message || "Invalid credentials.");
      }
    } catch (err) {
      setError("Connection failure to authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const selectDemoAccount = (acc: typeof demoAccounts[0]) => {
    setUsername(acc.username);
    setPassword("password");
    setError("");
  };

  return (
    <div id="login-container" className="min-h-screen bg-paper flex items-center justify-center p-4 md:p-8 selection:bg-accent selection:text-white">
      <div className="w-full max-w-4xl bg-card border border-line rounded-xl shadow-sm overflow-hidden grid md:grid-cols-12 min-h-[550px]">
        
        {/* Editorial Brand Column */}
        <div className="md:col-span-5 bg-stone-900 text-[#FDFBF6] p-8 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-stone-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-800 text-amber-200 text-xs font-mono tracking-wider rounded-full border border-stone-700/50">
              <Sparkles className="w-3 shrink-0 text-amber-300" />
              <span>SANKEN OVERSEAS PIPELINE METRICS</span>
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-serif mt-12 mb-4 leading-tight">
              Worker<br />
              Deployment<br />
              <span className="text-accent italic font-normal">Tracker</span>
            </h1>
            <p className="text-stone-400 text-sm leading-relaxed font-sans max-w-xs">
              Replaces the legacy manual Masterfile. Live quota verification and role-based stage monitoring.
            </p>
          </div>

          <div className="mt-12 md:mt-0 pt-6 border-t border-stone-800 text-[11px] font-mono text-stone-500 flex flex-col gap-1">
            <div>SYSTEM: ONLINE (PORT 3000)</div>
            <div>STAKEHOLDER SYNC: REALTIME</div>
            <div>PREVIEW: ACTIVE MIGRATION</div>
          </div>
        </div>

        {/* Login Form Column */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-between">
          <div className="w-full">
            <h2 className="text-xl font-display font-medium text-ink mb-1">
              Gateway Access
            </h2>
            <p className="text-xs text-muted mb-6">
              Enter credentials assigned by the System Administrator.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-bad border border-red-200 rounded-lg text-xs flex gap-3 items-start">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                  <input
                    id="username-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="recruiter / engineer / admin..."
                    className="w-full text-sm pl-10 pr-4 py-2 bg-paper/30 border border-line focus:border-accent focus:ring-1 focus:ring-accent rounded-lg outline-none transition-colors mono-text text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">
                  Security Passkey
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-muted" />
                  <input
                    id="password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-sm pl-10 pr-4 py-2 bg-paper/30 border border-line focus:border-accent focus:ring-1 focus:ring-accent rounded-lg outline-none transition-colors mono-text text-ink"
                  />
                </div>
              </div>

              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-accent text-[#FDFBF6] hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 rounded-lg text-xs font-mono tracking-widest uppercase transition-colors disabled:opacity-50 font-bold"
              >
                {loading ? "Authenticating..." : "Establish Session"}
              </button>
            </form>
          </div>

          {/* Quick Sandbox Selector */}
          <div className="mt-8 pt-6 border-t border-line">
            <h3 className="text-xs font-mono text-muted mb-3 uppercase tracking-wider">
              Sandbox Role Quick Selector
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => selectDemoAccount(acc)}
                  className={`flex flex-col items-start p-2 border rounded-lg text-left transition-all group ${
                    username === acc.username
                      ? "bg-accent/5 border-accent ring-1 ring-accent"
                      : "bg-paper/20 hover:bg-paper/45 border-line"
                  }`}
                >
                  <span className="text-xs font-medium text-ink flex items-center justify-between w-full">
                    <span>{acc.label}</span>
                    <span className="text-[9px] font-mono text-muted group-hover:text-accent tracking-tighter shrink-0 ml-1">
                      {acc.badge}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono text-muted">
                    user: {acc.username} / pw: password
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
