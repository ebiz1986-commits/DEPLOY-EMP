import React, { useState, useMemo } from "react";
import { Category, Company, DropdownOption, User, UserRole, ProjectDetail, Worker } from "../types";
import { 
  Sliders, 
  Layers, 
  Building2, 
  Tags, 
  Users2, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  UserPlus,
  Briefcase,
  Pencil,
  Check,
  X,
  Lock,
  Unlock,
  ChevronRight,
  TrendingUp,
  BarChart2,
  Cloud,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import {
  initAuth,
  googleSignIn,
  logout as googleLogout,
  uploadOrUpdateMasterFile
} from "../gdrive";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from "recharts";

interface AdminPanelProps {
  workers: Worker[];
  categories: Category[];
  companies: Company[];
  dropdownOptions: DropdownOption[];
  users: User[];
  projectDetail?: ProjectDetail | null;
  projects?: ProjectDetail[];
  selectedProjectId?: string;
  onRefresh: () => void;
  onUpdateCategories: (newCats: Category[]) => Promise<boolean>;
  onUpdateCompanies: (newCos: Company[]) => Promise<boolean>;
  onUpdateDropdownOptions: (newOpts: DropdownOption[]) => Promise<boolean>;
  onAddUser: (newUser: User) => Promise<{ success: boolean; message?: string }>;
  onDeleteUser: (username: string) => Promise<boolean>;
  onUpdateProjectDetail?: (newDetail: ProjectDetail) => Promise<boolean>;
  onAddProject?: (newProj: Omit<ProjectDetail, "id"> & { id?: string }) => Promise<boolean>;
  onDeleteProject?: (projectId: string) => Promise<boolean>;
  onSelectProject?: (projectId: string) => Promise<boolean>;
}

export default function AdminPanel({
  workers = [],
  categories,
  companies,
  dropdownOptions,
  users,
  projectDetail,
  projects = [],
  selectedProjectId = "",
  onRefresh,
  onUpdateCategories,
  onUpdateCompanies,
  onUpdateDropdownOptions,
  onAddUser,
  onDeleteUser,
  onUpdateProjectDetail,
  onAddProject = async () => false,
  onDeleteProject = async () => false,
  onSelectProject = async () => false
}: AdminPanelProps) {
  
  // Navigation internal to Admin Settings panel
  const [activeSubTab, setActiveSubTab] = useState<"project" | "quotas" | "companies" | "dropdowns" | "users" | "gdrive">("project");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // States for Google Drive Backup Integrations
  const [gdriveUser, setGdriveUser] = useState<FirebaseUser | null>(null);
  const [gdriveToken, setGdriveToken] = useState<string | null>(null);
  const [isGdriveSyncing, setIsGdriveSyncing] = useState(false);
  const [lastGdriveSync, setLastGdriveSync] = useState<string | null>(() => {
    return localStorage.getItem("sanken_last_gdrive_sync");
  });
  const [gdriveAutoSync, setGdriveAutoSync] = useState(() => {
    const stored = localStorage.getItem("sanken_gdrive_auto_sync");
    return stored === null ? true : stored === "true";
  });
  const [gdriveSyncStatus, setGdriveSyncStatus] = useState<"idle" | "success" | "error" | "syncing">("idle");
  const [gdriveError, setGdriveError] = useState<string | null>(null);

  // Google Drive Authentication Listener
  React.useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGdriveUser(user);
        setGdriveToken(token);
        setGdriveSyncStatus("idle");
      },
      () => {
        setGdriveUser(null);
        setGdriveToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync state back to localStorage to persist preferences
  React.useEffect(() => {
    localStorage.setItem("sanken_gdrive_auto_sync", String(gdriveAutoSync));
  }, [gdriveAutoSync]);

  // Persist last sync timestamp
  React.useEffect(() => {
    if (lastGdriveSync) {
      localStorage.setItem("sanken_last_gdrive_sync", lastGdriveSync);
    }
  }, [lastGdriveSync]);

  // Auto-backup to Drive in background when database changes
  React.useEffect(() => {
    if (!gdriveUser || !gdriveToken || !gdriveAutoSync || workers.length === 0) return;

    const delayDebounce = setTimeout(async () => {
      setGdriveSyncStatus("syncing");
      const res = await uploadOrUpdateMasterFile(workers, gdriveToken);
      if (res.success) {
        setLastGdriveSync(new Date().toLocaleString());
        setGdriveSyncStatus("success");
        setGdriveError(null);
      } else {
        setGdriveSyncStatus("error");
        setGdriveError(res.error || "Background backup failed");
      }
    }, 5000); // 5 seconds wait after any DB edits before backing up silently

    return () => clearTimeout(delayDebounce);
  }, [workers, gdriveUser, gdriveToken, gdriveAutoSync]);

  // States for Project Management
  const [projName, setProjName] = useState(projectDetail?.name || "");
  const [projClient, setProjClient] = useState(projectDetail?.client || "");
  const [projLocation, setProjLocation] = useState(projectDetail?.location || "");
  const [projEngineer, setProjEngineer] = useState(projectDetail?.engineer_in_charge || "");
  const [projAdmin, setProjAdmin] = useState(projectDetail?.admin_coordinator || "");
  const [projContract, setProjContract] = useState(projectDetail?.contract_number || "");

  // Multi-project editing and creation states
  const [selectedEditProjectId, setSelectedEditProjectId] = useState<string>(projectDetail?.id || "proj-1");
  const [isAddingNewProject, setIsAddingNewProject] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjClient, setNewProjClient] = useState("");
  const [newProjLocation, setNewProjLocation] = useState("");
  const [newProjEngineer, setNewProjEngineer] = useState("");
  const [newProjAdmin, setNewProjAdmin] = useState("");
  const [newProjContract, setNewProjContract] = useState("");

  React.useEffect(() => {
    if (projectDetail) {
      // Default populate with current active project
      setProjName(projectDetail.name);
      setProjClient(projectDetail.client);
      setProjLocation(projectDetail.location);
      setProjEngineer(projectDetail.engineer_in_charge);
      setProjAdmin(projectDetail.admin_coordinator);
      setProjContract(projectDetail.contract_number);
      setSelectedEditProjectId(projectDetail.id || "proj-1");
    }
  }, [projectDetail]);

  const handleLoadProjectForEdit = (proj: ProjectDetail) => {
    setSelectedEditProjectId(proj.id);
    setProjName(proj.name);
    setProjClient(proj.client);
    setProjLocation(proj.location);
    setProjEngineer(proj.engineer_in_charge);
    setProjAdmin(proj.admin_coordinator);
    setProjContract(proj.contract_number);
    setIsAddingNewProject(false);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) {
      showError("Project name key is required.");
      return;
    }
    const ok = await onAddProject({
      name: newProjName.trim(),
      client: newProjClient.trim(),
      location: newProjLocation.trim(),
      engineer_in_charge: newProjEngineer.trim(),
      admin_coordinator: newProjAdmin.trim(),
      contract_number: newProjContract.trim()
    });
    if (ok) {
      showSuccess(`Successfully registered active project: "${newProjName.trim()}"!`);
      setIsAddingNewProject(false);
      setNewProjName("");
      setNewProjClient("");
      setNewProjLocation("");
      setNewProjEngineer("");
      setNewProjAdmin("");
      setNewProjContract("");
    } else {
      showError("Failed to add project to database.");
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) {
      showError("Project name cannot be empty.");
      return;
    }
    if (onUpdateProjectDetail) {
      const ok = await onUpdateProjectDetail({
        id: selectedEditProjectId,
        name: projName.trim(),
        client: projClient.trim(),
        location: projLocation.trim(),
        engineer_in_charge: projEngineer.trim(),
        admin_coordinator: projAdmin.trim(),
        contract_number: projContract.trim()
      });
      if (ok) {
        showSuccess("Project details updated successfully across all roles!");
      } else {
        showError("Failed to save project settings in database.");
      }
    }
  };

  // Inline edit state for Categories
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>("");
  const [editingCatQuota, setEditingCatQuota] = useState<number>(100);
  const [editingCompanyAllocations, setEditingCompanyAllocations] = useState<Record<string, number>>({});

  // Inline edit state for Companies
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState<string>("");

  // Deletion inline states to avoid iframe window.confirm blocks
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);
  const [confirmDeleteCompanyId, setConfirmDeleteCompanyId] = useState<string | null>(null);
  const [confirmDeleteUsername, setConfirmDeleteUsername] = useState<string | null>(null);
  const [confirmDeleteProjId, setConfirmDeleteProjId] = useState<string | null>(null);

  // Selected admin vendor for separate Supply Vendor wise allocation management
  const [selectedAdminVendor, setSelectedAdminVendor] = useState<string>("");

  React.useEffect(() => {
    if (!selectedAdminVendor && companies.length > 0) {
      setSelectedAdminVendor(companies[0].name);
    }
  }, [companies, selectedAdminVendor]);

  // States for Category Management
  const [newCatName, setNewCatName] = useState("");
  const [newCatQuota, setNewCatQuota] = useState(100);
  const [newCompanyAllocations, setNewCompanyAllocations] = useState<Record<string, number>>({});

  React.useEffect(() => {
    // Sync company-specific allocations when company list changes
    setNewCompanyAllocations((prev) => {
      const copy = { ...prev };
      companies.forEach((co) => {
        if (copy[co.name] === undefined) {
          copy[co.name] = 10;
        }
      });
      return copy;
    });
  }, [companies]);

  // States for Company Management
  const [newCompanyName, setNewCompanyName] = useState("");

  // States for Dropdowns Option Management
  const [newOptValue, setNewOptValue] = useState("");
  const [newOptField, setNewOptField] = useState<"sending_batch" | "status" | "bureau" | "final_status">("sending_batch");

  // States for User Management
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRealName, setNewRealName] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("recruiter");
  const [newUserAssignedProjects, setNewUserAssignedProjects] = useState<string[]>([]);
  const [newUserRecruiterCompany, setNewUserRecruiterCompany] = useState<string>("");

  React.useEffect(() => {
    if (!newUserRecruiterCompany && companies.length > 0) {
      setNewUserRecruiterCompany(companies[0].name);
    }
  }, [companies, newUserRecruiterCompany]);

  const showSuccess = (text: string) => {
    setSuccessMsg(text);
    setErrorMsg("");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const showError = (text: string) => {
    setErrorMsg(text);
    setSuccessMsg("");
    setTimeout(() => setErrorMsg(""), 4000);
  };

  // Allocations & Categories Change handler
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    if (categories.some((c) => c.name.toLowerCase() === newCatName.toLowerCase().trim())) {
      showError(`Job Category "${newCatName}" already exists.`);
      return;
    }

    // Clean and verify company-specific allocations
    const cleanedAllocations: Record<string, number> = {};
    companies.forEach((co) => {
      cleanedAllocations[co.name] = Number(newCompanyAllocations[co.name] || 0);
    });
    const sumAllocations = Object.values(cleanedAllocations).reduce((sum, val) => sum + val, 0);

    const updated = [
      ...categories,
      { 
        id: `cat-${Date.now()}`, 
        name: newCatName.trim(), 
        max_quota: sumAllocations,
        company_allocations: cleanedAllocations
      }
    ];

    const isOk = await onUpdateCategories(updated);
    if (isOk) {
      showSuccess(`Added Category: "${newCatName.trim()}" with total allocation ${sumAllocations}`);
      setNewCatName("");
      const resetAlls: Record<string, number> = {};
      companies.forEach((co) => { resetAlls[co.name] = 10; });
      setNewCompanyAllocations(resetAlls);
    } else {
      showError("Failed to update database.");
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    const updated = categories.filter((c) => c.id !== catId);
    const isOk = await onUpdateCategories(updated);
    if (isOk) {
      showSuccess(`Deleted Category "${catName}".`);
    } else {
      showError("Failed to delete category.");
    }
  };

  const handleUpdateQuotaValue = async (catId: string, newQuotaStr: string) => {
    const freshQuota = parseInt(newQuotaStr, 10);
    if (isNaN(freshQuota) || freshQuota < 0) return;

    const updated = categories.map((c) => {
      if (c.id === catId) {
        return { ...c, max_quota: freshQuota };
      }
      return c;
    });

    const isOk = await onUpdateCategories(updated);
    if (isOk) {
      showSuccess("Allocation updated successfully!");
    }
  };

  const handleSaveCategoryEdit = async (catId: string) => {
    if (!editingCatName.trim()) {
      showError("Category name cannot be empty.");
      return;
    }
    
    // Check if another category has the same name
    const hasDuplicate = categories.some(
      (c) => c.id !== catId && c.name.toLowerCase() === editingCatName.toLowerCase().trim()
    );
    if (hasDuplicate) {
      showError(`Job Category "${editingCatName.trim()}" already exists.`);
      return;
    }

    // Clean and verify company-specific allocations
    const cleanedAllocations: Record<string, number> = {};
    companies.forEach((co) => {
      cleanedAllocations[co.name] = Number(editingCompanyAllocations[co.name] || 0);
    });
    const sumAllocations = Object.values(cleanedAllocations).reduce((sum, val) => sum + val, 0);

    const updated = categories.map((c) => {
      if (c.id === catId) {
        return { 
          ...c, 
          name: editingCatName.trim(), 
          max_quota: sumAllocations,
          company_allocations: cleanedAllocations
        };
      }
      return c;
    });

    const isOk = await onUpdateCategories(updated);
    if (isOk) {
      showSuccess(`Updated Category: "${editingCatName.trim()}" successfully with total allocation ${sumAllocations}`);
      setEditingCatId(null);
    } else {
      showError("Failed to save changes.");
    }
  };

  // Companies Management Handler
  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    if (companies.some((co) => co.name.toLowerCase() === newCompanyName.toLowerCase().trim())) {
      showError(`Vendor Agency "${newCompanyName}" already exists.`);
      return;
    }

    const updated = [
      ...companies,
      { id: `co-${Date.now()}`, name: newCompanyName.trim() }
    ];

    const isOk = await onUpdateCompanies(updated);
    if (isOk) {
      showSuccess(`Company "${newCompanyName.trim()}" registered successfully!`);
      setNewCompanyName("");
    } else {
      showError("Failed to add company.");
    }
  };

  const handleDeleteCompany = async (coId: string, coName: string) => {
    const updated = companies.filter((c) => c.id !== coId);
    const isOk = await onUpdateCompanies(updated);
    if (isOk) {
      showSuccess(`Deleted Supply Company: ${coName}.`);
    } else {
      showError("Failed to remove company.");
    }
  };

  const handleSaveCompanyEdit = async (coId: string) => {
    if (!editingCompanyName.trim()) {
      showError("Company name cannot be empty.");
      return;
    }

    const hasDuplicate = companies.some(
      (c) => c.id !== coId && c.name.toLowerCase() === editingCompanyName.toLowerCase().trim()
    );
    if (hasDuplicate) {
      showError(`Vendor Agency "${editingCompanyName.trim()}" already exists.`);
      return;
    }

    const updated = companies.map((c) => {
      if (c.id === coId) {
        return { ...c, name: editingCompanyName.trim() };
      }
      return c;
    });

    const isOk = await onUpdateCompanies(updated);
    if (isOk) {
      showSuccess(`Updated Vendor: "${editingCompanyName.trim()}" successfully!`);
      setEditingCompanyId(null);
    } else {
      showError("Failed to save company update.");
    }
  };

  // Dropdowns Lists handler
  const handleAddDropdownOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptValue.trim()) return;

    // Check unique value
    if (dropdownOptions.some(opt => opt.field === newOptField && opt.value.toLowerCase() === newOptValue.toLowerCase().trim())) {
      showError(`Option "${newOptValue}" already exists in ${newOptField}.`);
      return;
    }

    const updated = [
      ...dropdownOptions,
      { id: `opt-${Date.now()}`, field: newOptField, value: newOptValue.trim() }
    ];

    const isOk = await onUpdateDropdownOptions(updated);
    if (isOk) {
      showSuccess(`Created dropdown option "${newOptValue}" inside "${newOptField}"!`);
      setNewOptValue("");
    } else {
      showError("Could not update dropdown list.");
    }
  };

  const handleDeleteDropdownOption = async (optId: string, optVal: string) => {
    const updated = dropdownOptions.filter(d => d.id !== optId);
    const isOk = await onUpdateDropdownOptions(updated);
    if (isOk) {
      showSuccess(`Removed option listing: "${optVal}".`);
    } else {
      showError("Could not delete dropdown option.");
    }
  };

  // User Management
  const handleCreateUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newRealName.trim()) {
      showError("Please complete all credentials details.");
      return;
    }

    const userPayload: User = {
      username: newUsername.trim().toLowerCase(),
      password: newPassword.trim(),
      name: newRealName.trim(),
      role: newUserRole,
      assigned_projects: newUserAssignedProjects,
      recruiter_company: newUserRole === "recruiter" ? newUserRecruiterCompany : undefined
    };

    const res = await onAddUser(userPayload);
    if (res.success) {
      showSuccess(`Successfully provisioned account password for @${newUsername.trim()}`);
      setNewUsername("");
      setNewPassword("");
      setNewRealName("");
      setNewUserAssignedProjects([]);
    } else {
      showError(res.message || "Failed to create user account.");
    }
  };

  const handleDeleteUserAccount = async (username: string) => {
    if (username === "admin") {
      showError("Gate Lock: Primary Super-Admin account cannot be deleted for safety.");
      return;
    }

    const isOk = await onDeleteUser(username);
    if (isOk) {
      showSuccess(`Account representing @${username} was deleted.`);
    } else {
      showError("Could not delete user.");
    }
  };

  return (
    <div id="admin-panel-viewport" className="flex-1 overflow-y-auto p-6 space-y-6 max-h-screen">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card border border-line rounded-xl p-5 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-display font-medium text-ink flex items-center gap-2">
            <Sliders className="w-5 text-accent" />
            <span>Master System Settings & Controls</span>
          </h2>
          <p className="text-xs text-muted">Set global metrics capacities, lookup references, companies, and authorize credentials access.</p>
        </div>

        <button
          onClick={() => onRefresh()}
          className="text-[10px] font-mono text-muted hover:text-ink px-2.5 py-1.5 border border-line rounded-lg bg-paper/30 cursor-pointer"
        >
          Force Resync Data
        </button>
      </div>

      {/* Message Toaster */}
      {successMsg && (
        <div className="p-4 bg-green-50 text-success-green border border-green-200 rounded-xl text-xs flex gap-3 items-center animate-fade-in font-sans">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <p className="font-semibold">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 text-bad border border-red-200 rounded-xl text-xs flex gap-3 items-center animate-fade-in font-sans">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="font-semibold">{errorMsg}</p>
        </div>
      )}

      {/* Tab Menu Selection Grid */}
      <div className="flex border-b border-line gap-2 overflow-x-auto select-none font-sans scrollbar-none">
        
        <button
          onClick={() => setActiveSubTab("project")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "project"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 inline mr-1" />
          Project Settings
        </button>

        <button
          onClick={() => setActiveSubTab("companies")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "companies"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 inline mr-1" />
          Supply Companies / Vendors
        </button>

        <button
          onClick={() => setActiveSubTab("quotas")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "quotas"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Layers className="w-3.5 h-3.5 inline mr-1" />
          Labor Allocations
        </button>

        <button
          onClick={() => setActiveSubTab("dropdowns")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "dropdowns"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Tags className="w-3.5 h-3.5 inline mr-1" />
          Dropdown Options
        </button>

        <button
          onClick={() => setActiveSubTab("users")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "users"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users2 className="w-3.5 h-3.5 inline mr-1" />
          Credentials Manager
        </button>

        <button
          onClick={() => setActiveSubTab("gdrive")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "gdrive"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Cloud className="w-3.5 h-3.5 inline mr-1 text-emerald-500 animate-pulse" />
          Google Drive Backup
        </button>

      </div>

      {/* Sub Views */}
      <div className="font-sans">

        {/* SUB 0: PROJECT WRAPPER SETTINGS */}
        {activeSubTab === "project" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in font-sans">
            {/* List of projects */}
            <div className="lg:col-span-7 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-accent shrink-0" />
                    <span>Active Projects Directory ({projects.length})</span>
                  </h3>
                  <p className="text-xs text-muted">
                    Switch focuses or audit system parameters.
                  </p>
                </div>
                {!isAddingNewProject && (
                  <button
                    onClick={() => {
                      setIsAddingNewProject(true);
                    }}
                    className="px-3 py-1.5 bg-accent/15 text-accent hover:bg-accent/25 rounded text-xs font-mono uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Project
                  </button>
                )}
              </div>

              <div className="border border-line/60 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs bg-card">
                  <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                    <tr>
                      <th className="p-2.5 w-12 text-center">Active</th>
                      <th className="p-2.5">Project Details</th>
                      <th className="p-2.5">Client & site</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {projects.map((proj) => {
                      const isActive = selectedProjectId === proj.id;
                      const isBeingEdited = selectedEditProjectId === proj.id && !isAddingNewProject;
                      return (
                        <tr
                          key={proj.id}
                          className={`hover:bg-paper/30 transition-colors ${
                            isActive ? "bg-accent/5" : ""
                          } ${isBeingEdited ? "ring-1 ring-inset ring-accent/60 bg-accent/2" : ""}`}
                        >
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => {
                                onSelectProject(proj.id);
                                showSuccess(`Focused active portal on "${proj.name}"`);
                              }}
                              className={`p-1.5 rounded transition-colors ${
                                isActive ? "text-accent" : "text-muted hover:text-ink hover:bg-paper/40"
                              }`}
                              title={isActive ? "Currently Selected Active Focus" : "Click to select as active focus"}
                            >
                              <CheckCircle className={`w-4 h-4 ${isActive ? "fill-accent/20" : ""}`} />
                            </button>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-ink">{proj.name}</div>
                            <div className="text-[10px] text-muted font-mono">{proj.contract_number}</div>
                          </td>
                          <td className="p-2.5 text-muted leading-tight">
                            <div>{proj.client}</div>
                            <div className="text-[10px] italic">{proj.location}</div>
                          </td>
                          <td className="p-2.5 text-right whitespace-nowrap pr-4">
                            {confirmDeleteProjId === proj.id ? (
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <span className="text-[9px] text-[#A30000] font-mono font-bold animate-pulse">Confirm Delete?</span>
                                <button
                                  onClick={async () => {
                                    const ok = await onDeleteProject(proj.id);
                                    if (ok) {
                                      showSuccess(`Project "${proj.name}" removed successfully.`);
                                    } else {
                                      showError("Failed to remove project from database.");
                                    }
                                    setConfirmDeleteProjId(null);
                                  }}
                                  className="px-2 py-0.5 text-[9px] font-bold text-white bg-bad hover:bg-bad/90 rounded border border-bad transition-all cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteProjId(null)}
                                  className="px-2 py-0.5 text-[9px] font-medium text-ink bg-paper border border-line hover:bg-paper/85 rounded transition-all cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => handleLoadProjectForEdit(proj)}
                                  className="px-2 py-1 bg-paper/60 hover:bg-paper border border-line rounded text-[10px] text-ink font-mono font-medium cursor-pointer"
                                >
                                  Edit/Load
                                </button>
                                <button
                                  onClick={() => {
                                    if (projects.length <= 1) {
                                      showError("Cannot delete the only project block.");
                                      return;
                                    }
                                    setConfirmDeleteProjId(proj.id);
                                  }}
                                  disabled={projects.length <= 1}
                                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-bad border border-bad/30 rounded text-[10px] font-mono font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Editing / Creation panel */}
            <div className="lg:col-span-5 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              {isAddingNewProject ? (
                <>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-2">
                        <Plus className="w-4 h-4 text-accent shrink-0" />
                        <span>Register New Project</span>
                      </h3>
                      <p className="text-xs text-muted">Submit a new site project draft</p>
                    </div>
                    <button
                      onClick={() => setIsAddingNewProject(false)}
                      className="text-xs text-muted hover:text-ink font-mono underline"
                    >
                      Back to Edit
                    </button>
                  </div>

                  <form onSubmit={handleCreateProject} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Project Name (Title) *</label>
                      <input
                        type="text"
                        value={newProjName}
                        onChange={(e) => setNewProjName(e.target.value)}
                        placeholder="e.g. Sanken Airport Terminal Expansion"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Client Organization</label>
                      <input
                        type="text"
                        value={newProjClient}
                        onChange={(e) => setNewProjClient(e.target.value)}
                        placeholder="e.g. Malaysia Civil Aviation"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Contract # / Reference</label>
                      <input
                        type="text"
                        value={newProjContract}
                        onChange={(e) => setNewProjContract(e.target.value)}
                        placeholder="e.g. APT3-2026-SANKEN-0012"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Core Site Location</label>
                      <input
                        type="text"
                        value={newProjLocation}
                        onChange={(e) => setNewProjLocation(e.target.value)}
                        placeholder="e.g. KLIA Terminal 3 Outer Sector"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Assigned Site Engineer</label>
                      <input
                        type="text"
                        value={newProjEngineer}
                        onChange={(e) => setNewProjEngineer(e.target.value)}
                        placeholder="e.g. Ir. Tan"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Lead Admin Coordinator</label>
                      <input
                        type="text"
                        value={newProjAdmin}
                        onChange={(e) => setNewProjAdmin(e.target.value)}
                        placeholder="e.g. Admin Coordinator"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Register Project Block
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-accent shrink-0" />
                      <span>Edit Project Details</span>
                    </h3>
                    <p className="text-xs text-muted">
                      Updating settings for: <strong className="font-semibold text-ink">{projName || "Selected project"}</strong>
                    </p>
                  </div>

                  <form onSubmit={handleUpdateProject} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Project Name (Title) *</label>
                      <input
                        type="text"
                        value={projName}
                        onChange={(e) => setProjName(e.target.value)}
                        placeholder="e.g. Sanken Airport Terminal Expansion"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Client</label>
                        <input
                          type="text"
                          value={projClient}
                          onChange={(e) => setProjClient(e.target.value)}
                          placeholder="e.g. Malaysia Civil Aviation"
                          className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Contract #</label>
                        <input
                          type="text"
                          value={projContract}
                          onChange={(e) => setProjContract(e.target.value)}
                          placeholder="e.g. APT3-2026-SANKEN-0012"
                          className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Core Site Location</label>
                      <input
                        type="text"
                        value={projLocation}
                        onChange={(e) => setProjLocation(e.target.value)}
                        placeholder="e.g. KLIA Terminal 3 Outer Sector"
                        className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Site Engineer</label>
                        <input
                          type="text"
                          value={projEngineer}
                          onChange={(e) => setProjEngineer(e.target.value)}
                          placeholder="e.g. Ir. Tan"
                          className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-muted uppercase tracking-wider block">Lead Coordinator</label>
                        <input
                          type="text"
                          value={projAdmin}
                          onChange={(e) => setProjAdmin(e.target.value)}
                          placeholder="e.g. Admin Coordinator"
                          className="w-full bg-paper/20 border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Save/Update Project Details
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* SUB 1: LABOUR ALLOCATIONS & CATEGORIES */}
        {activeSubTab === "quotas" && (
          <div className="space-y-6 animate-fade-in">
            {/* Vendor Filter / Selector tab bar */}
            <div className="bg-card border border-line rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-accent" />
                  Supply Vendor Wise Labor Allocations
                </h3>
                <p className="text-xs text-muted">
                  View and manage allocation quotas separate by Supply Vendor / Agency. Allocations limit worker approvals dynamically.
                </p>
              </div>

              <div className="space-y-1.5 shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-muted block">
                  Select Active Vendor:
                </span>
                <div className="flex flex-wrap gap-1.5 p-1 bg-paper border border-line rounded-xl">
                  {companies.map((co) => {
                    const isActive = selectedAdminVendor === co.name;
                    // Count total slots of this company
                    const totalCompanyAlloc = categories.reduce((sum, cat) => sum + (cat.company_allocations?.[co.name] ?? 0), 0);
                    return (
                      <button
                        type="button"
                        key={co.id}
                        onClick={() => setSelectedAdminVendor(co.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? "bg-accent text-white shadow-sm"
                            : "text-muted hover:text-ink hover:bg-paper/40"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{co.name}</span>
                        <span className={`px-1.5 py-0.2 text-[9px] rounded-md ${
                          isActive ? "bg-white/20 text-white" : "bg-paper border border-line/30 text-muted"
                        }`}>
                          {totalCompanyAlloc} slots
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main content grid: Left contains Vendor details and Histogram, Right contains Register form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Side: Selected Vendor dashboard & custom table */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Max Labor Histogram */}
                {selectedAdminVendor && (() => {
                  const histogramData = categories.map((cat) => {
                    const limit = cat.company_allocations?.[selectedAdminVendor] ?? 0;
                    const activeCount = workers.filter(
                      (w) => w.category === cat.name && w.supply_company === selectedAdminVendor && w.state === "active"
                    ).length;
                    const rem = Math.max(0, limit - activeCount);
                    return {
                      name: cat.name.length > 15 ? cat.name.substring(0, 15) + "..." : cat.name,
                      "Allocated": limit,
                      "Active": activeCount,
                      "Remaining": rem,
                    };
                  });

                  return (
                    <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-3 font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart2 className="w-4 h-4 text-accent" />
                          <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-ink">
                            Max Labor Histogram & Quota Utilization ({selectedAdminVendor})
                          </h4>
                        </div>
                        <span className="text-[10px] text-muted font-mono bg-paper border border-line/60 px-2 py-0.5 rounded-md">
                          Live Quota Allocation Status
                        </span>
                      </div>

                      <div className="h-48 w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={histogramData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="rgba(0,0,0,0.5)" />
                            <YAxis tick={{ fontSize: 9 }} stroke="rgba(0,0,0,0.5)" />
                            <Tooltip 
                              contentStyle={{ background: "#FDFBF6", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "8px", fontSize: "10px" }}
                            />
                            <Legend wrapperStyle={{ fontSize: "9px" }} />
                            <Bar dataKey="Allocated" fill="#1E293B" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Active" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Remaining" fill="#10B981" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })()}

                {/* Quotas Table list */}
                <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 font-sans">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-ink font-display">
                        Category Allocations for {selectedAdminVendor}
                      </h3>
                      <p className="text-xs text-muted">
                        Configure category limits for {selectedAdminVendor}. Redundant categories can be safely deleted.
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-[#1E293B] text-white text-[10px] font-mono rounded-md uppercase tracking-wider border border-neutral-700">
                      {selectedAdminVendor}
                    </span>
                  </div>

                  <div className="border border-line/60 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs bg-card">
                      <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                        <tr>
                          <th className="p-3 pl-4">Category Name</th>
                          <th className="p-3 w-80">Allocation & Live Utilization</th>
                          <th className="p-3 text-right pr-6 w-44">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/45">
                        {categories.map((c) => {
                          const isEditing = editingCatId === c.id;
                          const isConfirmingDelete = confirmDeleteCatId === c.id;

                          // Statistics for this vendor under this category
                          const limit = c.company_allocations?.[selectedAdminVendor] ?? 0;
                          const activeCount = workers.filter(
                            (w) => w.category === c.name && w.supply_company === selectedAdminVendor && w.state === "active"
                          ).length;
                          const rem = Math.max(0, limit - activeCount);
                          const percent = limit > 0 ? (activeCount / limit) * 100 : 0;
                          const isLocked = limit <= 0 || rem <= 0;

                          return (
                            <tr key={c.id} className="hover:bg-paper/10 transition-colors">
                              {/* Category Name Column */}
                              <td className="p-3 font-semibold text-ink font-display">
                                {isEditing ? (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-mono text-muted uppercase block">Category Name</label>
                                    <input
                                      type="text"
                                      value={editingCatName}
                                      onChange={(e) => setEditingCatName(e.target.value)}
                                      className="w-full bg-paper border border-line focus:border-accent rounded px-2 py-1 text-xs outline-none text-ink font-semibold"
                                      placeholder="Category Name"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-sm">{c.name}</span>
                                )}
                              </td>

                              {/* Allocated Slots & Occupancy Status Column */}
                              <td className="p-3">
                                {isEditing ? (
                                  <div className="space-y-2 py-1">
                                    <div className="flex items-center gap-2 border-b border-line/30 pb-2">
                                      <span className="text-[11px] font-bold text-accent w-36 truncate flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5" />
                                        {selectedAdminVendor}
                                      </span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={editingCompanyAllocations[selectedAdminVendor] ?? 0}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          setEditingCompanyAllocations((prev) => ({
                                            ...prev,
                                            [selectedAdminVendor]: val,
                                          }));
                                        }}
                                        className="w-20 bg-paper border border-line px-1.5 py-0.5 text-xs outline-none rounded font-mono font-bold focus:border-accent text-ink text-right"
                                      />
                                      <span className="text-[10px] text-muted">slots</span>
                                    </div>
                                    
                                    <details className="cursor-pointer group">
                                      <summary className="text-[9px] text-muted font-mono uppercase tracking-wider select-none hover:text-ink">
                                        View/Edit Other Vendor Allocations
                                      </summary>
                                      <div className="space-y-1.5 mt-2 pl-2 border-l border-line/45">
                                        {companies.filter(co => co.name !== selectedAdminVendor).map((co) => {
                                          const curAlloc = editingCompanyAllocations[co.name] ?? 0;
                                          return (
                                            <div key={co.id} className="flex items-center gap-2">
                                              <span className="text-[10px] text-muted w-28 truncate">{co.name}</span>
                                              <input
                                                type="number"
                                                min={0}
                                                value={curAlloc}
                                                onChange={(e) => {
                                                  const val = Number(e.target.value);
                                                  setEditingCompanyAllocations((prev) => ({
                                                    ...prev,
                                                    [co.name]: val,
                                                  }));
                                                }}
                                                className="w-16 bg-paper border border-line px-1 py-0.5 text-[11px] outline-none rounded font-mono focus:border-accent text-ink text-right"
                                              />
                                              <span className="text-[9px] text-muted">slots</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </details>

                                    <div className="text-[10px] font-mono text-muted/80 pt-1 border-t border-line/20">
                                      Combined Quota Limit: <span className="font-bold text-ink">{(Object.values(editingCompanyAllocations) as number[]).reduce((a, b) => a + b, 0)} slots</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1 py-1">
                                    {/* Limits block statistics */}
                                    <div className="flex items-center justify-between gap-1 text-[11px]">
                                      <span className="font-mono text-ink font-semibold">
                                        {limit} slots allotted
                                      </span>
                                      <span className={`font-mono text-[10px] font-bold ${
                                        isLocked ? "text-bad" : "text-success-green"
                                      }`}>
                                        {rem} remaining open
                                      </span>
                                    </div>

                                    {/* Live occupancy progress bar */}
                                    <div className="w-full bg-paper rounded-full h-2 overflow-hidden border border-line/40">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          isLocked ? "bg-bad/70 animate-pulse" : "bg-accent"
                                        }`}
                                        style={{ width: `${Math.min(100, percent)}%` }}
                                      ></div>
                                    </div>

                                    <div className="text-[9px] text-muted font-mono flex justify-between">
                                      <span>Occupied capacity: {activeCount} slots used</span>
                                      <span>({percent.toFixed(0)}%)</span>
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Actions Column */}
                              <td className="p-3 text-right pr-4 w-44 whitespace-nowrap">
                                {isEditing ? (
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    <button
                                      onClick={() => handleSaveCategoryEdit(c.id)}
                                      className="p-1 px-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded border border-green-500/25 text-[10px] font-mono font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                                      title="Save Changes"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Save</span>
                                    </button>
                                    <button
                                      onClick={() => setEditingCatId(null)}
                                      className="p-1 px-2 bg-paper border border-line text-muted hover:text-ink hover:bg-paper/85 rounded text-[10px] font-mono inline-flex items-center gap-1 transition-all cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Cancel</span>
                                    </button>
                                  </div>
                                ) : isConfirmingDelete ? (
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    <span className="text-[9px] text-[#A30000] font-mono font-bold animate-pulse">Confirm Delete?</span>
                                    <button
                                      onClick={() => {
                                        handleDeleteCategory(c.id, c.name);
                                        setConfirmDeleteCatId(null);
                                      }}
                                      className="px-2 py-0.5 text-[9px] font-bold text-white bg-bad hover:bg-bad/90 rounded border border-bad transition-all cursor-pointer"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteCatId(null)}
                                      className="px-2 py-0.5 text-[9px] font-medium text-ink bg-paper border border-line hover:bg-paper/85 rounded transition-all cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 justify-end w-full">
                                    <button
                                      onClick={() => {
                                        setEditingCatId(c.id);
                                        setEditingCatName(c.name);
                                        setEditingCatQuota(c.max_quota);
                                        // Load current company allocations or set default 0
                                        const prepAllocations: Record<string, number> = {};
                                        companies.forEach((co) => {
                                          prepAllocations[co.name] = c.company_allocations?.[co.name] ?? 0;
                                        });
                                        setEditingCompanyAllocations(prepAllocations);
                                        setConfirmDeleteCatId(null);
                                      }}
                                      className="text-muted hover:text-accent p-1.5 rounded-lg hover:bg-paper/40 transition-colors cursor-pointer inline-flex items-center gap-1"
                                      title="Edit Allocations & Name"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      <span className="text-[10px]">Edit</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setConfirmDeleteCatId(c.id);
                                        setEditingCatId(null);
                                      }}
                                      className="text-muted hover:text-bad p-1.5 rounded-lg hover:bg-paper/45 transition-colors cursor-pointer inline-flex items-center gap-1"
                                      title="Delete Category"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span className="text-[10px]">Delete</span>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right category registration adder */}
              <div className="lg:col-span-4 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 h-fit font-sans">
                <div>
                  <h3 className="text-sm font-semibold text-ink font-display" id="register-category-title">Register New Cohort Category</h3>
                  <p className="text-xs text-muted">Create a unique job category and distribute allotments among supply vendors.</p>
                </div>

                <form onSubmit={handleAddCategory} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-muted mb-1">Category Name</label>
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="e.g. Hospitality Specialists"
                      className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none text-ink font-semibold"
                      required
                    />
                  </div>

                  <div className="space-y-2 border border-line/50 rounded-lg p-3 bg-paper/10">
                    <label className="block text-[10px] uppercase font-mono text-muted border-b border-line/20 pb-1 font-bold">Supply Vendor Allocations</label>
                    {companies.map((co) => {
                      const val = newCompanyAllocations[co.name] ?? 10;
                      return (
                        <div key={co.id} className="flex items-center justify-between gap-2 py-0.5 border-b border-line/30 last:border-0 last:pb-0">
                          <span className="text-xs font-semibold text-ink truncate w-32">{co.name}</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={val}
                              onChange={(e) => {
                                const num = Number(e.target.value);
                                setNewCompanyAllocations((prev) => ({
                                  ...prev,
                                  [co.name]: num,
                                }));
                              }}
                              className="w-20 bg-paper border border-line focus:border-accent rounded px-2 py-0.5 text-xs text-ink font-mono text-right font-bold"
                              required
                            />
                            <span className="text-[10px] text-muted w-8 text-left">slots</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-[10px] text-muted text-right font-mono mt-1 pt-1 border-t border-line/10">
                      Total Allocation Limit: <span className="font-bold text-accent">{(Object.values(newCompanyAllocations) as number[]).reduce((a, b) => a + b, 0)} slots</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer font-bold"
                  >
                    Create Category & Allocations
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* SUB 2: COMPANIES */}
        {activeSubTab === "companies" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Left lists */}
            <div className="lg:col-span-8 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 font-sans">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Registered Supply Companies / Vendors</h3>
                <p className="text-xs text-muted">Agencies currently sending migrant workers under contracts.</p>
              </div>

              <div className="border border-line/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs bg-card">
                  <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                    <tr>
                      <th className="p-3 pl-4">Company Legal Designation Name</th>
                      <th className="p-3 w-48 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/45">
                    {companies.map((co) => {
                      const isEditing = editingCompanyId === co.id;
                      const isConfirmingDelete = confirmDeleteCompanyId === co.id;

                      return (
                        <tr key={co.id} className="hover:bg-paper/10 transition-colors">
                          <td className="p-3 font-semibold text-ink font-display">
                            {isEditing ? (
                              <div className="flex items-center gap-2 max-w-sm">
                                <Building2 className="w-4 h-4 text-accent shrink-0" />
                                <input
                                  type="text"
                                  value={editingCompanyName}
                                  onChange={(e) => setEditingCompanyName(e.target.value)}
                                  className="w-full bg-paper border border-line focus:border-accent rounded px-2.5 py-1 text-xs outline-none text-ink font-semibold"
                                  placeholder="Company Name"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted shrink-0" />
                                <span>{co.name}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right pr-4 w-48 whitespace-nowrap">
                            {isEditing ? (
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => handleSaveCompanyEdit(co.id)}
                                  className="p-1 px-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded border border-green-500/25 text-[10px] font-mono font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                                  title="Save Changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={() => setEditingCompanyId(null)}
                                  className="p-1 px-2 bg-paper border border-line text-muted hover:text-ink hover:bg-paper/85 rounded text-[10px] font-mono inline-flex items-center gap-1 transition-all cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : isConfirmingDelete ? (
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <span className="text-[9px] text-[#A30000] font-mono font-bold animate-pulse">Confirm Delete?</span>
                                <button
                                  onClick={() => {
                                    handleDeleteCompany(co.id, co.name);
                                    setConfirmDeleteCompanyId(null);
                                  }}
                                  className="px-2 py-0.5 text-[9px] font-bold text-white bg-bad hover:bg-bad/90 rounded border border-bad transition-all cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteCompanyId(null)}
                                  className="px-2 py-0.5 text-[9px] font-medium text-ink bg-paper border border-line hover:bg-paper/85 rounded transition-all cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingCompanyId(co.id);
                                    setEditingCompanyName(co.name);
                                    setConfirmDeleteCompanyId(null);
                                  }}
                                  className="text-muted hover:text-accent p-1.5 rounded-lg hover:bg-paper/40 transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Edit Vendor Name"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span className="text-[10px]">Edit</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmDeleteCompanyId(co.id);
                                    setEditingCompanyId(null);
                                  }}
                                  className="text-muted hover:text-bad p-1.5 rounded-lg hover:bg-paper/45 transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Delete Vendor Agency"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="text-[10px]">Delete</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Register vendor */}
            <div className="lg:col-span-4 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 h-fit font-sans">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Register Supply Company</h3>
                <p className="text-xs text-muted">Add a new supply agency into active registry selection lists.</p>
              </div>

              <form onSubmit={handleAddCompany} className="space-y-3">
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Apex Transit Ltd"
                  className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none font-semibold text-ink"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  Register Company
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUB 3: LOOKUP DROPDOWNS OPTIONS */}
        {activeSubTab === "dropdowns" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in font-sans">
            <div className="lg:col-span-8 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Dropdown Registry System Lookups</h3>
                <p className="text-xs text-muted">Standard options driving state and lists menus on Recruiter, Engineer, and Ops screens.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Section of sending batches */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Sending Batches</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "sending_batch").map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-1 px-2 border border-line/35 bg-card rounded text-xs select-none">
                        <span>{opt.value}</span>
                        <button onClick={() => handleDeleteDropdownOption(opt.id, opt.value)} className="hover:text-bad text-muted text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section of visa statuses */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Visa statuses (XPact)</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "status").map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-1 px-2 border border-line/35 bg-card rounded text-xs select-none">
                        <span>{opt.value}</span>
                        <button onClick={() => handleDeleteDropdownOption(opt.id, opt.value)} className="hover:text-bad text-muted text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bureau list */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Bureau alignment states</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "bureau").map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-1 px-2 border border-line/35 bg-card rounded text-xs select-none">
                        <span>{opt.value}</span>
                        <button onClick={() => handleDeleteDropdownOption(opt.id, opt.value)} className="hover:text-bad text-muted text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final Placement */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Final Arrival placement states</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "final_status").map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-1 px-2 border border-line/35 bg-card rounded text-xs select-none">
                        <span>{opt.value}</span>
                        <button onClick={() => handleDeleteDropdownOption(opt.id, opt.value)} className="hover:text-bad text-muted text-[10px]">×</button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Right option creator */}
            <div className="lg:col-span-4 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 h-fit">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Add Dropdown List Entry</h3>
                <p className="text-xs text-muted">Submit lookup values manually without software modifications.</p>
              </div>

              <form onSubmit={handleAddDropdownOption} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Select Field Family</label>
                  <select
                    value={newOptField}
                    onChange={(e: any) => setNewOptField(e.target.value)}
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2 py-1.5 text-xs outline-none cursor-pointer"
                  >
                    <option value="sending_batch">Sending Batch</option>
                    <option value="status">Visa Status (xpact)</option>
                    <option value="bureau">Bureau Clearance</option>
                    <option value="final_status">Final Placement Status</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">New Option Value string</label>
                  <input
                    type="text"
                    value={newOptValue}
                    onChange={(e) => setNewOptValue(e.target.value)}
                    placeholder="e.g. Batch #108 or In-Transit"
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  Create Option Listing
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUB 4: USER MANAGER */}
        {activeSubTab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in font-sans">
            {/* Left list of users */}
            <div className="lg:col-span-8 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Registered Security Staff Accounts</h3>
                <p className="text-xs text-muted">Authorised personnel currently registered in credentials lists.</p>
              </div>

              <div className="border border-line/60 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs bg-card">
                  <thead className="bg-paper text-muted font-mono text-[9px] uppercase">
                    <tr>
                      <th className="p-3 pl-4">Staff Name</th>
                      <th className="p-3">Username handle</th>
                      <th className="p-3">Scope Role assigned</th>
                      <th className="p-3">Assigned Projects Focus Scope</th>
                      <th className="p-3 w-20 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/45">
                    {users.map((u) => (
                      <tr key={u.username} className="hover:bg-paper/10">
                        <td className="p-3 font-semibold text-ink font-display">
                          <div>{u.name}</div>
                          {u.recruiter_company && (
                            <div className="text-[10px] text-accent font-mono mt-0.5 font-bold bg-accent/5 px-2 py-0.5 rounded border border-accent/15 w-fit flex items-center gap-1">
                              <span>Agency: {u.recruiter_company}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-muted">
                          @{u.username}
                        </td>
                        <td className="p-3 font-mono">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] uppercase ${
                            u.role === "admin" 
                              ? "bg-red-50 text-bad border-bad/30" 
                              : u.role === "engineer"
                              ? "bg-green-50 text-success-green border-success-green/30"
                              : "bg-neutral-50 text-muted border-line/40"
                          }`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3">
                          {!u.assigned_projects || u.assigned_projects.length === 0 ? (
                            <span className="text-accent font-semibold text-[9px] uppercase font-mono bg-accent/5 px-2 py-0.5 rounded border border-accent/15">
                              All Projects (Unrestricted)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {u.assigned_projects.map(pid => {
                                const proj = projects.find(p => p.id === pid);
                                return (
                                  <span key={pid} className="bg-paper border border-line text-muted text-[10px] px-1.5 py-0.5 rounded font-mono select-none" title={proj?.name || pid}>
                                    {proj ? (proj.name.length > 20 ? proj.name.substring(0, 18) + "..." : proj.name) : pid}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-right pr-4 whitespace-nowrap">
                          {u.username === "admin" ? (
                            <span className="text-[10px] text-muted italic pr-2">System Reserved</span>
                          ) : confirmDeleteUsername === u.username ? (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <span className="text-[9px] text-[#A30000] font-mono font-bold animate-pulse">Confirm?</span>
                              <button
                                onClick={async () => {
                                  await handleDeleteUserAccount(u.username);
                                  setConfirmDeleteUsername(null);
                                }}
                                className="px-2 py-0.5 text-[9px] font-bold text-white bg-bad hover:bg-bad/90 rounded border border-bad transition-all cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteUsername(null)}
                                className="px-2 py-0.5 text-[9px] font-medium text-ink bg-paper border border-line hover:bg-paper/85 rounded transition-all cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteUsername(u.username)}
                              className="text-muted hover:text-bad p-1.5 rounded hover:bg-paper/45 transition-colors cursor-pointer"
                              title={`Delete account @${u.username}`}
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User creation block */}
            <div className="lg:col-span-4 bg-card border border-line rounded-xl p-5 shadow-sm space-y-4 h-fit">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display">Provision New User Account</h3>
                <p className="text-xs text-muted">Creates usernames and scope roles matching user types.</p>
              </div>

              <form onSubmit={handleCreateUserAccount} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Corporate Full Name</label>
                  <input
                    type="text"
                    value={newRealName}
                    onChange={(e) => setNewRealName(e.target.value)}
                    placeholder="e.g. Farid Recruiter"
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Username handle</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. recruiter_ksj"
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Secret Access Passkey</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="password..."
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2.5 py-1.5 text-xs outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">Authorized Role Group</label>
                  <select
                    value={newUserRole}
                    onChange={(e: any) => setNewUserRole(e.target.value)}
                    className="w-full bg-paper/20 border border-line focus:border-accent rounded px-2 py-1.5 text-xs outline-none cursor-pointer"
                  >
                    <option value="recruiter">Role 1: Sanken Overseas Recruiter Intake</option>
                    <option value="engineer">Role 2: Engineer Gate Approvals</option>
                    <option value="ops">Role 3: Admin2 Operations Updates</option>
                    <option value="admin">Role 4: Primary Super Administrator</option>
                    <option value="viewer">Role 5: Dashboard Viewer Scope Only</option>
                  </select>
                </div>

                {newUserRole === "recruiter" && (
                  <div className="bg-amber-500/5 border border-accent/15 rounded-lg p-3 space-y-1.5 animate-fade-in">
                    <label className="block text-[10px] uppercase font-mono text-accent font-bold mb-1">
                      Supply Agency Assigned (Required)
                    </label>
                    <select
                      value={newUserRecruiterCompany}
                      onChange={(e) => setNewUserRecruiterCompany(e.target.value)}
                      className="w-full bg-card border border-accent/25 focus:border-accent rounded px-2.5 py-1.5 text-xs font-semibold text-accent outline-none cursor-pointer"
                      required
                    >
                      <option value="" disabled>-- Select Supply Agency --</option>
                      {companies.map(co => (
                        <option key={co.id} value={co.name}>{co.name}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-muted/80 leading-normal">
                      Note: Under Role 1, this user is locked strictly to this supply company to represent their agency data entry.
                    </p>
                  </div>
                )}

                {/* Assigned Projects Selector */}
                <div>
                  <label className="block text-[10px] uppercase font-mono text-muted mb-1">
                    Assigned Project Focus (Multi-select)
                  </label>
                  <div className="bg-paper/20 border border-line rounded p-3 space-y-2 max-h-48 overflow-y-auto">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="user-project-all"
                        checked={newUserAssignedProjects.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUserAssignedProjects([]);
                          }
                        }}
                        className="rounded border-line text-accent focus:ring-accent cursor-pointer"
                      />
                      <label htmlFor="user-project-all" className="text-xs text-ink font-semibold cursor-pointer">
                        All Projects (Unrestricted)
                      </label>
                    </div>
                    <div className="border-t border-line/40 my-1"></div>
                    {projects.map((p) => (
                      <div key={p.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          id={`user-project-${p.id}`}
                          checked={newUserAssignedProjects.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUserAssignedProjects([...newUserAssignedProjects, p.id]);
                            } else {
                              setNewUserAssignedProjects(newUserAssignedProjects.filter(id => id !== p.id));
                            }
                          }}
                          className="rounded border-line text-accent focus:ring-accent mt-0.5 cursor-pointer"
                        />
                        <label htmlFor={`user-project-${p.id}`} className="text-xs text-muted cursor-pointer leading-tight">
                          {p.name} <span className="text-[9px] font-mono text-muted/60">({p.contract_number})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted mt-1 leading-normal">
                    Assigned personnel can only view pipeline metrics and perform intake/approvals operations on their chosen projects.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider cursor-pointer font-bold"
                >
                  Provision Credentials
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUB 5: GOOGLE DRIVE BACKUPS PANEL */}
        {activeSubTab === "gdrive" && (
          <div className="bg-card border border-line rounded-xl p-6 shadow-sm space-y-6 animate-fade-in font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line/60">
              <div>
                <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-accent" />
                  <span>Google Drive Automated Backup Archive</span>
                </h3>
                <p className="text-xs text-muted">
                  Configure the Sanken Overseas Combined Master Records spreadsheet sync with Google Drive.
                </p>
              </div>

              {gdriveUser && (
                <button
                  type="button"
                  onClick={async () => {
                    await googleLogout();
                    setGdriveUser(null);
                    setGdriveToken(null);
                    setGdriveSyncStatus("idle");
                  }}
                  className="px-3 py-1.5 text-xs font-mono font-bold text-red-650 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer transition-all self-start sm:self-center"
                >
                  Disconnect Account
                </button>
              )}
            </div>

            {/* Error Notification Banner */}
            {gdriveError && (
              <div className="p-4 bg-red-50 text-bad border border-red-250/20 rounded-xl text-xs flex gap-3 items-center animate-fade-in font-sans">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">Sync Error Occurred</p>
                  <p className="opacity-90 text-[11px]">{gdriveError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGdriveError(null)}
                  className="text-stone-400 hover:text-stone-600 font-mono text-[10px] font-bold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Account binding & connection controller */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-paper p-5 border border-line rounded-xl space-y-4">
                  <h4 className="text-[10px] uppercase font-bold text-stone-450 tracking-wider">
                    Google Authorization Status
                  </h4>

                  {!gdriveUser ? (
                    <div className="space-y-4 pt-1">
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Authorize this applet to save and update the <strong>Combined Master Records Archive</strong> Excel workbook automatically inside the storage of your designated corporate Google Account.
                      </p>

                      {/* Google Style authenticate button */}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setGdriveError(null);
                            const res = await googleSignIn();
                            if (res) {
                              setGdriveUser(res.user);
                              setGdriveToken(res.accessToken);
                              showSuccess("Google Account successfully authorized for backup storage!");
                            }
                          } catch (err: any) {
                            setGdriveError(err?.message || "User aborted authorization or popup blocked.");
                          }
                        }}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-stone-300 hover:border-stone-400 focus:outline-none bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-700 rounded-xl cursor-pointer transition-all shadow-sm"
                      >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        </svg>
                        <span className="text-xs font-mono font-bold tracking-tight uppercase">Bind System Google Drive</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Active Authenticated Status card */}
                      <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-line/50">
                        {gdriveUser.photoURL ? (
                          <img
                            src={gdriveUser.photoURL}
                            alt="Avatar"
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full border border-stone-250 shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 text-accent flex items-center justify-center font-mono font-bold uppercase shrink-0">
                            {gdriveUser.displayName?.charAt(0) || gdriveUser.email?.charAt(0) || "G"}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-ink truncate font-display">
                            {gdriveUser.displayName || "Google Operator"}
                          </p>
                          <p className="text-[10px] text-muted truncate">
                            {gdriveUser.email}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500">Auto background save:</span>
                          <span className="font-bold text-success-green flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-success-green rounded-full animate-ping"></span>
                            ACTIVE
                          </span>
                        </div>

                        {/* Interactive toggle logic */}
                        <div className="flex items-center justify-between border-t border-line/40 pt-3">
                          <label htmlFor="chk-auto-sync" className="text-stone-700 font-semibold cursor-pointer select-none">
                            Immediate Sync on database edits
                          </label>
                          <input
                            type="checkbox"
                            id="chk-auto-sync"
                            checked={gdriveAutoSync}
                            onChange={(e) => setGdriveAutoSync(e.target.checked)}
                            className="rounded border-line text-accent h-4 w-4 focus:ring-accent cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-stone-50/50 p-4 rounded-xl border border-dashed border-stone-200 text-[11px] leading-relaxed text-stone-500">
                  <p className="font-semibold text-stone-600 mb-1">💡 Administrative Policy Note:</p>
                  To secure candidate information records against machine crashes, backups are safely performed entirely in the client-side context directly under the corporate API quota restrictions of the authenticated administrator. No credentials or files are stored outside your Google Cloud ecosystem directory.
                </div>
              </div>

              {/* Right Column: Spreadsheet sync dashboard and logs */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-paper p-5 border border-line rounded-xl space-y-4">
                  <h4 className="text-[10px] uppercase font-bold text-stone-450 tracking-wider">
                    Combined Master Excel Settings
                  </h4>

                  <div className="space-y-3.5">
                    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-line/40 text-xs">
                      <span className="text-stone-400">File Name:</span>
                      <span className="col-span-2 font-mono font-semibold text-ink text-right truncate">
                        Combined_Master_Records_Archive.xlsx
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-line/40 text-xs">
                      <span className="text-stone-400">Target Drive Scope:</span>
                      <span className="col-span-2 font-mono text-[10px] text-muted text-right truncate" title="Application specific file creation authority">
                        drive.file (App created documents)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-line/40 text-xs">
                      <span className="text-stone-400">Target File Action:</span>
                      <span className="col-span-2 font-bold text-accent text-right">
                        Automatic Overwrite / Version Replace
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-line/40 text-xs">
                      <span className="text-stone-400">Last Synced Timestamp:</span>
                      <span className="col-span-2 font-mono font-bold text-right text-stone-700">
                        {lastGdriveSync || "Never Synced"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1.5 text-xs">
                      <span className="text-stone-400">Sync Status:</span>
                      <span className="col-span-2 text-right">
                        {gdriveSyncStatus === "syncing" && (
                          <span className="text-accent font-bold animate-pulse flex items-center gap-1 justify-end">
                            <RefreshCw className="w-3 h-3 animate-spin inline-block shrink-0 text-accent" />
                            Overwriting remote version...
                          </span>
                        )}
                        {gdriveSyncStatus === "success" && (
                          <span className="text-success-green font-bold flex items-center gap-1 justify-end animate-fade-in">
                            Sync Completed Successfully (Replaced)
                          </span>
                        )}
                        {gdriveSyncStatus === "error" && (
                          <span className="text-bad font-bold flex items-center gap-1 justify-end">
                            Sync Failed
                          </span>
                        )}
                        {gdriveSyncStatus === "idle" && (
                          <span className="text-stone-500 font-semibold italic">
                            Idle (Awaiting database change or manual trigger)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      disabled={!gdriveUser || !gdriveToken || isGdriveSyncing}
                      onClick={async () => {
                        if (!gdriveToken) return;
                        setIsGdriveSyncing(true);
                        setGdriveSyncStatus("syncing");
                        setGdriveError(null);
                        const res = await uploadOrUpdateMasterFile(workers, gdriveToken);
                        if (res.success) {
                          setLastGdriveSync(new Date().toLocaleString());
                          setGdriveSyncStatus("success");
                          showSuccess("Combined Master Records Spreadsheet backup replaced successfully!");
                        } else {
                          setGdriveSyncStatus("error");
                          setGdriveError(res.error || "Manual backup replace failed");
                        }
                        setIsGdriveSyncing(false);
                      }}
                      className="flex-1 py-3 bg-accent hover:bg-accent/90 disabled:bg-stone-100 disabled:text-stone-400 disabled:border-stone-200 hover:scale-[1.01] active:scale-[0.98] text-white border border-transparent disabled:cursor-not-allowed font-mono font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      {isGdriveSyncing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>Syncing Archive...</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="w-4 h-4" />
                          <span>Sync Now to Google Drive</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Integration Details explanation card */}
                {gdriveUser && (
                  <div className="p-4 bg-emerald-50/40 border border-emerald-500/20 rounded-xl space-y-1.5 animate-fade-in">
                    <div className="text-xs font-bold font-display text-emerald-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      <span>How version replacing works with Google Drive API:</span>
                    </div>
                    <ul className="list-disc pl-4 text-[10px] text-stone-600 space-y-1">
                      <li>The applet looks for an existing file named <code className="font-semibold bg-emerald-100/50 px-1 rounded text-emerald-900 text-[10px]">Combined_Master_Records_Archive.xlsx</code>, skipping trashed files.</li>
                      <li>If found, it performs a <strong>direct overwrite swap</strong> of file content (media update patch), preserving the original file link and document ID on Google Drive.</li>
                      <li>If the file is missing or deleted, the applet automatically recreates a new master file and logs the fresh ID, guaranteeing seamless daily coverage.</li>
                    </ul>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
