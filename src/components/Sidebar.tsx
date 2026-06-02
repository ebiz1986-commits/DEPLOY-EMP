import React from "react";
import { UserRole, ProjectDetail } from "../types";
import {
  LayoutDashboard,
  UserPlus,
  ShieldCheck,
  ClipboardList,
  Sliders,
  LogOut,
  Radio,
  FileCheck2
} from "lucide-react";

interface SidebarProps {
  currentRole: UserRole;
  userName: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  sseStatus: "connected" | "connecting" | "disconnected";
  projects?: ProjectDetail[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
}

export default function Sidebar({
  currentRole,
  userName,
  activeTab,
  setActiveTab,
  onLogout,
  sseStatus,
  projects = [],
  selectedProjectId = "",
  onSelectProject = () => {}
}: SidebarProps) {
  
  // Checking permissions
  const hasAccess = (tabName: string): boolean => {
    const roleStr = currentRole as string;
    if (roleStr === "admin") return true; // System Admin sees all
    
    switch (tabName) {
      case "dashboard":
        return true;
      case "intake":
        return roleStr === "recruiter";
      case "engineer":
        return roleStr === "engineer";
      case "operations":
        return roleStr === "ops";
      case "admin":
        return roleStr === "admin";
      default:
        return false;
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Master Dashboard", icon: LayoutDashboard, description: "Overview & metrics" },
    { id: "intake", label: "Recruiter Intake", icon: UserPlus, description: "Bulk add & Bureau queue" },
    { id: "engineer", label: "Engineer Approvals", icon: ShieldCheck, description: "Quota gate validation" },
    { id: "operations", label: "Operations Stage", icon: ClipboardList, description: "Field K-O tracking" },
    { id: "admin", label: "Admin Setting Panel", icon: Sliders, description: "System configuration" }
  ];

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "recruiter": return "Sanken Overseas Recruiter (Role 1)";
      case "engineer": return "Engineer GATE (Role 2)";
      case "ops": return "Admin2 Operations (Role 3)";
      case "admin": return "System Admin (Role 4)";
      case "viewer": return "Viewer Only (Role 5)";
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case "recruiter": return "bg-accent/10 text-accent border-accent/20";
      case "engineer": return "bg-success-green/10 text-success-green border-success-green/20";
      case "ops": return "bg-info/10 text-info border-info/20";
      case "admin": return "bg-bad/10 text-bad border-bad/20";
      case "viewer": return "bg-gold/10 text-gold border-gold/20";
    }
  };

  return (
    <aside id="sidebar-panel" className="w-64 bg-card border-r border-line flex flex-col justify-between shrink-0 h-screen sticky top-0 font-sans">
      
      {/* Brand Header */}
      <div className="p-5 border-b border-line">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center text-card font-serif font-bold text-lg">
            S
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">Sanken Overseas</h2>
            <p className="text-[10px] text-muted font-mono uppercase tracking-wide font-medium">Pipeline Tracker</p>
          </div>
        </div>
        
        {/* SSE Database Channel Status Indicator */}
        <div className="mt-3 flex items-center justify-between px-2.5 py-1.5 bg-paper/55 rounded-md border border-line/50">
          <div className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${
              sseStatus === "connected" ? "text-success-green animate-pulse" : "text-gold"
            }`} />
            <span className="text-[10px] font-mono text-muted uppercase">
              {sseStatus === "connected" ? "LIVE REALTIME" : "SYNCING..."}
            </span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              sseStatus === "connected" ? "bg-success-green" : "bg-gold"
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              sseStatus === "connected" ? "bg-success-green" : "bg-gold"
            }`}></span>
          </span>
        </div>

        {/* Project switcher dropdown */}
        {projects && projects.length > 0 && (
          <div className="mt-3.5 pt-3.5 border-t border-line/40 space-y-1 font-sans">
            <label className="text-[9px] font-mono font-bold text-muted uppercase tracking-wider block">
              Active Project Focus
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
              className="w-full text-xs font-semibold bg-paper-800 border border-line rounded px-2 py-1.5 outline-none focus:border-accent text-ink cursor-pointer hover:bg-paper/45 transition-colors"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="text-stone-800 bg-stone-100">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const visible = hasAccess(item.id);
          if (!visible) return null;

          const IconComponent = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                isActive
                  ? "bg-paper text-accent font-medium border border-line"
                  : "text-muted hover:text-ink hover:bg-paper/30 border border-transparent"
              }`}
            >
              <IconComponent className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? "text-accent" : "text-muted"}`} />
              <div className="leading-tight">
                <span className="text-xs block font-display">{item.label}</span>
                <span className="text-[9px] text-muted font-mono">{item.description}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* User Session Footer Badge Component */}
      <div className="p-4 border-t border-line bg-paper/30">
        <div className="p-3 bg-card border border-line rounded-lg flex flex-col gap-2">
          <div>
            <div className={`inline-block px-2 py-0.5 text-[9px] font-mono rounded-full border mb-1.5 ${getRoleColor(currentRole)}`}>
              {getRoleLabel(currentRole)}
            </div>
            <div className="text-xs font-semibold text-ink line-clamp-1">{userName}</div>
            <div className="text-[9px] text-muted font-mono truncate">ID: @{userName.toLowerCase().replace(/[^a-z]/g, "") || "user"}</div>
          </div>
          
          <button
            onClick={onLogout}
            className="w-full mt-1.5 py-1.5 border border-line hover:border-bad/40 hover:text-bad text-muted text-[10px] font-mono uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>End Session</span>
          </button>
        </div>
      </div>

    </aside>
  );
}
