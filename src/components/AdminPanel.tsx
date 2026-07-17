import React, { useState, useMemo } from "react";
import { Category, Company, DropdownOption, User, UserRole, ProjectDetail, Worker, BureauAllocation, XpactAllocation } from "../types";
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
  ExternalLink,
  Eye,
  Search
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
  bureauAllocations?: BureauAllocation[];
  xpactAllocations?: XpactAllocation[];
  onUpdateBureauAllocations: (newAllocs: BureauAllocation[]) => Promise<boolean>;
  onUpdateXpactAllocations: (newAllocs: XpactAllocation[]) => Promise<boolean>;
  onUpdateWorker?: (workerId: string, updates: Partial<Worker>) => Promise<boolean>;
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
  onSelectProject = async () => false,
  bureauAllocations = [],
  xpactAllocations = [],
  onUpdateBureauAllocations,
  onUpdateXpactAllocations,
  onUpdateWorker
}: AdminPanelProps) {
  
  // Navigation internal to Admin Settings panel
  const [activeSubTab, setActiveSubTab] = useState<"project" | "quotas" | "companies" | "dropdowns" | "users" | "gdrive" | "bureau_xpact" | "worker_audit" | "clear_data" | "interview_admin">("project");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleSystemReset = async () => {
    if (resetConfirmText !== "ERASE AND LIVE PORTAL") return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/clear-test-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("All test database profiles have been erased successfully. Portal is now running LIVE!");
        setResetConfirmText("");
        onRefresh(); // Refresh current page context & worker counts
        setActiveSubTab("project"); // Redirect to projects subtab
      } else {
        showError(data.message || "Failed to clear test data.");
      }
    } catch (e) {
      showError("Connection failed when resetting system.");
    } finally {
      setIsResetting(false);
    }
  };

  // Audit trail list and filter states
  const [auditSearch, setAuditSearch] = useState("");
  const [auditCompany, setAuditCompany] = useState("All");
  const [auditStateFilter, setAuditStateFilter] = useState("All");
  const [selectedAuditWorker, setSelectedAuditWorker] = useState<Worker | null>(null);

  // Sanken Overseas Assessment Entry - Admin States & Logic
  const [interviewSearch, setInterviewSearch] = useState("");
  const [interviewCompany, setInterviewCompany] = useState("All");
  const [interviewResult, setInterviewResult] = useState("All");

  const [editingInterviewId, setEditingInterviewId] = useState<string | null>(null);
  const [editInterviewerName, setEditInterviewerName] = useState("");
  const [editInterviewMarks, setEditInterviewMarks] = useState("");
  const [editInterviewStatus, setEditInterviewStatus] = useState<"Pass" | "Fail" | "Pending">("Pending");
  const [editTestRequired, setEditTestRequired] = useState(false);
  const [editRemarks, setEditRemarks] = useState("");
  const [isSavingInterview, setIsSavingInterview] = useState(false);

  const assessedWorkers = useMemo(() => {
    return workers.filter((w) => !!w.nic_number);
  }, [workers]);

  const filteredAssessedWorkers = useMemo(() => {
    return assessedWorkers.filter((w) => {
      const matchesSearch = 
        !interviewSearch ||
        (w.name && w.name.toLowerCase().includes(interviewSearch.toLowerCase())) ||
        (w.nic_number && w.nic_number.toLowerCase().includes(interviewSearch.toLowerCase())) ||
        (w.passport && w.passport.toLowerCase().includes(interviewSearch.toLowerCase())) ||
        (w.category && w.category.toLowerCase().includes(interviewSearch.toLowerCase()));

      const matchesCompany = 
        interviewCompany === "All" || 
        w.supply_company === interviewCompany;

      const matchesResult = 
        interviewResult === "All" || 
        (interviewResult === "Pending" && (!w.interview_status || w.interview_status === "Pending")) ||
        w.interview_status === interviewResult;

      return matchesSearch && matchesCompany && matchesResult;
    });
  }, [assessedWorkers, interviewSearch, interviewCompany, interviewResult]);

  const handleStartInterviewEdit = (w: Worker) => {
    setEditingInterviewId(w.id);
    setEditInterviewerName(w.interviewer_name || "");
    setEditInterviewMarks(w.interview_marks || "");
    setEditInterviewStatus((w.interview_status as "Pass" | "Fail" | "Pending") || "Pending");
    setEditTestRequired(w.test_required === "Yes");
    setEditRemarks(w.remarks || "");
  };

  const handleSaveInterviewEdit = async (workerId: string) => {
    if (!onUpdateWorker) return;
    setIsSavingInterview(true);
    try {
      const updates: Partial<Worker> = {
        interviewer_name: editInterviewerName.trim(),
        interview_marks: editInterviewMarks,
        interview_status: editInterviewStatus,
        test_required: editTestRequired ? "Yes" : "No",
        remarks: editRemarks.trim()
      };
      const ok = await onUpdateWorker(workerId, updates);
      if (ok) {
        showSuccess("Interview evaluation updated successfully.");
        setEditingInterviewId(null);
        onRefresh();
      } else {
        showError("Failed to update interview evaluation.");
      }
    } catch (err) {
      showError("Error updating interview record.");
    } finally {
      setIsSavingInterview(false);
    }
  };

  const handleDeleteInterviewData = async (workerId: string) => {
    if (!onUpdateWorker) return;
    if (!window.confirm("Are you sure you want to completely clear and reset the assessment details for this worker? This will set status back to Pending and empty marks/remarks.")) return;
    try {
      const updates: Partial<Worker> = {
        interviewer_name: "",
        interview_marks: "",
        interview_status: "Pending",
        test_required: "No",
        remarks: ""
      };
      const ok = await onUpdateWorker(workerId, updates);
      if (ok) {
        showSuccess("Assessment details reset to pending successfully.");
        onRefresh();
      } else {
        showError("Failed to reset assessment.");
      }
    } catch (err) {
      showError("Error resetting assessment record.");
    }
  };

  const [localBureau, setLocalBureau] = useState<BureauAllocation[]>([]);
  const [localXpact, setLocalXpact] = useState<XpactAllocation[]>([]);

  // Compute counts of workers per bureau category (case-insensitive) for visual quota bars
  const bureauAssignmentsCount = useMemo(() => {
    const counts: Record<string, number> = {};
    workers.forEach(w => {
      if (w.bureau_category) {
        const key = w.bureau_category.trim().toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [workers]);

  const [newBureauCategory, setNewBureauCategory] = useState("");
  const [newBureauQty, setNewBureauQty] = useState<string>("");
  const [newBureauRef, setNewBureauRef] = useState("");

  const [newXpactCategory, setNewXpactCategory] = useState("");
  const [newXpactQty, setNewXpactQty] = useState<string>("");
  const [newXpactRef, setNewXpactRef] = useState("");

  const [expandedBureauHistories, setExpandedBureauHistories] = useState<Record<string, boolean>>({});
  const [expandedXpactHistories, setExpandedXpactHistories] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (bureauAllocations) {
      setLocalBureau(bureauAllocations);
    }
  }, [bureauAllocations]);

  React.useEffect(() => {
    if (xpactAllocations) {
      setLocalXpact(xpactAllocations);
    }
  }, [xpactAllocations]);

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
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "project"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 inline mr-1.5" />
          PROJECT SETTINGS
        </button>

        <button
          onClick={() => setActiveSubTab("companies")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "companies"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 inline mr-1.5" />
          SUPPLY COMPANIES / VENDORS
        </button>

        <button
          onClick={() => setActiveSubTab("quotas")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "quotas"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Layers className="w-3.5 h-3.5 inline mr-1.5" />
          LABOR ALLOCATIONS
        </button>

        <button
          onClick={() => setActiveSubTab("dropdowns")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "dropdowns"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Tags className="w-3.5 h-3.5 inline mr-1.5" />
          DROPDOWN OPTIONS
        </button>

        <button
          onClick={() => setActiveSubTab("users")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "users"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users2 className="w-3.5 h-3.5 inline mr-1.5" />
          CREDENTIALS MANAGER
        </button>

        <button
          onClick={() => setActiveSubTab("gdrive")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "gdrive"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Cloud className="w-3.5 h-3.5 inline mr-1.5 text-emerald-500 animate-pulse" />
          GOOGLE DRIVE BACKUP
        </button>

        <button
          onClick={() => setActiveSubTab("bureau_xpact")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "bureau_xpact"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Sliders className="w-3.5 h-3.5 inline mr-1.5" />
          BUREAU & XPAT ALLOCATION
        </button>

        <button
          onClick={() => setActiveSubTab("worker_audit")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "worker_audit"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users2 className="w-3.5 h-3.5 inline mr-1.5" />
          WORKER AUDITS
        </button>

        <button
          onClick={() => setActiveSubTab("interview_admin")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "interview_admin"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Sliders className="w-3.5 h-3.5 inline mr-1.5" />
          INTERVIEW ENTRY ADMIN
        </button>

        <button
          onClick={() => setActiveSubTab("clear_data")}
          className={`px-4 py-2.5 text-[11px] font-sans uppercase tracking-widest border-b-2 font-bold whitespace-nowrap cursor-pointer transition-colors ${
            activeSubTab === "clear_data"
              ? "border-red-600 text-red-650"
              : "border-transparent text-muted hover:text-red-500"
          }`}
        >
          <Trash2 className="w-3.5 h-3.5 inline mr-1.5 text-red-500" />
          ERASE ALL TEST DATA
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
                  <thead className="bg-paper text-muted font-sans text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 w-12 text-center uppercase tracking-wider">Active</th>
                      <th className="p-2.5 uppercase tracking-wider">Project Details</th>
                      <th className="p-2.5 uppercase tracking-wider">Client & site</th>
                      <th className="p-2.5 text-right uppercase tracking-wider pr-4">Actions</th>
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

                  <form onSubmit={handleUpdateProject} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-sans text-stone-600 uppercase font-bold tracking-wider block">PROJECT NAME (TITLE) *</label>
                      <input
                        type="text"
                        value={projName}
                        onChange={(e) => setProjName(e.target.value)}
                        placeholder="e.g. Sanken Airport Terminal Expansion"
                        className="w-full bg-white border border-stone-350 rounded-md px-3 py-2 text-xs outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500 text-stone-900 transition-all font-sans"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-sans text-stone-600 uppercase font-bold tracking-wider block">CLIENT</label>
                        <input
                          type="text"
                          value={projClient}
                          onChange={(e) => setProjClient(e.target.value)}
                          placeholder="e.g. Malaysia Civil Aviation"
                          className="w-full bg-white border border-stone-350 rounded-md px-3 py-2 text-xs outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500 text-stone-900 transition-all font-sans"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-sans text-stone-600 uppercase font-bold tracking-wider block">CONTRACT #</label>
                        <input
                          type="text"
                          value={projContract}
                          onChange={(e) => setProjContract(e.target.value)}
                          placeholder="e.g. APT3-2026-SANKEN-0012"
                          className="w-full bg-white border border-stone-350 rounded-md px-3 py-2 text-xs outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500 text-stone-900 transition-all font-sans"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-sans text-stone-600 uppercase font-bold tracking-wider block">CORE SITE LOCATION</label>
                      <input
                        type="text"
                        value={projLocation}
                        onChange={(e) => setProjLocation(e.target.value)}
                        placeholder="e.g. KLIA Terminal 3 Outer Sector"
                        className="w-full bg-white border border-stone-350 rounded-md px-3 py-2 text-xs outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500 text-stone-900 transition-all font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-sans text-stone-600 uppercase font-bold tracking-wider block">SITE ENGINEER</label>
                        <input
                          type="text"
                          value={projEngineer}
                          onChange={(e) => setProjEngineer(e.target.value)}
                          placeholder="e.g. Ir. Tan"
                          className="w-full bg-white border border-stone-350 rounded-md px-3 py-2 text-xs outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500 text-stone-900 transition-all font-sans"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-sans text-stone-600 uppercase font-bold tracking-wider block">LEAD COORDINATOR</label>
                        <input
                          type="text"
                          value={projAdmin}
                          onChange={(e) => setProjAdmin(e.target.value)}
                          placeholder="e.g. Admin Coordinator"
                          className="w-full bg-white border border-stone-350 rounded-md px-3 py-2 text-xs outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500 text-stone-900 transition-all font-sans"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#1e1c3a] hover:bg-[#2b2851] text-[#fdfcf7] rounded text-xs font-sans font-bold uppercase tracking-widest transition-all duration-150 cursor-pointer shadow-md hover:shadow-lg mt-2 text-center"
                    >
                      SAVE/UPDATE PROJECT DETAILS
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
            <div className="bg-card border border-line rounded-xl p-5 shadow-sm flex flex-col gap-4 font-sans">
              <div className="space-y-1 pb-3 border-b border-line/50">
                <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-accent" />
                  Supply Vendor Wise Labor Allocations
                </h3>
                <p className="text-xs text-muted">
                  View and manage allocation quotas separate by Supply Vendor / Agency. Allocations limit worker approvals dynamically.
                </p>
              </div>

              <div className="space-y-2">
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
                                  <div className="flex flex-col gap-1.5 py-1">
                                    {/* Limits block statistics */}
                                    <div className="flex items-center justify-between gap-1 text-[11px]">
                                      <span className="font-mono text-ink font-semibold flex items-center gap-1">
                                        <Building2 className="w-3 h-3 text-stone-500" />
                                        <span>{limit} slots allotted</span>
                                      </span>
                                      
                                      {/* Color-coded remaining indicator */}
                                      {percent >= 100 ? (
                                        <span className="font-mono text-[9px] font-extrabold text-[#DC2626] bg-red-100/80 px-2 py-0.5 rounded border border-red-300 animate-pulse flex items-center gap-0.5">
                                          🔴 FULL / EXHAUSTED
                                        </span>
                                      ) : percent >= 85 ? (
                                        <span className="font-mono text-[9px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-0.5">
                                          ⚠️ NEAR LIMIT ({rem} open)
                                        </span>
                                      ) : percent >= 50 ? (
                                        <span className="font-mono text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 flex items-center gap-0.5">
                                          ⚡ MODERATE ({rem} open)
                                        </span>
                                      ) : (
                                        <span className="font-mono text-[9px] font-bold text-[#059669] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-250 flex items-center gap-0.5">
                                          ✓ STABLE ({rem} open)
                                        </span>
                                      )}
                                    </div>

                                    {/* Live occupancy progress bar */}
                                    <div className="w-full bg-paper rounded-full h-2.5 overflow-hidden border border-line/50 p-[1px]">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          percent >= 100 
                                            ? "bg-gradient-to-r from-red-500 to-red-700 animate-pulse" 
                                            : percent >= 85 
                                              ? "bg-gradient-to-r from-rose-500 to-rose-600" 
                                              : percent >= 50 
                                                ? "bg-gradient-to-r from-amber-400 to-amber-500" 
                                                : "bg-gradient-to-r from-emerald-400 to-emerald-500"
                                        }`}
                                        style={{ width: `${Math.min(100, percent)}%` }}
                                      ></div>
                                    </div>

                                    <div className="text-[9.5px] text-muted font-mono flex justify-between px-0.5">
                                      <span className="font-medium text-stone-500">Occupied: <strong className="text-stone-800">{activeCount}</strong>/{limit} used</span>
                                      <span className={`font-bold ${
                                        percent >= 100 ? "text-red-650" : percent >= 85 ? "text-rose-600" : percent >= 50 ? "text-amber-600" : "text-emerald-600"
                                      }`}>{percent.toFixed(0)}%</span>
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

                {/* Nationalities */}
                <div className="border border-line rounded-xl p-3 bg-paper/20">
                  <h4 className="font-mono text-[10px] text-muted uppercase border-b border-line pb-1 mb-2">Nationalities Options</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {dropdownOptions.filter(d => d.field === "nationality").map(opt => (
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
                    <option value="nationality">Nationality</option>
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

        {/* SUB 6: BUREAU & XPAT ALLOCATION */}
        {activeSubTab === "bureau_xpact" && (
          <div className="space-y-6 animate-fade-in font-sans">
            
            {/* Top Info Header */}
            <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-1.5">
              <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-accent" />
                <span>Bureau & XPACT Allocation Center</span>
              </h3>
              <p className="text-xs text-muted">
                Manage allocation quotas and quantity requirements for both Bureau alignments and XPACT categories. Quantities can be added time to time under the same category, appending historical reference numbers and addition dates without creating redundant rows.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* TABLE 1: Bureau Allocation */}
              <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-line/60">
                  <div>
                    <h4 className="text-sm font-bold text-ink font-display">Bureau Allocation</h4>
                    <p className="text-[11px] text-muted">Set targets or quotas for Bureau processing categories.</p>
                  </div>
                </div>

                {/* Table display */}
                <div className="overflow-x-auto min-h-[150px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-line text-muted font-mono uppercase text-[10px] tracking-wider font-semibold">
                        <th className="py-2 w-8 text-center"></th>
                        <th className="py-2 text-[10px]">Bureau Category</th>
                        <th className="py-2 w-20 text-right text-[10px]">Total Qty</th>
                        <th className="py-2 text-left text-[10px] pl-4 w-44">Live Occupancy</th>
                        <th className="py-2 w-24 text-center text-[10px]">Last Ref No</th>
                        <th className="py-2 text-center w-28 text-[10px]">Saved Date</th>
                        <th className="py-2 text-right w-12 text-[10px]">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localBureau.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted text-xs italic">
                            No Bureau Allocation categories defined yet. Use the tool below to add.
                          </td>
                        </tr>
                      ) : (
                        localBureau.map((item, index) => {
                          const hasHistory = item.additions && item.additions.length > 0;
                          const isExpanded = !!expandedBureauHistories[item.id];
                          
                          // Utilization stats
                          const used = bureauAssignmentsCount[item.category.trim().toLowerCase()] || 0;
                          const limit = item.qty || 0;
                          const pct = limit > 0 ? (used / limit) * 100 : 0;
                          const remaining = Math.max(0, limit - used);

                          return (
                            <React.Fragment key={item.id || index}>
                              <tr className="border-b border-line/50 hover:bg-paper/30">
                                <td className="py-2.5 text-center">
                                  {hasHistory ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedBureauHistories(prev => ({
                                          ...prev,
                                          [item.id]: !prev[item.id]
                                        }));
                                      }}
                                      className="p-1 text-muted hover:text-accent hover:bg-paper rounded transition-all cursor-pointer focus:outline-none"
                                      title="Show additions history"
                                    >
                                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90 text-accent" : "rotate-0"}`} />
                                    </button>
                                  ) : (
                                    <span className="inline-block w-3.5 h-3.5" />
                                  )}
                                </td>
                                <td className="py-2.5 font-medium text-ink">
                                  <span className="px-1 py-0.5 text-xs font-semibold text-slate-800">
                                    {item.category}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right font-mono font-semibold text-ink">
                                  <input
                                    type="number"
                                    value={item.qty === 0 ? "" : item.qty}
                                    onChange={(e) => {
                                      const updated = [...localBureau];
                                      const val = parseInt(e.target.value);
                                      const newQty = isNaN(val) ? 0 : val;
                                      updated[index].qty = newQty;
                                      setLocalBureau(updated);
                                    }}
                                    className="bg-transparent border border-line/45 focus:border-accent text-right w-16 outline-none focus:bg-paper px-1.5 py-0.5 rounded text-xs font-mono"
                                    placeholder="Qty"
                                    min="0"
                                  />
                                </td>
                                
                                {/* LIVE OCCUPANCY COLUMN */}
                                <td className="py-2.5 pl-4 pr-2">
                                  <div className="flex flex-col gap-1 min-w-[130px]">
                                    <div className="flex justify-between items-center text-[10px] font-mono leading-none">
                                      <span className="font-bold text-stone-700">{used}/{limit} used</span>
                                      {pct >= 100 ? (
                                        <span className="text-[9px] font-bold text-red-650 bg-red-50 px-1 py-0.2 rounded border border-red-250 animate-pulse">🔴 FULL</span>
                                      ) : pct >= 85 ? (
                                        <span className="text-[9px] font-bold text-rose-650 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">⚠️ OVER 85%</span>
                                      ) : pct >= 50 ? (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">⚡ HALF USED</span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">🟢 STABLE</span>
                                      )}
                                    </div>
                                    <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden border border-line/40">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          pct >= 100 
                                            ? "bg-red-500 animate-pulse" 
                                            : pct >= 85 
                                              ? "bg-rose-500" 
                                              : pct >= 50 
                                                ? "bg-amber-400" 
                                                : "bg-[#10B981]"
                                        }`}
                                        style={{ width: `${Math.min(100, pct)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 text-center font-mono text-[11px] text-ink">
                                  {item.ref_no || "—"}
                                </td>
                                <td className="py-2.5 text-center text-[10px] text-muted font-mono">
                                  {item.last_updated || "—"}
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = localBureau.filter((_, i) => i !== index);
                                      setLocalBureau(updated);
                                    }}
                                    className="text-muted hover:text-bad p-1 transition-colors rounded hover:bg-red-50 cursor-pointer inline-flex"
                                    title="Remove row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && hasHistory && (
                                <tr>
                                  <td colSpan={7} className="py-2 px-3 border-b border-line/40 rounded-lg bg-paper/20">
                                    <div className="pl-6 pr-4 py-1.5 space-y-1.5">
                                      <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
                                        <span>Additions Registry History:</span>
                                      </div>
                                      <div className="border border-line/40 rounded-lg overflow-hidden bg-white max-h-36 overflow-y-auto">
                                        <table className="w-full text-left text-[11px]">
                                          <thead>
                                            <tr className="bg-paper/85 text-[9px] font-mono uppercase tracking-wider text-muted border-b border-line/40">
                                              <th className="py-1 px-3">Date Added</th>
                                              <th className="py-1 px-3 text-right">Qty Added</th>
                                              <th className="py-1 px-3 text-right">Ref Number</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {item.additions!.map((add, ai) => (
                                              <tr key={ai} className="border-b border-line/20 last:border-b-0 hover:bg-paper/10">
                                                <td className="py-1 px-3 text-muted font-mono">{add.date}</td>
                                                <td className="py-1 px-3 text-right text-success-green font-bold font-mono">+{add.qty}</td>
                                                <td className="py-1 px-3 text-right font-mono text-ink">{add.ref_no || "N/A"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Inline adder form */}
                <div className="bg-paper p-3 border border-line/60 rounded-xl space-y-3">
                  <h5 className="text-[10px] font-bold text-muted uppercase tracking-wider">Add or Top-Up Bureau Allocation</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Category Name</label>
                      <select
                        value={newBureauCategory}
                        onChange={(e) => setNewBureauCategory(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      >
                        <option value="">-- Select labor category --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Adding Qty</label>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={newBureauQty}
                        onChange={(e) => setNewBureauQty(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink font-mono"
                        min="1"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Reference Number</label>
                      <input
                        type="text"
                        placeholder="e.g. Ref No / Code"
                        value={newBureauRef}
                        onChange={(e) => setNewBureauRef(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newBureauCategory.trim()) {
                        showError("Please select a category name");
                        return;
                      }
                      const numQty = parseInt(newBureauQty) || 0;
                      if (numQty <= 0) {
                        showError("Please enter a valid quantity greater than zero");
                        return;
                      }

                      const trimmedCat = newBureauCategory.trim();
                      const currentRef = newBureauRef.trim() || `REF-${Math.floor(1000 + Math.random() * 9000)}`;
                      const nowStr = new Date().toLocaleString();

                      const existingIndex = localBureau.findIndex(
                        b => b.category.trim().toLowerCase() === trimmedCat.toLowerCase()
                      );

                      if (existingIndex !== -1) {
                        const updated = [...localBureau];
                        const target = { ...updated[existingIndex] };
                        target.qty = (target.qty || 0) + numQty;
                        target.last_updated = nowStr;
                        target.ref_no = currentRef;
                        
                        if (!target.additions) target.additions = [];
                        target.additions = [
                          { qty: numQty, date: nowStr, ref_no: currentRef },
                          ...target.additions
                        ];
                        
                        updated[existingIndex] = target;
                        setLocalBureau(updated);

                        setNewBureauCategory("");
                        setNewBureauQty("");
                        setNewBureauRef("");
                        showSuccess(`Increased Bureau allocation for "${trimmedCat}" by ${numQty} under Ref: ${currentRef}!`);
                      } else {
                        const newRow: BureauAllocation = {
                          id: "bureau-" + Date.now() + Math.random().toString(36).substr(2, 4),
                          category: trimmedCat,
                          qty: numQty,
                          last_updated: nowStr,
                          ref_no: currentRef,
                          additions: [
                            { qty: numQty, date: nowStr, ref_no: currentRef }
                          ]
                        };
                        setLocalBureau([...localBureau, newRow]);

                        setNewBureauCategory("");
                        setNewBureauQty("");
                        setNewBureauRef("");
                        showSuccess(`Added Bureau Category "${trimmedCat}" with quantity ${numQty} and Ref: ${currentRef}!`);
                      }
                    }}
                    className="w-full py-1.5 border border-line hover:border-accent hover:bg-accent/5 hover:text-accent font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Apply / Add Quantity Locally
                  </button>
                </div>

                {/* Save section */}
                <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-4">
                  <div className="text-[10px] text-muted leading-relaxed">
                    Time to time additions accumulate inside the existing category. Always hit Save to commit to the server!
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const success = await onUpdateBureauAllocations(localBureau);
                      if (success) {
                        showSuccess("Bureau allocations saved successfully with all reference logs intact!");
                      } else {
                        showError("Failed to save Bureau allocations.");
                      }
                    }}
                    className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider font-bold transition-colors cursor-pointer shadow-sm shrink-0"
                  >
                    Save Bureau Allocations
                  </button>
                </div>
              </div>

              {/* TABLE 2: XPACT QUTA Allocation */}
              <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-line/60">
                  <div>
                    <h4 className="text-sm font-bold text-ink font-display">XPACT QUTA Allocation</h4>
                    <p className="text-[11px] text-muted">Manage allocations and targets for XPACT categories.</p>
                  </div>
                </div>

                {/* Table display */}
                <div className="overflow-x-auto min-h-[150px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-line text-muted font-mono uppercase text-[10px] tracking-wider font-semibold">
                        <th className="py-2 w-8 text-center"></th>
                        <th className="py-2 text-[10px]">XPACT Category</th>
                        <th className="py-2 w-20 text-right text-[10px]">Total Qty</th>
                        <th className="py-2 text-left text-[10px] pl-4 w-44">Live Occupancy</th>
                        <th className="py-2 w-24 text-center text-[10px]">Last Ref No</th>
                        <th className="py-2 text-center w-28 text-[10px]">Saved Date</th>
                        <th className="py-2 text-right w-12 text-[10px]">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localXpact.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted text-xs italic">
                            No XPACT Quota Allocation categories defined yet. Use the tool below to add.
                          </td>
                        </tr>
                      ) : (
                        localXpact.map((item, index) => {
                          const hasHistory = item.additions && item.additions.length > 0;
                          const isExpanded = !!expandedXpactHistories[item.id];
                          
                          // Utilization stats
                          const used = bureauAssignmentsCount[item.category.trim().toLowerCase()] || 0;
                          const limit = item.qty || 0;
                          const pct = limit > 0 ? (used / limit) * 100 : 0;
                          const remaining = Math.max(0, limit - used);

                          return (
                            <React.Fragment key={item.id || index}>
                              <tr className="border-b border-line/50 hover:bg-paper/30">
                                <td className="py-2.5 text-center">
                                  {hasHistory ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedXpactHistories(prev => ({
                                          ...prev,
                                          [item.id]: !prev[item.id]
                                        }));
                                      }}
                                      className="p-1 text-muted hover:text-accent hover:bg-paper rounded transition-all cursor-pointer focus:outline-none"
                                      title="Show additions history"
                                    >
                                      <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90 text-accent" : "rotate-0"}`} />
                                    </button>
                                  ) : (
                                    <span className="inline-block w-3.5 h-3.5" />
                                  )}
                                </td>
                                <td className="py-2.5 font-medium text-ink">
                                  <span className="px-1 py-0.5 text-xs font-semibold text-slate-800">
                                    {item.category}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right font-mono font-semibold text-ink">
                                  <input
                                    type="number"
                                    value={item.qty === 0 ? "" : item.qty}
                                    onChange={(e) => {
                                      const updated = [...localXpact];
                                      const val = parseInt(e.target.value);
                                      updated[index].qty = isNaN(val) ? 0 : val;
                                      setLocalXpact(updated);
                                    }}
                                    className="bg-transparent border border-line/45 focus:border-accent text-right w-16 outline-none focus:bg-paper px-1.5 py-0.5 rounded text-xs font-mono"
                                    placeholder="Qty"
                                    min="0"
                                  />
                                </td>

                                {/* LIVE OCCUPANCY COLUMN */}
                                <td className="py-2.5 pl-4 pr-2">
                                  <div className="flex flex-col gap-1 min-w-[130px]">
                                    <div className="flex justify-between items-center text-[10px] font-mono leading-none">
                                      <span className="font-bold text-stone-700">{used}/{limit} used</span>
                                      {pct >= 100 ? (
                                        <span className="text-[9px] font-bold text-red-650 bg-red-50 px-1 py-0.2 rounded border border-red-250 animate-pulse">🔴 FULL</span>
                                      ) : pct >= 85 ? (
                                        <span className="text-[9px] font-bold text-rose-650 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">⚠️ OVER 85%</span>
                                      ) : pct >= 50 ? (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">⚡ HALF USED</span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">🟢 STABLE</span>
                                      )}
                                    </div>
                                    <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden border border-line/40">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          pct >= 100 
                                            ? "bg-red-500 animate-pulse" 
                                            : pct >= 85 
                                              ? "bg-rose-500" 
                                              : pct >= 50 
                                                ? "bg-amber-400" 
                                                : "bg-[#10B981]"
                                        }`}
                                        style={{ width: `${Math.min(100, pct)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 text-center font-mono text-[11px] text-ink">
                                  {item.ref_no || "—"}
                                </td>
                                <td className="py-2.5 text-center text-[10px] text-muted font-mono">
                                  {item.last_updated || "—"}
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = localXpact.filter((_, i) => i !== index);
                                      setLocalXpact(updated);
                                    }}
                                    className="text-muted hover:text-bad p-1 transition-colors rounded hover:bg-red-50 cursor-pointer inline-flex"
                                    title="Remove row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && hasHistory && (
                                <tr className="bg-paper/20">
                                  <td colSpan={7} className="py-2 px-3 border-b border-line/40 rounded-lg">
                                    <div className="pl-6 pr-4 py-1.5 space-y-1.5">
                                      <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase tracking-wider font-bold">
                                        <span>Additions Registry History:</span>
                                      </div>
                                      <div className="border border-line/40 rounded-lg overflow-hidden bg-white max-h-36 overflow-y-auto">
                                        <table className="w-full text-left text-[11px]">
                                          <thead>
                                            <tr className="bg-paper/85 text-[9px] font-mono uppercase tracking-wider text-muted border-b border-line/40">
                                              <th className="py-1 px-3">Date Added</th>
                                              <th className="py-1 px-3 text-right">Qty Added</th>
                                              <th className="py-1 px-3 text-right">Ref Number</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {item.additions!.map((add, ai) => (
                                              <tr key={ai} className="border-b border-line/20 last:border-b-0 hover:bg-paper/10">
                                                <td className="py-1 px-3 text-muted font-mono">{add.date}</td>
                                                <td className="py-1 px-3 text-right text-success-green font-bold font-mono">+{add.qty}</td>
                                                <td className="py-1 px-3 text-right font-mono text-ink">{add.ref_no || "N/A"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Inline adder form */}
                <div className="bg-paper p-3 border border-line/60 rounded-xl space-y-3">
                  <h5 className="text-[10px] font-bold text-muted uppercase tracking-wider">Add or Top-Up XPACT Quota</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Category Name</label>
                      <select
                        value={newXpactCategory}
                        onChange={(e) => setNewXpactCategory(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink"
                      >
                        <option value="">-- Select labor category --</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Adding Qty</label>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={newXpactQty}
                        onChange={(e) => setNewXpactQty(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink font-mono"
                        min="1"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Reference Number</label>
                      <input
                        type="text"
                        placeholder="e.g. Ref No / Code"
                        value={newXpactRef}
                        onChange={(e) => setNewXpactRef(e.target.value)}
                        className="w-full bg-card border border-line rounded px-2.5 py-1.5 text-xs outline-none focus:border-accent text-ink font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newXpactCategory.trim()) {
                        showError("Please select a category name");
                        return;
                      }
                      const numQty = parseInt(newXpactQty) || 0;
                      if (numQty <= 0) {
                        showError("Please enter a valid quantity greater than zero");
                        return;
                      }

                      const trimmedCat = newXpactCategory.trim();
                      const currentRef = newXpactRef.trim() || `REF-${Math.floor(1000 + Math.random() * 9000)}`;
                      const nowStr = new Date().toLocaleString();

                      const existingIndex = localXpact.findIndex(
                        x => x.category.trim().toLowerCase() === trimmedCat.toLowerCase()
                      );

                      if (existingIndex !== -1) {
                        const updated = [...localXpact];
                        const target = { ...updated[existingIndex] };
                        target.qty = (target.qty || 0) + numQty;
                        target.last_updated = nowStr;
                        target.ref_no = currentRef;
                        
                        if (!target.additions) target.additions = [];
                        target.additions = [
                          { qty: numQty, date: nowStr, ref_no: currentRef },
                          ...target.additions
                        ];
                        
                        updated[existingIndex] = target;
                        setLocalXpact(updated);

                        setNewXpactCategory("");
                        setNewXpactQty("");
                        setNewXpactRef("");
                        showSuccess(`Increased XPACT allocation for "${trimmedCat}" by ${numQty} under Ref: ${currentRef}!`);
                      } else {
                        const newRow: XpactAllocation = {
                          id: "xpact-" + Date.now() + Math.random().toString(36).substr(2, 4),
                          category: trimmedCat,
                          qty: numQty,
                          last_updated: nowStr,
                          ref_no: currentRef,
                          additions: [
                            { qty: numQty, date: nowStr, ref_no: currentRef }
                          ]
                        };
                        setLocalXpact([...localXpact, newRow]);

                        setNewXpactCategory("");
                        setNewXpactQty("");
                        setNewXpactRef("");
                        showSuccess(`Added XPACT Category "${trimmedCat}" with quantity ${numQty} and Ref: ${currentRef}!`);
                      }
                    }}
                    className="w-full py-1.5 border border-line hover:border-accent hover:bg-accent/5 hover:text-accent font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Apply / Add Quantity Locally
                  </button>
                </div>

                {/* Save section */}
                <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-4">
                  <div className="text-[10px] text-muted">
                    Save updates to record reference additions instantly.
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const success = await onUpdateXpactAllocations(localXpact);
                      if (success) {
                        showSuccess("XPACT allocations saved successfully with all logs!");
                      } else {
                        showError("Failed to save XPACT allocations.");
                      }
                    }}
                    className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-mono uppercase tracking-wider font-bold transition-colors cursor-pointer shadow-sm shrink-0"
                  >
                    Save XPACT Allocations
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* SUB 7: WORKER AUDIT TRAIL */}
        {activeSubTab === "worker_audit" && (() => {
          // Helper: Parse Date Safely
          const parseToDate = (dateStr?: string) => {
            if (!dateStr) return new Date(0);
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              return new Date(`${dateStr}T00:00:00`);
            }
            return new Date(dateStr);
          };

          // Helper: Format Date Safely
          const formatAuditDate = (dateStr?: string) => {
            if (!dateStr) return "—";
            try {
              const d = parseToDate(dateStr);
              if (d.getTime() === 0) return "—";
              if (dateStr.includes("T") && dateStr.includes(":")) {
                return d.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }
              return d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              });
            } catch (e) {
              return dateStr;
            }
          };

          // Event type definition
          interface AuditEvent {
            title: string;
            date: string;
            status: "success" | "danger" | "warning" | "info" | "neutral";
            description: string;
            reason?: string;
            actor: string;
            icon: "UserPlus" | "UploadCloud" | "CheckCircle2" | "XCircle" | "RefreshCw" | "LockOpen" | "AlertTriangle" | "FileText" | "Hourglass" | "BadgeCheck" | "Plane";
          }

          // Helper: Build Chronological Audit Trail
          const getWorkerAuditTrail = (w: Worker): AuditEvent[] => {
            const events: AuditEvent[] = [];

            // 1. Profile Creation
            if (w.created_at) {
              events.push({
                title: "Candidate Profile Registered",
                date: w.created_at,
                status: "info",
                description: `Worker candidate profile created under job category "${w.category}" by recruiting agency.`,
                actor: w.supply_company,
                icon: "UserPlus"
              });
            }

            // 2. Admin 2 / Ops Submission & Verification
            if (w.admin2_submit_date) {
              events.push({
                title: "Documents Submitted to Admin 2",
                date: w.admin2_submit_date,
                status: "neutral",
                description: "Documents and WhatsApp uploads submitted for verification.",
                actor: w.supply_company,
                icon: "UploadCloud"
              });
            }

            if (w.doc_upload_wa === "Yes" && w.doc_upload_wa_date) {
              events.push({
                title: "Ops Document Verification Approved",
                date: w.doc_upload_wa_date || w.admin2_submit_date,
                status: "success",
                description: "Admin 2 verified all candidate credentials and passport scans successfully.",
                actor: "Operations Admin",
                icon: "CheckCircle2"
              });
            }

            // 3. Admin 2 / Ops Rejection
            if (w.doc_upload_wa === "Rejected" || w.admin2_reject_date) {
              events.push({
                title: "Ops Document Verification Rejected",
                date: w.admin2_reject_date || w.doc_upload_wa_date || w.last_updated,
                status: "danger",
                description: "Admin 2 rejected candidate's document uploads.",
                reason: w.wa_doc_reject_reason || "Documents failed validation checks.",
                actor: "Operations Admin",
                icon: "XCircle"
              });
            }

            // 4. Recruiter Resubmission
            if (w.admin2_resubmit_date) {
              events.push({
                title: "Documents Resubmitted by Recruiter",
                date: w.admin2_resubmit_date,
                status: "warning",
                description: "Recruiter resubmitted updated details and files for verification.",
                actor: w.supply_company,
                icon: "RefreshCw"
              });
            }

            // 5. Site Engineer Approvals
            if (w.state === "active" && (w.visa_doc_date || w.last_updated)) {
              events.push({
                title: "Engineer Gate Approval",
                date: w.visa_doc_date || w.last_updated,
                status: "success",
                description: `Approved by Ir. Tan. Candidate state activated. Assigned sending batch: ${w.sending_batch || "Not assigned"}.`,
                actor: "Site Engineer",
                icon: "LockOpen"
              });
            } else if (w.state === "rejected" && w.last_updated) {
              events.push({
                title: "Engineer Gate Rejection",
                date: w.last_updated,
                status: "danger",
                description: "Candidate rejected at the site engineering gate review.",
                reason: w.gate_reject_reason || "Qualifications/documents did not meet project requirements.",
                actor: "Site Engineer",
                icon: "XCircle"
              });
            } else if (w.state === "held" && w.last_updated) {
              events.push({
                title: "Candidate Placed on Hold",
                date: w.last_updated,
                status: "warning",
                description: "Engineer placed candidate review process on Hold.",
                actor: "Site Engineer",
                icon: "AlertTriangle"
              });
            }

            // 6. Visa Status Updates
            if (w.status && w.status !== "Pending") {
              const isApproved = w.status.toLowerCase().includes("approved");
              const isReject = w.status.toLowerCase().includes("reject") || w.status.toLowerCase().includes("fail");
              events.push({
                title: `Visa Status: ${w.status}`,
                date: w.status_date || w.last_updated,
                status: isApproved ? "success" : isReject ? "danger" : "info",
                description: `Visa processing stage updated to "${w.status}".`,
                actor: "Operations Admin",
                icon: "FileText"
              });
            }

            // 7. Bureau Clearance
            if (w.bureau_pending_at) {
              events.push({
                title: "Entered Bureau Clearance Queue",
                date: w.bureau_pending_at,
                status: "info",
                description: "Bureau clearance processing initiated automatically.",
                actor: "System Pipeline",
                icon: "Hourglass"
              });
            }

            if (w.bureau === "Complete") {
              events.push({
                title: "Bureau Clearance Completed",
                date: w.bureau_completed_at || w.bureau_date || w.last_updated,
                status: "success",
                description: "Bureau security clearance check passed successfully.",
                actor: "Operations Admin",
                icon: "BadgeCheck"
              });
            } else if (w.bureau === "Reject") {
              events.push({
                title: "Bureau Clearance Rejected",
                date: w.bureau_date || w.last_updated,
                status: "danger",
                description: "Bureau clearance failed or was rejected.",
                actor: "Operations Admin",
                icon: "XCircle"
              });
            }

            // 8. Final Placement Status
            if (w.final_status && w.final_status !== "Pending") {
              const isArrived = w.final_status === "Arrived";
              const isBooked = w.final_status === "Booked";
              events.push({
                title: `Final Placement: ${w.final_status}`,
                date: w.final_status_date || w.last_updated,
                status: isArrived ? "success" : isBooked ? "info" : "warning",
                description: `Final mobilization status updated to "${w.final_status}".`,
                actor: "Operations Admin",
                icon: "Plane"
              });
            }

            // Sort chronologically
            return events.sort((a, b) => parseToDate(a.date).getTime() - parseToDate(b.date).getTime());
          };

          // Filter workers based on states
          const filteredWorkers = workers.filter((w) => {
            const matchesSearch = 
              !auditSearch.trim() ||
              w.name.toLowerCase().includes(auditSearch.toLowerCase()) ||
              w.passport.toLowerCase().includes(auditSearch.toLowerCase()) ||
              w.category.toLowerCase().includes(auditSearch.toLowerCase()) ||
              (w.sending_batch && w.sending_batch.toLowerCase().includes(auditSearch.toLowerCase()));

            const matchesCompany = auditCompany === "All" || w.supply_company === auditCompany;
            const matchesState = auditStateFilter === "All" || w.state === auditStateFilter;

            return matchesSearch && matchesCompany && matchesState;
          });

          return (
            <div className="space-y-6 animate-fade-in font-sans">
              
              {/* Header / Filter bar */}
              <div className="bg-card border border-line rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-line/50">
                  <div>
                    <h3 className="text-sm font-semibold text-ink font-display flex items-center gap-1.5">
                      <Users2 className="w-4 h-4 text-accent" />
                      Worker Lifecycle Audits & Records
                    </h3>
                    <p className="text-xs text-muted">
                      Audit all candidate transitions, rejections, submissions, and resubmissions across the pipeline.
                    </p>
                  </div>
                  <span className="text-[10px] text-muted font-mono bg-paper border border-line/60 px-2.5 py-1 rounded-md">
                    Total Workers: <strong className="font-semibold text-accent">{workers.length}</strong>
                  </span>
                </div>

                {/* Filters grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Search Bar */}
                  <div className="md:col-span-6 relative">
                    <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search worker by name, passport, category, batch..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="w-full bg-paper/25 border border-line focus:border-accent rounded-lg pl-9 pr-4 py-2 text-xs outline-none text-ink font-sans transition-all"
                    />
                  </div>

                  {/* Company Select */}
                  <div className="md:col-span-3">
                    <select
                      value={auditCompany}
                      onChange={(e) => setAuditCompany(e.target.value)}
                      className="w-full bg-paper/25 border border-line focus:border-accent rounded-lg px-3 py-2 text-xs outline-none text-ink font-sans transition-all cursor-pointer"
                    >
                      <option value="All">All Supply Companies</option>
                      {companies.map((co) => (
                        <option key={co.id} value={co.name}>
                          {co.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* State Select */}
                  <div className="md:col-span-3">
                    <select
                      value={auditStateFilter}
                      onChange={(e) => setAuditStateFilter(e.target.value)}
                      className="w-full bg-paper/25 border border-line focus:border-accent rounded-lg px-3 py-2 text-xs outline-none text-ink font-sans transition-all cursor-pointer"
                    >
                      <option value="All">All Lifecycle States</option>
                      <option value="pending">Pending</option>
                      <option value="active">Active (Approved)</option>
                      <option value="rejected">Rejected Gate</option>
                      <option value="held">On Hold</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Workers table results */}
              <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs bg-card border-collapse">
                    <thead className="bg-paper text-muted font-mono text-[9px] uppercase tracking-wider border-b border-line">
                      <tr>
                        <th className="p-3.5 pl-5">Worker Name</th>
                        <th className="p-3.5">Passport</th>
                        <th className="p-3.5">Supply Agency</th>
                        <th className="p-3.5">Job Category</th>
                        <th className="p-3.5">State Status</th>
                        <th className="p-3.5 text-center">Admin 2 WA</th>
                        <th className="p-3.5 text-right pr-6 w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/45">
                      {filteredWorkers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-muted text-xs italic">
                            No matching workers found for the current search and filter settings.
                          </td>
                        </tr>
                      ) : (
                        filteredWorkers.map((w) => {
                          const trail = getWorkerAuditTrail(w);
                          return (
                            <tr key={w.id} className="hover:bg-paper/10 transition-colors">
                              <td className="p-3.5 pl-5 font-semibold text-stone-900 font-sans">
                                {w.name}
                              </td>
                              <td className="p-3.5 font-mono font-medium text-stone-600">
                                {w.passport}
                              </td>
                              <td className="p-3.5 text-stone-600 font-sans">
                                {w.supply_company}
                              </td>
                              <td className="p-3.5 text-stone-600 font-sans">
                                {w.category}
                              </td>
                              <td className="p-3.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                  w.state === "active" 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                    : w.state === "rejected"
                                    ? "bg-red-50 text-[#A30000] border-red-200"
                                    : w.state === "held"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-stone-50 text-stone-600 border-stone-200"
                                }`}>
                                  {w.state.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                  w.doc_upload_wa === "Yes" 
                                    ? "bg-green-50 text-success-green border border-success-green/20" 
                                    : w.doc_upload_wa === "Rejected"
                                    ? "bg-red-50 text-[#A30000] border border-red-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                                }`}>
                                  {w.doc_upload_wa}
                                </span>
                              </td>
                              <td className="p-3.5 text-right pr-6 whitespace-nowrap">
                                <button
                                  onClick={() => setSelectedAuditWorker(w)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-950 hover:bg-stone-800 text-white rounded text-[11px] font-semibold cursor-pointer shadow-2xs hover:shadow-xs transition-all"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Audit Trail</span>
                                  {trail.length > 0 && (
                                    <span className="ml-0.5 px-1 bg-white/20 text-white rounded text-[9px] font-bold">
                                      {trail.length}
                                    </span>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dynamic Overlay Side Panel for Worker Trail */}
              {selectedAuditWorker && (() => {
                const trail = getWorkerAuditTrail(selectedAuditWorker);
                return (
                  <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/35 backdrop-blur-xs animate-fade-in font-sans">
                    {/* Background veil click handler */}
                    <div className="absolute inset-0" onClick={() => setSelectedAuditWorker(null)} />
                    
                    {/* Drawer container */}
                    <div className="relative w-full max-w-lg bg-[#FAF9F5] border-l border-line h-full shadow-2xl flex flex-col animate-slide-in overflow-hidden">
                      {/* Drawer Header */}
                      <div className="p-5 border-b border-line bg-white flex items-center justify-between select-none">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider font-bold text-accent font-mono bg-accent/10 px-2 py-0.5 rounded-md">Candidate Lifecycle Audit Trail</span>
                          <h3 className="text-base font-semibold text-stone-900 font-display mt-1">
                            {selectedAuditWorker.name}
                          </h3>
                          <p className="text-xs text-stone-500 font-mono mt-0.5">
                            Passport: <span className="text-stone-700 font-bold">{selectedAuditWorker.passport}</span> | Category: <span className="text-stone-700 font-bold">{selectedAuditWorker.category}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedAuditWorker(null)}
                          className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Scrollable Timeline */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Status Summary Card */}
                        <div className="bg-white border border-stone-250/70 rounded-xl p-4 shadow-2xs space-y-2.5">
                          <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-mono">Current Lifecycle Status</h4>
                          <div className="grid grid-cols-2 gap-3.5 text-xs">
                            <div>
                              <span className="text-stone-400 block text-[9px] font-mono font-bold">INTAKE AGENCY:</span>
                              <span className="font-semibold text-stone-800">{selectedAuditWorker.supply_company}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[9px] font-mono font-bold">BATCH NUMBER:</span>
                              <span className="font-semibold text-stone-800 font-mono">{selectedAuditWorker.sending_batch || "—"}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[9px] font-mono font-bold">DOCUMENT STATUS:</span>
                              <span className={`font-bold inline-flex items-center gap-1 ${
                                selectedAuditWorker.doc_upload_wa === "Yes" ? "text-success-green" : 
                                selectedAuditWorker.doc_upload_wa === "Rejected" ? "text-[#A30000]" : "text-amber-600 animate-pulse"
                              }`}>
                                {selectedAuditWorker.doc_upload_wa === "Yes" ? "✓ Verified" : 
                                 selectedAuditWorker.doc_upload_wa === "Rejected" ? "✗ Rejected" : "⏳ Pending"}
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 block text-[9px] font-mono font-bold">ENGINEER GATEWAY:</span>
                              <span className={`font-bold ${
                                selectedAuditWorker.state === "active" ? "text-success-green" : 
                                selectedAuditWorker.state === "rejected" ? "text-[#A30000]" : 
                                selectedAuditWorker.state === "held" ? "text-amber-500" : "text-stone-500"
                              }`}>
                                {selectedAuditWorker.state === "active" ? "✓ Approved" : 
                                 selectedAuditWorker.state === "rejected" ? "✗ Rejected" : 
                                 selectedAuditWorker.state === "held" ? "⏳ Held" : "Pending Queue"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Audit Trail List */}
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-mono">Chronological History ({trail.length} transitions)</h4>
                          
                          <div className="relative pl-6 border-l-2 border-stone-200/80 space-y-6 ml-3 mt-4">
                            {trail.map((event, index) => {
                              // Dynamically mapped icons
                              let iconBgClass = "bg-stone-50 text-stone-500 border-stone-200";
                              let titleColorClass = "text-stone-800";
                              
                              if (event.status === "success") {
                                iconBgClass = "bg-green-50 text-success-green border-green-200";
                              } else if (event.status === "danger") {
                                iconBgClass = "bg-red-50 text-[#A30000] border-red-200";
                                titleColorClass = "text-[#A30000]";
                              } else if (event.status === "warning") {
                                iconBgClass = "bg-amber-50 text-amber-600 border-amber-200";
                              } else if (event.status === "info") {
                                iconBgClass = "bg-blue-50 text-blue-600 border-blue-200";
                              }

                              return (
                                <div key={index} className="relative animate-fade-in text-left">
                                  {/* Node indicator */}
                                  <span className={`absolute -left-[37px] top-0.5 w-7 h-7 rounded-full border flex items-center justify-center shadow-2xs ${iconBgClass}`}>
                                    {event.icon === "UserPlus" && <UserPlus className="w-3.5 h-3.5" />}
                                    {event.icon === "UploadCloud" && <Cloud className="w-3.5 h-3.5" />}
                                    {event.icon === "CheckCircle2" && <CheckCircle className="w-3.5 h-3.5" />}
                                    {event.icon === "XCircle" && <X className="w-3.5 h-3.5" />}
                                    {event.icon === "RefreshCw" && <RefreshCw className="w-3.5 h-3.5" />}
                                    {event.icon === "LockOpen" && <Unlock className="w-3.5 h-3.5" />}
                                    {event.icon === "AlertTriangle" && <AlertTriangle className="w-3.5 h-3.5" />}
                                    {event.icon === "FileText" && <Briefcase className="w-3.5 h-3.5" />}
                                    {event.icon === "Hourglass" && <RefreshCw className="w-3.5 h-3.5" />}
                                    {event.icon === "BadgeCheck" && <CheckCircle className="w-3.5 h-3.5" />}
                                    {event.icon === "Plane" && <ExternalLink className="w-3.5 h-3.5" />}
                                  </span>

                                  {/* Step details content */}
                                  <div className="space-y-1 pl-1">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 select-none">
                                      <span className={`text-xs font-bold font-sans ${titleColorClass}`}>{event.title}</span>
                                      <span className="text-[9.5px] font-mono text-stone-400 bg-white border border-stone-200/50 px-1.5 py-0.5 rounded shadow-3xs w-fit">
                                        {formatAuditDate(event.date)}
                                      </span>
                                    </div>

                                    <p className="text-[11px] text-stone-600 font-sans leading-relaxed">{event.description}</p>
                                    
                                    {event.reason && (
                                      <div className="mt-1.5 bg-red-50/60 border border-red-100 rounded-md p-2 font-sans text-[10.5px] text-[#A30000] leading-normal break-words">
                                        <strong>Rejection Reason:</strong> "{event.reason}"
                                      </div>
                                    )}

                                    <div className="text-[9px] text-stone-400 font-mono flex items-center gap-1 select-none mt-1">
                                      <span>Recorded by:</span>
                                      <strong className="text-stone-500">{event.actor}</strong>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>

                      {/* Footer Actions */}
                      <div className="p-4 border-t border-line bg-white flex justify-end select-none">
                        <button
                          onClick={() => setSelectedAuditWorker(null)}
                          className="px-4 py-2 bg-stone-950 hover:bg-stone-850 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
                        >
                          Close Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          );
        })()}

        {activeSubTab === "interview_admin" && (
          <div className="space-y-6 animate-fade-in font-sans">
            
            {/* Header / Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-card border border-line rounded-xl p-4 shadow-3xs">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Total Entry Records</span>
                <span className="text-2xl font-bold text-ink block mt-1">{assessedWorkers.length}</span>
                <span className="text-[10px] text-muted block mt-1">Pre-registered candidates with NICs</span>
              </div>
              <div className="bg-card border border-line rounded-xl p-4 shadow-3xs">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Passed Assessments</span>
                <span className="text-2xl font-bold text-success-green block mt-1">
                  {assessedWorkers.filter(w => w.interview_status === "Pass").length}
                </span>
                <span className="text-[10px] text-success-green/80 block mt-1">Ready for Visa processing gate</span>
              </div>
              <div className="bg-card border border-line rounded-xl p-4 shadow-3xs">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Failed / Pending</span>
                <span className="text-2xl font-bold text-amber-600 block mt-1">
                  {assessedWorkers.filter(w => w.interview_status === "Fail" || !w.interview_status || w.interview_status === "Pending").length}
                </span>
                <span className="text-[10px] text-amber-600 block mt-1">Requires re-assessment or hold</span>
              </div>
              <div className="bg-card border border-line rounded-xl p-4 shadow-3xs">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Practical Test Required</span>
                <span className="text-2xl font-bold text-indigo-600 block mt-1">
                  {assessedWorkers.filter(w => w.test_required === "Yes").length}
                </span>
                <span className="text-[10px] text-indigo-500 block mt-1">Flagged for physical evaluation</span>
              </div>
            </div>

            {/* Filters Row */}
            <div className="bg-card border border-line rounded-xl p-4 shadow-3xs flex flex-col md:flex-row gap-4 justify-between items-center select-none">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by Name, NIC, Passport, Trade..."
                  value={interviewSearch}
                  onChange={(e) => setInterviewSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-paper/40 border border-line focus:border-accent rounded-lg outline-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="w-full sm:w-48">
                  <label className="text-[9px] font-bold text-muted uppercase tracking-wider block mb-1">Filter Supply Vendor</label>
                  <select
                    value={interviewCompany}
                    onChange={(e) => setInterviewCompany(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-paper/40 border border-line focus:border-accent rounded-lg outline-none"
                  >
                    <option value="All">All Supply Agencies</option>
                    {companies.map(co => (
                      <option key={co.id} value={co.name}>{co.name}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-44">
                  <label className="text-[9px] font-bold text-muted uppercase tracking-wider block mb-1">Filter Result Status</label>
                  <select
                    value={interviewResult}
                    onChange={(e) => setInterviewResult(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-paper/40 border border-line focus:border-accent rounded-lg outline-none"
                  >
                    <option value="All">All Results</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List / Management Table */}
            <div className="bg-card border border-line rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-line bg-paper/10">
                <h4 className="text-sm font-semibold text-ink font-display">Worker Development Tracker & Assessment Register</h4>
                <p className="text-[11px] text-muted">Showing {filteredAssessedWorkers.length} candidate evaluation logs of {assessedWorkers.length} registered.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-paper text-muted font-sans text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-48">Candidate Details</th>
                      <th className="p-3 w-36">Supply Agency</th>
                      <th className="p-3 w-32">Designation / Trade</th>
                      <th className="p-3 w-40">Evaluator / Marks</th>
                      <th className="p-3 w-28">Result Status</th>
                      <th className="p-3 w-28">Test Req.</th>
                      <th className="p-3">Remarks & Observations</th>
                      <th className="p-3 text-right pr-4 w-32">Management Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {filteredAssessedWorkers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-muted font-sans text-xs">
                          No pre-registered assessment entries found matching active filters.
                        </td>
                      </tr>
                    ) : (
                      filteredAssessedWorkers.map((w) => {
                        const isEditing = editingInterviewId === w.id;

                        return (
                          <tr key={w.id} className={`hover:bg-paper/10 transition-colors ${isEditing ? "bg-amber-50/20" : ""}`}>
                            
                            {/* Candidate info */}
                            <td className="p-3 font-sans">
                              <div className="font-bold text-ink">{w.name}</div>
                              <div className="text-[10px] text-muted mt-0.5 space-y-0.5">
                                <span className="block font-mono">NIC: <strong className="text-slate-700">{w.nic_number || "—"}</strong></span>
                                <span className="block font-mono">PPT: <strong className="text-slate-700">{w.passport || "—"}</strong></span>
                                {w.sr_number && <span className="block font-mono">SR: <strong>{w.sr_number}</strong></span>}
                              </div>
                            </td>

                            {/* Supply Agency */}
                            <td className="p-3 text-stone-700 font-semibold">{w.supply_company}</td>

                            {/* Designation */}
                            <td className="p-3">
                              <span className="inline-flex px-2 py-0.5 bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent uppercase rounded">
                                {w.category}
                              </span>
                            </td>

                            {/* Evaluator & Marks */}
                            <td className="p-3 font-sans">
                              {isEditing ? (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    placeholder="Interviewer Name"
                                    value={editInterviewerName}
                                    onChange={(e) => setEditInterviewerName(e.target.value)}
                                    className="w-full text-xs px-2 py-1 bg-white border border-stone-300 rounded outline-none focus:border-accent"
                                  />
                                  <input
                                    type="number"
                                    placeholder="Marks (0-100)"
                                    min="0"
                                    max="100"
                                    value={editInterviewMarks}
                                    onChange={(e) => setEditInterviewMarks(e.target.value)}
                                    className="w-full text-xs px-2 py-1 bg-white border border-stone-300 rounded outline-none focus:border-accent"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="text-stone-700 font-medium">
                                    {w.interviewer_name || <span className="text-stone-400 text-[11px] italic">Not Evaluated</span>}
                                  </div>
                                  {w.interview_marks !== undefined && w.interview_marks !== "" && (
                                    <div className="text-[11px] text-slate-500 font-mono">
                                      Marks Received: <strong className="text-indigo-700">{w.interview_marks} / 100</strong>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-3">
                              {isEditing ? (
                                <select
                                  value={editInterviewStatus}
                                  onChange={(e) => setEditInterviewStatus(e.target.value as "Pass" | "Fail" | "Pending")}
                                  className="text-xs px-1.5 py-1 bg-white border border-stone-300 rounded outline-none focus:border-accent w-full"
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Pass">Pass</option>
                                  <option value="Fail">Fail</option>
                                </select>
                              ) : (
                                <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                                  w.interview_status === "Pass" 
                                    ? "bg-green-100 text-green-800" 
                                    : w.interview_status === "Fail"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}>
                                  {w.interview_status || "Pending"}
                                </span>
                              )}
                            </td>

                            {/* Test Required */}
                            <td className="p-3">
                              {isEditing ? (
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editTestRequired}
                                    onChange={(e) => setEditTestRequired(e.target.checked)}
                                    className="rounded border-stone-300 text-accent focus:ring-accent"
                                  />
                                  <span className="text-[11px] font-medium text-stone-700">Yes</span>
                                </label>
                              ) : (
                                <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded ${
                                  w.test_required === "Yes" 
                                    ? "bg-indigo-100 text-indigo-800" 
                                    : "bg-stone-100 text-stone-600"
                                }`}>
                                  {w.test_required || "No"}
                                </span>
                              )}
                            </td>

                            {/* Remarks */}
                            <td className="p-3">
                              {isEditing ? (
                                <textarea
                                  placeholder="Evaluation remarks..."
                                  rows={2}
                                  value={editRemarks}
                                  onChange={(e) => setEditRemarks(e.target.value)}
                                  className="w-full text-xs px-2 py-1 bg-white border border-stone-300 rounded outline-none focus:border-accent text-stone-850 font-sans"
                                />
                              ) : (
                                <p className="text-[11px] text-stone-600 font-sans line-clamp-2 max-w-xs break-words whitespace-pre-wrap">
                                  {w.remarks || "—"}
                                </p>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3 text-right pr-4">
                              {isEditing ? (
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => handleSaveInterviewEdit(w.id)}
                                    disabled={isSavingInterview}
                                    className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] rounded cursor-pointer transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingInterviewId(null)}
                                    className="px-2.5 py-1 bg-stone-100 border border-stone-300 text-stone-600 font-bold text-[10px] rounded cursor-pointer hover:bg-stone-200 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 items-end">
                                  <button
                                    onClick={() => handleStartInterviewEdit(w)}
                                    className="px-2 py-1 border border-stone-300 hover:bg-slate-50 text-[10px] font-bold text-stone-700 rounded transition-colors cursor-pointer animate-fade-in"
                                  >
                                    Edit Evaluation
                                  </button>
                                  <button
                                    onClick={() => handleDeleteInterviewData(w.id)}
                                    className="text-[9.5px] font-mono text-stone-400 hover:text-bad underline transition-colors cursor-pointer"
                                  >
                                    Clear assessment
                                  </button>
                                </div>
                              )}
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {activeSubTab === "clear_data" && (
          <div className="bg-card border border-red-200 rounded-xl p-6 shadow-sm space-y-6 animate-fade-in font-sans">
            <div className="flex items-center gap-3 pb-4 border-b border-line/60">
              <AlertTriangle className="w-6 h-6 text-red-650 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-stone-900 font-display">
                  System Hard Reset & Live Migration
                </h3>
                <p className="text-xs text-muted">
                  Erase pre-loaded demo candidates, allocations, logs, and start using Sanken Overseas Platform in live real-time production.
                </p>
              </div>
            </div>

            <div className="p-4 bg-red-50/70 text-bad border border-red-200/50 rounded-xl text-xs space-y-2 font-sans">
              <p className="font-bold flex items-center gap-1.5 text-red-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                CRITICAL WARNING: This action is irreversible!
              </p>
              <ul className="list-disc list-inside space-y-1 text-red-750 font-medium ml-1">
                <li>This will permanently delete all worker profiles (candidates) in the system across all project focus scopes.</li>
                <li>All active pipeline counts, approvals, and logs will be reset back to empty.</li>
                <li>Bureau and XPACT Quota allocations (additions and history logs) will be cleared.</li>
                <li><strong>Safe Configurations Persisted:</strong> All registered system settings, supply companies/vendors, categories (to assign future quotas), dropdown lists, and personnel accounts (Admin, Recruiter, Engineer, Operations) will remain intact.</li>
              </ul>
            </div>

            <div className="space-y-4 pt-2">
              <p className="text-xs text-stone-600">
                To prevent accidental deletion, type <strong className="font-mono text-stone-900 bg-paper border border-line px-1.5 py-0.5 rounded">ERASE AND LIVE PORTAL</strong> below to authorize the database reset:
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                <input
                  type="text"
                  placeholder="Type verification text..."
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  className="bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-red-500 font-mono text-ink w-full"
                />
                
                <button
                  type="button"
                  disabled={resetConfirmText !== "ERASE AND LIVE PORTAL" || isResetting}
                  onClick={handleSystemReset}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 justify-center shrink-0 cursor-pointer shadow-sm"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Erasing...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Execute Reset</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
