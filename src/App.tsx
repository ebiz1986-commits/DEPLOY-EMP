import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserRole, Worker, Category, Company, DropdownOption, User, ProjectDetail } from "./types";
import Sidebar from "./components/Sidebar";
import LoginView from "./components/LoginView";
import DashboardView from "./components/DashboardView";
import RecruiterIntakeView from "./components/RecruiterIntakeView";
import EngineerApprovalsView from "./components/EngineerApprovalsView";
import OperationsView from "./components/OperationsView";
import AdminPanel from "./components/AdminPanel";
import { ShieldCheck, LogIn, Sparkles, Building2, Radio, RefreshCw } from "lucide-react";

export default function App() {
  // Authentication State
  const [user, setUser] = useState<{ username: string; role: UserRole; name: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Synchronised Database State
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

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
        if (event.data === "reload") {
          fetchDbState();
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
  }, []);

  const handleLoginSuccess = (username: string, role: UserRole, name: string) => {
    const payload = { username, role, name };
    setUser(payload);
    localStorage.setItem("ksj_session", JSON.stringify(payload));
    
    // Auto shift onto assigned working panel
    if (role === "recruiter") {
      setActiveTab("intake");
    } else if (role === "engineer") {
      setActiveTab("engineer");
    } else if (role === "ops") {
      setActiveTab("operations");
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
  const handleBulkAdd = async (newWorkers: { name: string; passport: string; category: string; supply_company: string }[]) => {
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

  const handleUpdateWorker = async (id: string, updates: Partial<Worker>) => {
    try {
      const res = await fetch(`/api/workers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
            onRefresh={fetchDbState}
          />
        );
      case "intake":
        return (
          <RecruiterIntakeView
            workers={workers}
            categories={categories}
            companies={companies}
            onRefresh={fetchDbState}
            onBulkAdd={handleBulkAdd}
            onUpdateWorker={handleUpdateWorker}
          />
        );
      case "engineer":
        return (
          <EngineerApprovalsView
            workers={workers}
            categories={categories}
            companies={companies}
            dropdownOptions={dropdownOptions}
            onRefresh={fetchDbState}
            onApproveWorker={handleApproveWorker}
          />
        );
      case "operations":
        return (
          <OperationsView
            workers={workers}
            categories={categories}
            companies={companies}
            dropdownOptions={dropdownOptions}
            onRefresh={fetchDbState}
            onUpdateWorker={handleUpdateWorker}
          />
        );
      case "admin":
        return (
          <AdminPanel
            categories={categories}
            companies={companies}
            dropdownOptions={dropdownOptions}
            users={users}
            projectDetail={projectDetail}
            onRefresh={fetchDbState}
            onUpdateCategories={handleUpdateCategories}
            onUpdateCompanies={handleUpdateCompanies}
            onUpdateDropdownOptions={handleUpdateDropdownOptions}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onUpdateProjectDetail={handleUpdateProjectDetail}
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
    <div id="application-container" className="flex bg-paper text-ink min-h-screen overflow-hidden selection:bg-accent selection:text-[#FDFBF6]">
      {/* Sidebar navigation */}
      <Sidebar
        currentRole={user.role}
        userName={user.name}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        sseStatus={sseStatus}
      />

      {/* Main panel viewport with fluid animations */}
      <div className="flex-1 flex flex-col min-w-0 bg-paper">
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
      </div>
    </div>
  );
}
