import React, { useState, useMemo } from "react";
import { SystemNotification, ProjectDetail, User } from "../types";
import { 
  Bell, 
  X, 
  Plus, 
  Volume2, 
  Send, 
  CheckCheck, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  Calendar, 
  User as UserIcon,
  Filter
} from "lucide-react";

interface NotificationsPanelProps {
  notifications: SystemNotification[];
  projects: ProjectDetail[];
  currentUser: User;
  selectedProjectId: string;
  onRefresh: () => void;
}

export default function NotificationsPanel({
  notifications,
  projects,
  currentUser,
  selectedProjectId,
  onRefresh
}: NotificationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "project">("all");

  // Local state for alert composer
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "success" | "warning" | "error">("info");
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Track unread timestamps
  const [lastReadTime, setLastReadTime] = useState<string>(() => {
    return localStorage.getItem(`ksj_last_read_${currentUser.username}`) || new Date(0).toISOString();
  });

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter(notif => {
      // If project narrow is matching
      if (notif.project_id && currentUser.assigned_projects && currentUser.assigned_projects.length > 0) {
        if (!currentUser.assigned_projects.includes(notif.project_id)) return false;
      }
      return new Date(notif.created_at) > new Date(lastReadTime);
    }).length;
  }, [notifications, lastReadTime, currentUser]);

  // Handle open/close and stamp read time
  const togglePanel = () => {
    if (!isOpen) {
      // Stamp read state
      const now = new Date().toISOString();
      setLastReadTime(now);
      localStorage.setItem(`ksj_last_read_${currentUser.username}`, now);
    }
    setIsOpen(!isOpen);
    setIsComposing(false);
    setErrorMsg("");
    setSuccessMsg("");
  };

  // Filtered notifications
  const displayedNotifications = useMemo(() => {
    let list = notifications;

    // Filter by project role bounds
    if (currentUser.role !== "admin" && currentUser.assigned_projects && currentUser.assigned_projects.length > 0) {
      list = list.filter(notif => !notif.project_id || currentUser.assigned_projects?.includes(notif.project_id));
    }

    if (filterMode === "project" && selectedProjectId) {
      list = list.filter(notif => notif.project_id === selectedProjectId);
    }

    return list;
  }, [notifications, filterMode, selectedProjectId, currentUser]);

  // Handle manual submit alert broadcast
  const handleSubmitAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg("Please state your target notification description.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/notifications/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          sender: currentUser.name,
          role: currentUser.role,
          type,
          project_id: targetProjectId || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("System broadcast alert triggered successfully!");
        setMessage("");
        setType("info");
        setTargetProjectId("");
        onRefresh();
        // Hide composer after short delay
        setTimeout(() => {
          setIsComposing(false);
          setSuccessMsg("");
        }, 1500);
      } else {
        setErrorMsg(data.message || "Failed to trigger broadcast event.");
      }
    } catch (e) {
      setErrorMsg("Network timed out trying to broadcast alert feed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative font-sans z-30">
      {/* Target Notification Toggle Ring */}
      <button
        type="button"
        onClick={togglePanel}
        id="notification-bell-btn"
        className={`relative p-2 rounded-lg border text-muted hover:text-ink hover:bg-paper transition-all cursor-pointer flex items-center justify-center ${
          isOpen ? "bg-paper text-accent ring-1 ring-accent" : "bg-card border-line"
        }`}
        title="Check Pipeline Notification Broadcasts"
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? "animate-swing" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-white font-mono font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover overlay dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2.5 w-96 bg-card border border-line rounded-xl shadow-xl z-50 flex flex-col overflow-hidden max-h-[580px] animate-fade-in">
            
            {/* Header Area */}
            <div className="p-4 border-b border-line flex items-center justify-between bg-paper/55">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-accent" />
                <div>
                  <h4 className="text-xs font-bold text-ink">Broadcast Center</h4>
                  <p className="text-[10px] text-muted font-mono leading-none mt-0.5">Live platform alert telemetry</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsComposing(!isComposing)}
                  className="px-2 py-1 bg-accent hover:bg-accent/90 text-white rounded text-[10px] uppercase font-mono tracking-wider font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Dispatch Alert</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-muted hover:text-ink rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Broadcast Composer Form View */}
            {isComposing && (
              <form onSubmit={handleSubmitAlert} className="p-4 bg-amber-50/20 border-b border-line/65 text-xs space-y-3 animate-slide-down">
                <div className="font-semibold text-accent text-[11px] flex items-center justify-between">
                  <span>DISPATCH NEW ANNOUNCEMENT ALERT</span>
                  <button 
                    type="button" 
                    onClick={() => setIsComposing(false)} 
                    className="text-muted hover:text-bad"
                  >
                    Cancel
                  </button>
                </div>

                {errorMsg && <div className="p-1 px-2 border border-bad/10 bg-bad/5 text-bad text-[10px] rounded">{errorMsg}</div>}
                {successMsg && <div className="p-1 px-2 border border-success-green/10 bg-success-green/5 text-success-green text-[10px] rounded">{successMsg}</div>}

                <div>
                  <label className="block text-[9px] uppercase font-mono text-muted mb-1">Alert Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="E.g. Visa submission quota close to exhaust bounds, verify application status..."
                    rows={2}
                    className="w-full bg-card border border-line rounded p-2 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-mono text-muted mb-1">Priority Style</label>
                    <select
                      value={type}
                      onChange={(e: any) => setType(e.target.value)}
                      className="w-full bg-card border border-line rounded p-1.5 text-xs font-mono"
                    >
                      <option value="info">💡 Info Tone</option>
                      <option value="success">✅ Success Alert</option>
                      <option value="warning">⚠️ Warning Guard</option>
                      <option value="error">🚨 Urgent Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-mono text-muted mb-1">Target Project</label>
                    <select
                      value={targetProjectId}
                      onChange={(e) => setTargetProjectId(e.target.value)}
                      className="w-full bg-card border border-line rounded p-1.5 text-xs text-ink"
                    >
                      <option value="">🌎 All Active Projects</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name.length > 20 ? p.name.substring(0, 18) + "..." : p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-1.5 bg-accent hover:bg-accent/95 disabled:bg-muted text-white text-[10px] font-mono uppercase font-bold tracking-wider rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Dispatching..." : "Transmit Broadcast"}</span>
                </button>
              </form>
            )}

            {/* Filter mode header */}
            <div className="p-2.5 px-4 bg-paper/30 border-b border-line flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2 text-muted">
                <Filter className="w-3 h-3" />
                <span className="font-mono">Narrow scope feed:</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-2 py-0.5 rounded font-mono ${filterMode === "all" ? "bg-accent/15 text-accent font-semibold" : "text-muted hover:text-ink bg-transparent"}`}
                >
                  ALL PROJS
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("project")}
                  className={`px-2 py-0.5 rounded font-mono ${filterMode === "project" ? "bg-accent/15 text-accent font-semibold" : "text-muted hover:text-ink bg-transparent"}`}
                  disabled={!selectedProjectId}
                >
                  ACTIVE PROJECT ONLY
                </button>
              </div>
            </div>

            {/* Notifications Feed List */}
            <div className="flex-1 overflow-y-auto divide-y divide-line/45 max-h-80 mini-scroll">
              {displayedNotifications.length === 0 ? (
                <div className="p-8 text-center text-muted text-xs space-y-1">
                  <Bell className="w-6 h-6 mx-auto text-line mb-1" />
                  <p className="font-semibold">No recent broadcasts recorded.</p>
                  <p className="text-[10px]">System telemetry reports green connectivity.</p>
                </div>
              ) : (
                displayedNotifications.map((notif) => {
                  const correlatedProj = projects.find(p => p.id === notif.project_id);
                  
                  // Style colors based on level
                  let borderLeftStyle = "border-l-2 border-l-slate-400";
                  let IconComp = Info;
                  let iconColor = "text-slate-400";
                  let bgHover = "hover:bg-paper/10";

                  if (notif.type === "success") {
                    borderLeftStyle = "border-l-2 border-l-success-green";
                    IconComp = CheckCircle2;
                    iconColor = "text-success-green";
                    bgHover = "hover:bg-success-green/5";
                  } else if (notif.type === "warning") {
                    borderLeftStyle = "border-l-2 border-l-gold";
                    IconComp = AlertTriangle;
                    iconColor = "text-gold";
                    bgHover = "hover:bg-gold/5";
                  } else if (notif.type === "error") {
                    borderLeftStyle = "border-l-2 border-l-bad";
                    IconComp = Flame;
                    iconColor = "text-bad";
                    bgHover = "hover:bg-bad/5";
                  }

                  return (
                    <div key={notif.id} className={`p-3.5 ${borderLeftStyle} ${bgHover} flex gap-3 transition-colors`}>
                      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="flex-1 space-y-1 font-sans">
                        <p className="text-xs text-ink leading-normal font-sans tracking-wide">
                          {notif.message}
                        </p>
                        
                        {/* Meta lines */}
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] font-mono text-muted">
                          <span className="flex items-center gap-0.5 text-accent font-semibold">
                            <UserIcon className="w-2.5 h-2.5" />
                            {notif.sender} ({notif.role?.toUpperCase() || "SYSTEM"})
                          </span>
                          
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {correlatedProj && (
                            <span className="bg-paper border border-line text-[8px] font-mono font-bold uppercase rounded px-1.5 py-0.2 shrink-0 max-w-28 truncate" title={correlatedProj.name}>
                              {correlatedProj.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer telemetries */}
            <div className="p-3 bg-paper/40 border-t border-line text-center text-[9px] text-muted font-mono flex items-center justify-between px-4">
              <span>ACTIVE BROADCAST NODE INDEPENDENT</span>
              <span className="flex items-center gap-0.5 text-success-green font-semibold">
                <CheckCheck className="w-3 h-3" /> ALL CHANNEL LIVE
              </span>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
