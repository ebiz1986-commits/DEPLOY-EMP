import React from "react";
import { UserRole, ProjectDetail, User, SystemNotification } from "../types";
import {
  LayoutDashboard,
  UserPlus,
  ShieldCheck,
  ClipboardList,
  ClipboardCheck,
  Sliders,
  LogOut,
  Radio,
  Building2
} from "lucide-react";
import NotificationsPanel from "./NotificationsPanel";
import { SankenLogo } from "./SankenLogo";

interface NavbarProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  sseStatus: "connected" | "connecting" | "disconnected";
  projects?: ProjectDetail[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  notifications: SystemNotification[];
  onRefresh: () => void;
}

export default function Navbar({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  sseStatus,
  projects = [],
  selectedProjectId = "",
  onSelectProject = () => {},
  notifications,
  onRefresh
}: NavbarProps) {
  
  // Checking permissions untuk tab visibility
  const hasAccess = (tabName: string): boolean => {
    const roleStr = currentUser.role as string;
    switch (tabName) {
      case "dashboard":
        return roleStr !== "admin";
      case "intake":
        return roleStr === "recruiter";
      case "engineer":
        return roleStr === "engineer";
      case "operations":
        return roleStr === "ops";
      case "admin":
        return roleStr === "admin";
      case "assessment":
        return roleStr === "recruiter" || roleStr === "engineer" || roleStr === "admin";
      default:
        return false;
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "intake", label: "Intake Portal", icon: UserPlus },
    { id: "engineer", label: "Gate Approvals", icon: ShieldCheck },
    { id: "assessment", label: "Trade Assessment", icon: ClipboardCheck },
    { id: "operations", label: "Operations", icon: ClipboardList },
    { id: "admin", label: "Admin Settings", icon: Sliders }
  ];

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "recruiter": return "Recruiting Agent";
      case "engineer": return "Site Engineer";
      case "ops": return "Admin 2";
      case "admin": return "System Administrator";
      case "viewer": return "Viewer";
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
    <header className="sticky top-0 z-40 w-full bg-card border-b border-line px-5 py-3 h-16 flex items-center justify-between font-sans shadow-sm shrink-0">
      
      {/* BRAND & SSE STATUS */}
      <div className="flex items-center gap-4">
        {/* S Logo Icon */}
        <div className="flex items-center gap-2.5">
          <SankenLogo variant="diamonds" className="w-11 h-11 hover:scale-105 transition-transform" />
          <div>
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-ink font-display leading-tight">
              Sanken Overseas
            </h2>
            <p className="text-[9px] text-muted font-mono uppercase tracking-wider font-semibold">
              Pipeline Tracker
            </p>
          </div>
        </div>

        {/* SSE Status Indicator */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-paper/55 rounded-md border border-line/40 h-7">
          <Radio className={`w-3.5 h-3.5 ${
            sseStatus === "connected" ? "text-success-green animate-pulse" : "text-gold"
          }`} />
          <span className="text-[9px] font-mono text-muted uppercase font-bold tracking-wide">
            {sseStatus === "connected" ? "REALTIME" : "SYNCING"}
          </span>
          <span className="flex h-1.5 w-1.5 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              sseStatus === "connected" ? "bg-success-green" : "bg-gold"
            }`}></span>
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
              sseStatus === "connected" ? "bg-success-green" : "bg-gold"
            }`}></span>
          </span>
        </div>
      </div>

      {/* HORIZONTAL NAVIGATION SWITCHER */}
      <nav className="flex items-center gap-1.5 mx-4 overflow-x-auto py-1 scrollbar-none">
        {menuItems.map((item) => {
          const visible = hasAccess(item.id);
          if (!visible) return null;

          const IconComponent = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                isActive
                  ? "bg-paper text-accent border border-line/60 font-semibold shadow-2xs"
                  : "text-muted hover:text-ink hover:bg-paper/30 border border-transparent"
              }`}
            >
              <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? "text-accent" : "text-muted"}`} />
              <span className="font-display hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* RIGHT SIDE ACTIONS: PROJECT FOCUS, NOTIFICATIONS & USER PROFILE */}
      <div className="flex items-center gap-3">
        {/* Project Switcher Select box */}
        {projects && projects.length > 0 && (
          <div className="hidden lg:flex items-center gap-2 h-8">
            <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-wider whitespace-nowrap">
              PROJECT FOCUS:
            </span>
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectProject(e.target.value)}
              className="text-[11px] font-semibold bg-paper/60 border border-line rounded px-2.5 py-1 outline-none focus:border-accent text-ink cursor-pointer hover:bg-paper/85 transition-all max-w-[150px] truncate"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="text-stone-800 bg-stone-100">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* System Notifications Panel Passthrough */}
        <div className="shrink-0">
          <NotificationsPanel
            notifications={notifications}
            projects={projects}
            currentUser={currentUser}
            selectedProjectId={selectedProjectId}
            onRefresh={onRefresh}
          />
        </div>

        {/* User Identity Indicator & Logout button */}
        <div className="flex items-center gap-2 pl-2 border-l border-line/60 h-8">
          <div className="hidden md:flex flex-col text-right leading-none justify-center">
            <span className="text-[11px] font-bold text-ink truncate max-w-[120px]">
              {currentUser.name}
            </span>
            <span className={`inline-block text-[9px] font-mono mt-0.5 px-1.5 rounded border ${getRoleColor(currentUser.role)}`}>
              {getRoleLabel(currentUser.role)}
            </span>
          </div>

          {/* Sanken styled dynamic avatar */}
          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center font-bold text-accent text-xs select-none">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>

          {/* Quick inline logout button */}
          <button
            onClick={onLogout}
            title="Log Out & End Session"
            className="p-1.5 border border-line hover:border-bad/40 hover:bg-bad/5 text-muted hover:text-bad rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
