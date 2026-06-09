import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserRole, Worker, Category, Company, DropdownOption, User, ProjectDetail, SystemNotification } from "./types";
import Navbar from "./components/Navbar";
import LoginView from "./components/LoginView";
import DashboardView from "./components/DashboardView";
import RecruiterIntakeView from "./components/RecruiterIntakeView";
import EngineerApprovalsView from "./components/EngineerApprovalsView";
import OperationsView from "./components/OperationsView";
import AdminPanel from "./components/AdminPanel";
import NotificationsPanel from "./components/NotificationsPanel";
import { ShieldCheck, LogIn, Sparkles, Building2, Radio, RefreshCw, Volume2, X, Bell } from "lucide-react";

export default function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Synchronised Database State
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dbLoading, setDbLoading] = useState(true);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeBroadcastToasts, setActiveBroadcastToasts] = useState<SystemNotification[]>([]);

  // Compute allowed projects based on user profile focus permissions
  const visibleProjects = React.useMemo(() => {
    if (!user) return [];
    if (user.role === "admin" || !user.assigned_projects || user.assigned_projects.length === 0) {
      return projects;
    }
    return projects.filter(p => user.assigned_projects?.includes(p.id));
  }, [projects, user]);

  // Adjust active project focus when permission restrictions apply
  useEffect(() => {
    if (user && dbLoading === false && visibleProjects.length > 0) {
      const isCurrentValid = visibleProjects.some(p => p.id === selectedProjectId);
      if (!isCurrentValid) {
        handleSelectProject(visibleProjects[0].id);
      }
    }
  }, [user, visibleProjects, selectedProjectId, dbLoading]);

  // SSE Realtime Connectivity status representation
  const [sseStatus, setSseStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");

  // Selected Section Tabs
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Retrieve user session on mount
  useEffect(() => {
    const cached = localStorage.getItem("ksj_session");
    if (cached) {
      try {
        const payload = JSON.parse(cached);
        setUser(payload);
        
        // Ensure default role-appropriate starting tab
        if (payload.role === "recruiter") {
          setActiveTab("intake");
        } else if (payload.role === "engineer") {
          setActiveTab("engineer");
        } else if (payload.role === "ops") {
          setActiveTab("operations");
        } else if (payload.role === "admin") {
          setActiveTab("admin");
        } else if (payload.role === "viewer") {
          setActiveTab("dashboard");
        } else {
          setActiveTab("dashboard");
        }
      } catch (e) {
        localStorage.removeItem("ksj_session");
      }
    }
    setAuthLoading(false);
  }, []);

  // Sync Database
  const fetchDbState = async () => {
    try {
      const res = await fetch("/api/dashboard-data");
      if (res.ok) {
        const data = await res.json();
        setWorkers(data.workers || []);
        setCategories(data.categories || []);
        setCompanies(data.companies || []);
        setDropdownOptions(data.dropdown_options || []);
        setUsers(data.users || []);
        setProjectDetail(data.project_detail || null);
        setProjects(data.projects || []);
        setSelectedProjectId(data.selected_project_id || "");
        setNotifications(data.notifications || []);

        // Keep active session user in perfect sync with updated database definition
        const cached = localStorage.getItem("ksj_session");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const updatedUser = data.users?.find((u: any) => u.username.toLowerCase() === parsed.username.toLowerCase());
            if (updatedUser) {
              setUser(prev => prev ? { 
                ...prev, 
                assigned_projects: updatedUser.assigned_projects, 
                name: updatedUser.name 
              } : null);
              parsed.assigned_projects = updatedUser.assigned_projects;
              parsed.name = updatedUser.name;
              localStorage.setItem("ksj_session", JSON.stringify(parsed));
            }
          } catch (err) {}
        }
      }
    } catch (e) {
      console.error("Critical: Could not retrieve master database details.", e);
    } finally {
      setDbLoading(false);
    }
  };

  const handleUpdateProjectDetail = async (newDetail: ProjectDetail) => {
    try {
      const res = await fetch("/api/config/update-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDetail)
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleSelectProject = async (projectId: string) => {
    try {
      const res = await fetch("/api/config/select-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId })
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleAddProject = async (newProj: Omit<ProjectDetail, "id"> & { id?: string }) => {
    try {
      const res = await fetch("/api/config/add-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProj)
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch("/api/config/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId })
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const triggerBroadcastToast = (notif: SystemNotification) => {
    // Skip toast if user is restricted of this project context
    if (user && user.role !== "admin" && notif.project_id && user.assigned_projects && user.assigned_projects.length > 0) {
      if (!user.assigned_projects.includes(notif.project_id)) {
        return;
      }
    }

    // Add toast
    setActiveBroadcastToasts((prev) => {
      if (prev.some((t) => t.id === notif.id)) return prev;
      return [notif, ...prev];
    });

    // Auto clear after 8.5 seconds
    setTimeout(() => {
      setActiveBroadcastToasts((prev) => prev.filter((t) => t.id !== notif.id));
    }, 8500);
  };

  useEffect(() => {
    fetchDbState();
  }, []);

  // SSE (Server-Sent Events) live updates subscription
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      setSseStatus("connecting");
      eventSource = new EventSource("/api/live-updates");

      eventSource.onopen = () => {
        setSseStatus("connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "notification") {
            triggerBroadcastToast(parsed.notification);
          }
          fetchDbState();
        } catch (err) {
          if (event.data === "reload") {
            fetchDbState();
          }
        }
      };

      eventSource.onerror = () => {
        setSseStatus("disconnected");
        eventSource?.close();
        // Reconnection timer
        setTimeout(() => {
          connectSSE();
        }, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [user]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem("ksj_session", JSON.stringify(loggedInUser));
    
    // Auto shift onto assigned working panel
    if (loggedInUser.role === "recruiter") {
      setActiveTab("intake");
    } else if (loggedInUser.role === "engineer") {
      setActiveTab("engineer");
    } else if (loggedInUser.role === "ops") {
      setActiveTab("operations");
    } else if (loggedInUser.role === "admin") {
      setActiveTab("admin");
    } else {
      setActiveTab("dashboard");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("ksj_session");
    setActiveTab("dashboard");
  };

  // REST API Methods for operations updates
  const handleBulkAdd = async (newWorkers: { name: string; passport: string; category: string; supply_company: string; doc_link?: string; bulk_doc_link?: string }[]) => {
    try {
      const res = await fetch("/api/workers/bulk-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorkers)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDbState();
        return { success: true };
      }
      return { success: false, message: data.message || "Registration failed." };
    } catch (e) {
      return { success: false, message: "Server connection failed." };
    }
  };

  const handleApproveWorker = async (id: string, sendingBatch: string) => {
    try {
      const res = await fetch(`/api/workers/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sending_batch: sendingBatch })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDbState();
        return { success: true };
      }
      return { success: false, message: data.message || "Approval denied." };
    } catch (e) {
      return { success: false, message: "Network error during approval." };
    }
  };

  const handleHoldWorker = async (id: string) => {
    try {
      const res = await fetch(`/api/workers/${id}/hold`, {
        method: "PUT"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDbState();
        return { success: true };
      }
      return { success: false, message: data.message || "Action denied." };
    } catch (e) {
      return { success: false, message: "Network error during action." };
    }
  };

  const handleRejectWorker = async (id: string, reason?: string) => {
    try {
      const res = await fetch(`/api/workers/${id}/reject-gate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDbState();
        return { success: true };
      }
      return { success: false, message: data.message || "Action denied." };
    } catch (e) {
      return { success: false, message: "Network error during action." };
    }
  };

  const handleUpdateWorker = async (id: string, updates: Partial<Worker>) => {
    try {
      const res = await fetch(`/api/workers/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-caller-role": user?.role || "",
          "x-caller-username": user?.username || ""
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // Config saves
  const handleUpdateCategories = async (newCats: Category[]) => {
    try {
      const res = await fetch("/api/config/update-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCats)
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleUpdateCompanies = async (newCos: Company[]) => {
    try {
      const res = await fetch("/api/config/update-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCos)
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleUpdateDropdownOptions = async (newOpts: DropdownOption[]) => {
    try {
      const res = await fetch("/api/config/update-dropdown-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOpts)
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleAddUser = async (newUser: User) => {
    try {
      const res = await fetch("/api/config/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDbState();
        return { success: true };
      }
      return { success: false, message: data.message || "Failed to add user account." };
    } catch (e) {
      return { success: false, message: "Server connection failed." };
    }
  };

  const handleDeleteUser = async (username: string) => {
    try {
      const res = await fetch(`/api/config/users/${username}`, {
        method: "DELETE"
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleDeleteWorker = async (id: string) => {
    try {
      const res = await fetch(`/api/workers/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        await fetchDbState();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-sans">
        <div className="text-center space-y-3 font-mono text-xs text-muted">
          <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>Loading operational parameters...</div>
        </div>
      </div>
    );
  }

  // Not authenticated? Render beautiful login portal
  if (!user) {
    return <LoginView onLogin={handleLoginSuccess} />;
  }

  // Render correct dashboard screen depending on selected tab
  const renderTabContent = () => {
    if (dbLoading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-paper text-xs text-muted font-mono h-screen">
          <div className="space-y-2 text-center">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-accent" />
            <p>Syncing remote database state...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardView
            workers={workers}
            categories={categories}
            companies={companies}
            projectDetail={projectDetail}
            projects={visibleProjects}
            selectedProjectId={selectedProjectId}
            onRefresh={fetchDbState}
            onSelectProject={handleSelectProject}
            currentUser={user}
            onDeleteWorker={handleDeleteWorker}
          />
        );
      case "intake":
        return (
          <RecruiterIntakeView
            workers={workers}
            categories={categories}
            companies={companies}
            projectDetail={projectDetail}
            onRefresh={fetchDbState}
            onBulkAdd={handleBulkAdd}
            onUpdateWorker={handleUpdateWorker}
            currentUser={user}
            onDeleteWorker={handleDeleteWorker}
          />
        );
      case "engineer":
        return (
          <EngineerApprovalsView
            workers={workers}
            categories={categories}
            companies={companies}
            dropdownOptions={dropdownOptions}
            projects={visibleProjects}
            selectedProjectId={selectedProjectId}
            projectDetail={projectDetail}
            onRefresh={fetchDbState}
            onApproveWorker={handleApproveWorker}
            onHoldWorker={handleHoldWorker}
            onRejectWorker={handleRejectWorker}
          />
        );
      case "operations":
        return (
          <OperationsView
            workers={workers}
            categories={categories}
            companies={companies}
            dropdownOptions={dropdownOptions}
            projects={visibleProjects}
            selectedProjectId={selectedProjectId}
            projectDetail={projectDetail}
            onRefresh={fetchDbState}
            onUpdateWorker={handleUpdateWorker}
            currentUser={user}
          />
        );
      case "admin":
        return (
          <AdminPanel
            workers={workers}
            categories={categories}
            companies={companies}
            dropdownOptions={dropdownOptions}
            users={users}
            projectDetail={projectDetail}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onRefresh={fetchDbState}
            onUpdateCategories={handleUpdateCategories}
            onUpdateCompanies={handleUpdateCompanies}
            onUpdateDropdownOptions={handleUpdateDropdownOptions}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onUpdateProjectDetail={handleUpdateProjectDetail}
            onAddProject={handleAddProject}
            onDeleteProject={handleDeleteProject}
            onSelectProject={handleSelectProject}
          />
        );
      default:
        return (
          <div className="flex-1 p-8 text-xs font-mono text-muted">
            Section unmapped or permission mismatch.
          </div>
        );
    }
  };

  return (
    <div id="application-container" className="flex flex-col bg-paper text-ink min-h-screen selection:bg-accent selection:text-[#FDFBF6]">
      {/* Realtime Live Broadcast Toast Stack overlay */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {activeBroadcastToasts.map((notif) => {
            let borderColor = "border-slate-400";
            let iconColor = "text-accent";
            
            if (notif.type === "success") {
              borderColor = "border-success-green";
              iconColor = "text-success-green";
            } else if (notif.type === "warning") {
              borderColor = "border-gold";
              iconColor = "text-gold";
            } else if (notif.type === "error") {
              borderColor = "border-bad";
              iconColor = "text-bad";
            }

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.95 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`pointer-events-auto bg-card border-l-4 ${borderColor} border border-line shadow-2xl rounded-xl p-4 flex gap-3 text-xs font-sans ring-1 ring-black/5`}
              >
                <div className={`shrink-0 ${iconColor} mt-0.5`}>
                  <Bell className="w-4 h-4 animate-bounce" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-accent font-mono">
                      Broadcast Alert
                    </span>
                    <button
                      onClick={() => setActiveBroadcastToasts((prev) => prev.filter((t) => t.id !== notif.id))}
                      className="text-muted hover:text-ink cursor-pointer transition-colors p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-ink font-medium leading-normal pr-2">
                    {notif.message}
                  </p>
                  <p className="text-[9px] text-muted font-mono leading-none pt-0.5">
                    Sender: <span className="font-semibold text-accent">{notif.sender}</span>
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Top Navbar Header */}
      <Navbar
        currentUser={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        sseStatus={sseStatus}
        projects={visibleProjects}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        notifications={notifications}
        onRefresh={fetchDbState}
      />

      {/* Main panel viewport with fluid animations */}
      <main className="flex-1 flex flex-col min-w-0 bg-paper overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="flex-1 flex flex-col min-w-0"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
