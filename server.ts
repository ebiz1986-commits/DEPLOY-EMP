import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, initializeFirestore, setLogLevel } from "firebase/firestore";
import { DbState, Worker, Category, Company, DropdownOption, User, UserRole } from "./src/types";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = process.env.DB_PATH || path.join(process.cwd(), "db.json");

// Initialize Firebase SDK Client for persistence
let firestoreDb: any = null;
try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const configContent = fs.readFileSync(firebaseConfigPath, "utf8");
    const firebaseConfig = JSON.parse(configContent);
    const fbApp = initializeApp(firebaseConfig);
    // Suppress verbose SDK logs like idle connection resets and keep only errors
    setLogLevel("error");
    // Use initializeFirestore with long polling to avoid GRPC connection resets on the backend
    firestoreDb = initializeFirestore(fbApp, {
      experimentalForceLongPolling: true
    }, firebaseConfig.firestoreDatabaseId);
    console.log("Firestore successfully initialized on Node.js backend with high-integrity long polling config.");
  } else {
    console.log("Firebase config not found. Running with local storage fallback.");
  }
} catch (error) {
  console.error("Firebase initialization failed on Node.js backend:", error);
}

// Background utility to async save local state snapshot to Cloud Firestore
async function saveDatabaseToFirestore(state: DbState) {
  if (!firestoreDb) return;
  try {
    const sanitizedState = JSON.parse(JSON.stringify(state));
    const docRef = doc(firestoreDb, "state_store", "master");
    await setDoc(docRef, {
      dbState: sanitizedState,
      updatedAt: new Date().toISOString()
    });
    console.log("Database state successfully synchronized and saved to Cloud Firestore!");
  } catch (err) {
    console.error("Cloud Firestore synchronization failed:", err);
  }
}

// Initial restore helper called when server boots
async function loadDatabaseFromFirestore() {
  if (!firestoreDb) {
    console.log("Firestore DB not available, running with existing or seeded local state.");
    return;
  }
  try {
    console.log("Checking Cloud Firestore for persisted database state...");
    const docRef = doc(firestoreDb, "state_store", "master");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.dbState) {
        fs.writeFileSync(DB_FILE, JSON.stringify(data.dbState, null, 2), "utf8");
        console.log("SUCCESS: Database state fully restored from Cloud Firestore!");
      } else {
        console.log("Firestore master document exists but has no dbState property.");
      }
    } else {
      console.log("No persisted database state found in Firestore. Creating new cloud snapshot on first change.");
    }
  } catch (error) {
    console.error("Failed to restore database state from Firestore:", error);
  }
}

// Helper to write to JSON database
const readDb = (): DbState => {
  if (!fs.existsSync(DB_FILE)) {
    // Generate initial state (Seed data)
    const initialState: DbState = {
      categories: [
        { id: "cat-1", name: "Labur", max_quota: 120, company_allocations: { "KSJ": 50, "SKILL": 40, "DEK": 30 } },
        { id: "cat-2", name: "Finishing Carpenter", max_quota: 90, company_allocations: { "KSJ": 40, "SKILL": 30, "DEK": 20 } },
        { id: "cat-3", name: "Meson", max_quota: 75, company_allocations: { "KSJ": 30, "SKILL": 25, "DEK": 20 } },
        { id: "cat-4", name: "Rigger", max_quota: 40, company_allocations: { "KSJ": 15, "SKILL": 15, "DEK": 10 } },
        { id: "cat-5", name: "welders", max_quota: 15, company_allocations: { "KSJ": 5, "SKILL": 5, "DEK": 5 } }
      ],
      companies: [
        { id: "co-1", name: "KSJ" },
        { id: "co-2", name: "Star Recruitment Solutions" },
        { id: "co-3", name: "Apex Transit Ltd" },
        { id: "co-4", name: "Oasis Labor Supply" },
        { id: "co-5", name: "Horizon Group Malaysia" }
      ],
      dropdown_options: [
        { id: "opt-1", field: "sending_batch", value: "Batch #104" },
        { id: "opt-2", field: "sending_batch", value: "Batch #105" },
        { id: "opt-3", field: "sending_batch", value: "Batch #106" },
        { id: "opt-4", field: "sending_batch", value: "Batch #107" },
        { id: "opt-5", field: "status", value: "Pending" },
        { id: "opt-6", field: "status", value: "Visa Approved (xpact)" },
        { id: "opt-7", field: "status", value: "Visa Reject (xpact)" },
        { id: "opt-8", field: "status", value: "Applied second time" },
        { id: "opt-9", field: "bureau", value: "Pending" },
        { id: "opt-10", field: "bureau", value: "Complete" },
        { id: "opt-11", field: "bureau", value: "Reject" },
        { id: "opt-12", field: "final_status", value: "Pending" },
        { id: "opt-13", field: "final_status", value: "Booked" },
        { id: "opt-14", field: "final_status", value: "Arrived" },
        { id: "opt-nat-1", field: "nationality", value: "Bangladeshi" },
        { id: "opt-nat-2", field: "nationality", value: "Indian" },
        { id: "opt-nat-3", field: "nationality", value: "Sri Lankan" },
        { id: "opt-nat-4", field: "nationality", value: "Nepali" }
      ],
      users: [
        { username: "recruiter", password: "password", name: "Farid (Recruiter)", role: "recruiter", assigned_projects: ["proj-1"], recruiter_company: "KSJ" },
        { username: "engineer", password: "password", name: "Ir. Tan (Engineer)", role: "engineer", assigned_projects: ["proj-1"] },
        { username: "ops", password: "password", name: "Sarah (Operations)", role: "ops", assigned_projects: ["proj-1"] },
        { username: "admin", password: "password", name: "Admin (System Admin)", role: "admin" },
        { username: "viewer", password: "password", name: "Viewer (Dashboard Only)", role: "viewer" }
      ],
      workers: [
        {
          id: "w-1",
          name: "Mohammad Rahman",
          passport: "A81729381",
          category: "Construction",
          supply_company: "KSJ",
          sending_batch: "Batch #104",
          visa_doc_date: "2026-05-10",
          state: "active",
          doc_upload_wa: "Yes",
          last_updated: "2026-05-12",
          status: "Visa Approved (xpact)",
          bureau: "Complete",
          final_status: "Booked",
          created_at: "2026-05-01T04:23:10.000Z"
        },
        {
          id: "w-2",
          name: "Abdul Hasnat",
          passport: "B92837412",
          category: "Construction",
          supply_company: "KSJ",
          sending_batch: "Batch #104",
          visa_doc_date: "2026-05-10",
          state: "active",
          doc_upload_wa: "Yes",
          last_updated: "2026-05-15",
          status: "Visa Approved (xpact)",
          bureau: "Complete",
          final_status: "Arrived",
          created_at: "2026-05-01T05:11:00.000Z"
        },
        {
          id: "w-3",
          name: "Chen Wei",
          passport: "E58210943",
          category: "Manufacturing",
          supply_company: "Star Recruitment Solutions",
          sending_batch: "Batch #105",
          visa_doc_date: "2026-05-18",
          state: "active",
          doc_upload_wa: "Yes",
          last_updated: "2026-05-20",
          status: "Visa Approved (xpact)",
          bureau: "Pending",
          final_status: "Pending",
          created_at: "2026-05-12T08:14:00.000Z"
        },
        {
          id: "w-4",
          name: "Suresh Pillai",
          passport: "Z94012847",
          category: "Agriculture",
          supply_company: "Apex Transit Ltd",
          state: "pending",
          doc_upload_wa: "Pending",
          status: "Pending",
          bureau: "Pending",
          final_status: "Pending",
          created_at: "2026-05-28T09:00:00.000Z"
        },
        {
          id: "w-5",
          name: "Myat Moe",
          passport: "M73019482",
          category: "Agriculture",
          supply_company: "Apex Transit Ltd",
          sending_batch: "Batch #106",
          visa_doc_date: "2026-05-29",
          state: "active",
          doc_upload_wa: "Pending",
          status: "Pending",
          bureau: "Pending",
          final_status: "Pending",
          created_at: "2026-05-28T09:12:00.000Z"
        },
        {
          id: "w-6",
          name: "Aris Munandar",
          passport: "I10398472",
          category: "F&B Services",
          supply_company: "Oasis Labor Supply",
          state: "pending",
          doc_upload_wa: "Pending",
          status: "Pending",
          bureau: "Pending",
          final_status: "Pending",
          created_at: "2026-05-29T10:30:00.000Z"
        },
        {
          id: "w-7",
          name: "Sanjay Kumar",
          passport: "K48293741",
          category: "Tech & Engineering",
          supply_company: "Horizon Group Malaysia",
          sending_batch: "Batch #105",
          visa_doc_date: "2026-05-19",
          state: "active",
          doc_upload_wa: "Yes",
          last_updated: "2026-05-22",
          status: "Visa Approved (xpact)",
          bureau: "Complete",
          final_status: "Arrived",
          created_at: "2026-05-15T12:00:00.000Z"
        }
      ],
      project_detail: {
        id: "proj-1",
        name: "Sanken Overseas Infrastructure Link MRT Project",
        client: "Malaysia MRT Corp",
        engineer_in_charge: "Ir. Tan (Engineer)",
        admin_coordinator: "Admin (System Admin)",
        location: "Kuala Lumpur Central Hub",
        contract_number: "MRT-2026-SANKEN-0982"
      },
      projects: [
        {
          id: "proj-1",
          name: "Sanken Overseas Infrastructure Link MRT Project",
          client: "Malaysia MRT Corp",
          engineer_in_charge: "Ir. Tan (Engineer)",
          admin_coordinator: "Admin (System Admin)",
          location: "Kuala Lumpur Central Hub",
          contract_number: "MRT-2026-SANKEN-0982"
        }
      ],
      selected_project_id: "proj-1"
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf8");
    return initialState;
  }
  const content = fs.readFileSync(DB_FILE, "utf8");
  const db = JSON.parse(content) as DbState;
  
  let stateChanged = false;
  if (!db.bureau_allocations) {
    db.bureau_allocations = [];
    stateChanged = true;
  }
  if (!db.xpact_allocations) {
    db.xpact_allocations = [];
    stateChanged = true;
  }
  if (stateChanged) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  }

  // Migrate existing single project_detail to projects list
  if (!db.projects || db.projects.length === 0) {
    const singleProj = {
      id: "proj-1",
      name: db.project_detail?.name || "Sanken Overseas Infrastructure Link MRT Project",
      client: db.project_detail?.client || "Malaysia MRT Corp",
      engineer_in_charge: db.project_detail?.engineer_in_charge || "Ir. Tan (Engineer)",
      admin_coordinator: db.project_detail?.admin_coordinator || "Admin (System Admin)",
      location: db.project_detail?.location || "Kuala Lumpur Central Hub",
      contract_number: db.project_detail?.contract_number || "MRT-2026-SANKEN-0982"
    };
    db.projects = [singleProj];
    db.selected_project_id = "proj-1";
    db.project_detail = singleProj;
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  }

  if (!db.selected_project_id) {
    db.selected_project_id = db.projects[0]?.id || "proj-1";
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  }

  // Ensure current active project is mirrored in project_detail
  const currentProj = db.projects.find(p => p.id === db.selected_project_id) || db.projects[0];
  if (currentProj) {
    db.project_detail = currentProj;
  }

  // Ensure all workers have project_id assigned
  let updatedWorkers = false;
  db.workers.forEach(w => {
    if (!w.project_id) {
      w.project_id = db.selected_project_id || "proj-1";
      updatedWorkers = true;
    }
  });

  // Ensure notifications array is loaded
  if (!db.notifications) {
    db.notifications = [
      {
        id: "notif-1",
        message: "Sankenseas multi-project focus platform initialized.",
        sender: "System",
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        type: "info"
      },
      {
        id: "notif-2",
        message: "Star Recruitment Solutions registered Construction candidate cohort.",
        sender: "Farid (Recruiter)",
        created_at: new Date(Date.now() - 3600000).toISOString(),
        type: "success",
        project_id: "proj-1"
      }
    ];
    updatedWorkers = true;
  }

  if (updatedWorkers) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  }

  return db;
};

// SSE Active client connections for live updates
let clients: express.Response[] = [];

const broadcastUpdate = (lastNotification?: any) => {
  clients.forEach((client) => {
    if (lastNotification) {
      // Send both reload signal and notification payload details as a JSON string
      client.write(`data: ${JSON.stringify({ type: "notification", notification: lastNotification })}\n\n`);
    } else {
      client.write("data: reload\n\n");
    }
  });
};

const writeDb = (state: DbState, lastNotification?: any) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf8");
  broadcastUpdate(lastNotification);
  saveDatabaseToFirestore(state).catch((err) => {
    console.error("Firestore background synchronization failure:", err);
  });
};

const addSystemNotification = (
  db: DbState,
  message: string,
  sender: string,
  role: UserRole,
  type: "info" | "success" | "warning" | "error" = "info",
  projectId?: string,
  targetUser?: string,
  associatedCompany?: string
) => {
  if (!db.notifications) {
    db.notifications = [];
  }
  const newNotif = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    message,
    sender,
    role,
    created_at: new Date().toISOString(),
    type,
    project_id: projectId,
    target_user: targetUser,
    associated_company: associatedCompany
  };
  db.notifications = [newNotif, ...db.notifications].slice(0, 100);
  return newNotif;
};

async function startServer() {
  // Restore persisted cloud database state prior to API startup
  await loadDatabaseFromFirestore();

  const app = express();
  app.use(express.json());

  // 1. API: Server-Sent Events for Realtime Broadcast
  app.get("/api/live-updates", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    clients.push(res);

    req.on("close", () => {
      clients = clients.filter((c) => c !== res);
    });
  });

  // 2. API: Authenticate User
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const db = readDb();
    const user = db.users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (user) {
      const { password, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } else {
      res.status(401).json({ success: false, message: "Invalid username or password" });
    }
  });

  // 3. API: Get Workers + Full Configuration Context
  app.get("/api/dashboard-data", (req, res) => {
    const db = readDb();
    res.json(db);
  });

  // 3.5 API: Get individual categories, companies, option lists
  app.get("/api/config", (req, res) => {
    const db = readDb();
    res.json({
      categories: db.categories,
      companies: db.companies,
      dropdown_options: db.dropdown_options,
      users: db.users.map(({ password, ...u }) => u)
    });
  });

  // 4. API: Bulk Add Workers (Sanken Overseas Recruiter Intake)
  app.post("/api/workers/bulk-add", (req, res) => {
    const newWorkersData: Omit<Worker, "id" | "state" | "doc_upload_wa" | "status" | "bureau" | "final_status" | "created_at">[] = req.body;
    const db = readDb();

    // Passport uniqueness validation
    const existingPassports = new Set(db.workers.map((w) => w.passport.trim().toLowerCase()));
    
    // Check duplicates within the incoming payload itself
    const seenIncoming = new Set<string>();
    const duplicates: string[] = [];

    for (const w of newWorkersData) {
      const passportTrimmed = w.passport.trim().toLowerCase();
      if (existingPassports.has(passportTrimmed) || seenIncoming.has(passportTrimmed)) {
        duplicates.push(w.passport);
      }
      seenIncoming.add(passportTrimmed);
    }

    if (duplicates.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Passport numbers already exist: ${duplicates.join(", ")}`
      });
    }

    const initDateStr = new Date().toISOString().split("T")[0];

    const createdWorkers: Worker[] = newWorkersData.map((w) => ({
      id: `w-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: w.name.trim(),
      passport: w.passport.trim().toUpperCase(),
      category: w.category,
      supply_company: w.supply_company,
      state: "pending",
      doc_upload_wa: "Pending",
      status: "Pending",
      bureau: "Pending",
      final_status: "Pending",
      created_at: new Date().toISOString(),
      project_id: (w as any).project_id || db.selected_project_id || "proj-1",
      doc_link: (w as any).doc_link || "",
      bulk_doc_link: (w as any).bulk_doc_link || "",
      wa_doc_reject_reason: "",
      doc_upload_wa_date: initDateStr,
      status_date: initDateStr,
      bureau_date: initDateStr,
      final_status_date: initDateStr,
      gate_reject_reason: "",
      admin2_submit_date: initDateStr,
      nationality: (w as any).nationality || ""
    }));

    db.workers = [...createdWorkers, ...db.workers];
    
    const targetProjId = createdWorkers[0]?.project_id || "proj-1";
    const proj = db.projects?.find(p => p.id === targetProjId) || db.project_detail;
    const notifMsg = `Recruiter intake added ${createdWorkers.length} candidate(s) for project target: "${proj?.name || "Global"}"`;
    const newNotif = addSystemNotification(db, notifMsg, "Recruiter Portal", "recruiter", "success", targetProjId, undefined, createdWorkers[0]?.supply_company);
    
    writeDb(db, newNotif);

    res.status(201).json({ success: true, count: createdWorkers.length, data: createdWorkers });
  });

  // 5. API: Approve Worker (Engineer gate)
  app.put("/api/workers/:id/approve", (req, res) => {
    const { id } = req.params;
    const { sending_batch } = req.body;
    const db = readDb();

    const workerIndex = db.workers.findIndex((w) => w.id === id);
    if (workerIndex === -1) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    const worker = db.workers[workerIndex];
    if (worker.state === "active") {
      return res.status(400).json({ success: false, message: "Worker is already active" });
    }

    // Verify category and company-specific allocation
    const categoryName = worker.category;
    const category = db.categories.find((c) => c.name === categoryName);
    if (!category) {
      return res.status(400).json({ success: false, message: `Category "${categoryName}" does not exist` });
    }

    const companyName = worker.supply_company || "KSJ";
    const companyLimit = category.company_allocations?.[companyName] ?? 0;
    const activeCompanyCount = db.workers.filter(
      (w) => w.category === categoryName && w.supply_company === companyName && w.state === "active"
    ).length;

    if (activeCompanyCount >= companyLimit) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve: Labor allocation exhausted for vendor "${companyName}" under category "${categoryName}" (${activeCompanyCount}/${companyLimit} slots utilized)`
      });
    }

    // Perform approval action
    worker.sending_batch = sending_batch;
    worker.visa_doc_date = new Date().toISOString().split("T")[0];
    worker.state = "active";
    // Also reset last_updated on state activation
    worker.last_updated = new Date().toISOString().split("T")[0];

    db.workers[workerIndex] = worker;
    
    // Add engineering approval notification linked to project focus
    const projDetail = db.projects?.find(p => p.id === worker.project_id) || db.project_detail;
    const notifMsg = `Engineer Ir. Tan approved worker candidate "${worker.name}" under "${worker.category}" category for project target: "${projDetail?.name || "Global"}"`;
    const newNotif = addSystemNotification(db, notifMsg, "Site Engineer", "engineer", "success", worker.project_id, undefined, worker.supply_company);

    writeDb(db, newNotif);

    res.json({ success: true, worker });
  });

  // 5a. API: Hold Worker (Engineer gate)
  app.put("/api/workers/:id/hold", (req, res) => {
    const { id } = req.params;
    const db = readDb();

    const workerIndex = db.workers.findIndex((w) => w.id === id);
    if (workerIndex === -1) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    const worker = db.workers[workerIndex];
    
    // Set state to held
    worker.state = "held";
    worker.last_updated = new Date().toISOString().split("T")[0];

    db.workers[workerIndex] = worker;

    // Add engineering hold notification
    const projDetail = db.projects?.find(p => p.id === worker.project_id) || db.project_detail;
    const notifMsg = `Engineer Ir. Tan placed worker candidate "${worker.name}" (${worker.category}) on HOLD for project: "${projDetail?.name || "Global"}" (Agency: ${worker.supply_company}).`;
    const newNotif = addSystemNotification(db, notifMsg, "Site Engineer", "engineer", "warning", worker.project_id, undefined, worker.supply_company);

    writeDb(db, newNotif);

    res.json({ success: true, worker });
  });

  // 5b. API: Reject Worker (Engineer gate)
  app.put("/api/workers/:id/reject-gate", (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const db = readDb();

    const workerIndex = db.workers.findIndex((w) => w.id === id);
    if (workerIndex === -1) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    const worker = db.workers[workerIndex];
    
    // Set state to rejected
    worker.state = "rejected";
    worker.gate_reject_reason = reason || "";
    worker.last_updated = new Date().toISOString().split("T")[0];

    db.workers[workerIndex] = worker;

    // Add engineering rejection notification
    const projDetail = db.projects?.find(p => p.id === worker.project_id) || db.project_detail;
    const notifMsg = `Engineer Ir. Tan REJECTED worker candidate "${worker.name}" (${worker.category}) under gate approvals for project: "${projDetail?.name || "Global"}" (Agency: ${worker.supply_company}).${reason ? ` Reason: ${reason}` : ""}`;
    const newNotif = addSystemNotification(db, notifMsg, "Site Engineer", "engineer", "error", worker.project_id, undefined, worker.supply_company);

    writeDb(db, newNotif);

    res.json({ success: true, worker });
  });

  // 6. API: Update Worker (Recruiter Bureau Edit / Ops Edit)
  app.put("/api/workers/:id", (req, res) => {
    const { id } = req.params;
    const updates: Partial<Worker> = req.body;
    const db = readDb();

    const workerIndex = db.workers.findIndex((w) => w.id === id);
    if (workerIndex === -1) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    const currentWorker = db.workers[workerIndex];
    const callerRole = req.headers["x-caller-role"] || "";

    // Rule: "BUREAU CLEARANCE" CAN UPDATE ONLY RECRUITMENT COMPANY
    if (updates.bureau !== undefined && updates.bureau !== currentWorker.bureau) {
      if (callerRole !== "recruiter" && callerRole !== "admin") {
        return res.status(403).json({ success: false, message: "Only Recruitment Company or System Admin can update Bureau Clearance." });
      }
      if (callerRole !== "admin" && currentWorker.bureau !== "Pending") {
        return res.status(403).json({ success: false, message: "Only System Admin can modify Bureau Clearance after it has been changed from 'Pending'." });
      }
    }

    // Rule 2: "after admin2 change status and apply he can't change again only system admin can change"
    // Admin2 is represented by "ops" role.
    if (callerRole === "ops") {
      if (updates.doc_upload_wa !== undefined && updates.doc_upload_wa !== currentWorker.doc_upload_wa) {
        if (currentWorker.doc_upload_wa === "Yes") {
          return res.status(403).json({ success: false, message: "Only System Admin can modify 'DOC Upload' status after it has been applied to 'Yes'." });
        }
      }
      if (updates.status !== undefined && updates.status !== currentWorker.status) {
        if (currentWorker.status !== "Pending") {
          return res.status(403).json({ success: false, message: "Only System Admin can modify Visa Status after it has been changed from 'Pending'." });
        }
      }
      if (updates.bureau !== undefined && updates.bureau !== currentWorker.bureau) {
        if (currentWorker.bureau !== "Pending") {
          return res.status(403).json({ success: false, message: "Only System Admin can modify Bureau Clearance after it has been changed from 'Pending'." });
        }
      }
      if (updates.final_status !== undefined && updates.final_status !== currentWorker.final_status) {
        if (currentWorker.final_status !== "Pending") {
          return res.status(403).json({ success: false, message: "Only System Admin can modify Final Placement Status after it has been changed from 'Pending'." });
        }
      }
    }

    // Rule 1: "until 'doc upload' 'yes' all other drop downs should be 'pending' by default"
    const docUploadResult = updates.doc_upload_wa !== undefined ? updates.doc_upload_wa : currentWorker.doc_upload_wa;
    if (docUploadResult !== "Yes") {
      updates.status = "Pending";
      updates.bureau = "Pending";
      updates.final_status = "Pending";
    }

    // Strict sequential pipeline constraints (Doc Upload -> Visa Status -> Bureau Clearance -> Final Placement Status)
    const finalDocUpload = updates.doc_upload_wa !== undefined ? updates.doc_upload_wa : currentWorker.doc_upload_wa;
    const finalStatus = updates.status !== undefined ? updates.status : currentWorker.status;
    const finalBureau = updates.bureau !== undefined ? updates.bureau : currentWorker.bureau;

    if (updates.status !== undefined && updates.status !== currentWorker.status) {
      if (finalDocUpload !== "Yes") {
        return res.status(400).json({ success: false, message: "Visa Status can only be changed once 'DOC UPLOAD (WA CHECKER)' is verified ('Yes')." });
      }
    }

    if (updates.bureau !== undefined && updates.bureau !== currentWorker.bureau) {
      if (finalStatus !== "Visa Approved (xpact)" && updates.bureau !== "Pending") {
        return res.status(400).json({ success: false, message: "Bureau Clearance can only be changed once 'VISA STATUS' is 'Visa Approved (xpact)'." });
      }
    }

    if (updates.final_status !== undefined && updates.final_status !== currentWorker.final_status) {
      if (finalBureau !== "Complete" && updates.final_status !== "Pending") {
        return res.status(400).json({ success: false, message: "Final Placement Status can only be changed once 'BUREAU CLEARANCE' is 'Complete'." });
      }
    }

    const currentDateStr = new Date().toISOString().split("T")[0];

    // Trigger check for doc_upload_wa change -> autostamp
    if (updates.doc_upload_wa !== undefined && updates.doc_upload_wa !== currentWorker.doc_upload_wa) {
      currentWorker.last_updated = currentDateStr;
    }

    // Apply updates
    const updatedWorker: Worker = {
      ...currentWorker,
      ...updates
    };

    // Auto-stamp the exact transition dates for key status changes
    if (updates.doc_upload_wa !== undefined && updates.doc_upload_wa !== currentWorker.doc_upload_wa) {
      updatedWorker.doc_upload_wa_date = currentDateStr;
    }
    if (updates.status !== undefined && updates.status !== currentWorker.status) {
      updatedWorker.status_date = currentDateStr;
    }
    if (updates.bureau !== undefined && updates.bureau !== currentWorker.bureau) {
      updatedWorker.bureau_date = currentDateStr;
    }
    if (updates.final_status !== undefined && updates.final_status !== currentWorker.final_status) {
      updatedWorker.final_status_date = currentDateStr;
    }

    // Special trigger: If Status is changed to Visa Approved (xpact), reset bureau to Pending (recruiter bureau queue)
    if (updates.status === "Visa Approved (xpact)" && currentWorker.status !== "Visa Approved (xpact)") {
      updatedWorker.bureau = "Pending";
      updatedWorker.bureau_pending_at = new Date().toISOString();
    }

    // Special trigger: If Bureau is changed to Complete, stamp the completed date
    if (updates.bureau === "Complete" && currentWorker.bureau !== "Complete") {
      updatedWorker.bureau_completed_at = new Date().toISOString();
    }

    db.workers[workerIndex] = updatedWorker;

    // Detect interesting updates to broadcast as system-wide notifications
    let notifObj = null;
    if (updates.status && updates.status !== currentWorker.status) {
      notifObj = addSystemNotification(
        db,
        `Candidate "${updatedWorker.name}" visa status shifted to: "${updates.status}"`,
        "Operations Admin",
        "ops",
        updates.status.toLowerCase().includes("approved") ? "success" : "warning",
        updatedWorker.project_id,
        undefined,
        updatedWorker.supply_company
      );

      // Explicit Bureau Clearance Pending Notification for Recruiter
      if (updates.status === "Visa Approved (xpact)") {
        const bureauNotif = addSystemNotification(
          db,
          `Bureau Clearance is now PENDING for Candidate "${updatedWorker.name}" (Visa Approved)`,
          "System",
          "recruiter",
          "warning",
          updatedWorker.project_id,
          undefined,
          updatedWorker.supply_company
        );
        notifObj = bureauNotif; // Broadcast this as the primary real-time notification
      }
    } else if (updates.final_status && updates.final_status !== currentWorker.final_status) {
      notifObj = addSystemNotification(
        db,
        `Candidate "${updatedWorker.name}" logistic phase updated to: "${updates.final_status}"`,
        "Operations Admin",
        "ops",
        updates.final_status === "Arrived" ? "success" : "info",
        updatedWorker.project_id,
        undefined,
        updatedWorker.supply_company
      );
    } else if (updates.bureau && updates.bureau !== currentWorker.bureau) {
      notifObj = addSystemNotification(
        db,
        `Recruiter Bureau finalized clearance for "${updatedWorker.name}": ${updates.bureau}`,
        "Recruiter Bureau",
        "recruiter",
        updates.bureau === "Complete" ? "success" : "error",
        updatedWorker.project_id,
        undefined,
        updatedWorker.supply_company
      );
    } else if (updates.wa_doc_reject_reason !== undefined && updates.wa_doc_reject_reason !== currentWorker.wa_doc_reject_reason && updates.wa_doc_reject_reason) {
      notifObj = addSystemNotification(
        db,
        `Candidate "${updatedWorker.name}" (WA DOC) Reject Reason: ${updates.wa_doc_reject_reason}`,
        "Coordinator",
        "ops",
        "error",
        updatedWorker.project_id,
        undefined,
        updatedWorker.supply_company
      );
    }

    writeDb(db, notifObj);

    res.json({ success: true, worker: updatedWorker });
  });

  // 7. API: Delete Worker (Admin Only)
  app.delete("/api/workers/:id", (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const beforeLength = db.workers.length;
    db.workers = db.workers.filter((w) => w.id !== id);

    if (db.workers.length === beforeLength) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    writeDb(db);
    res.json({ success: true });
  });

  // 8. API: Save Configuration (Admin panels, quotas, dropdowns, companies, user accounts)
  app.post("/api/config/update-categories", (req, res) => {
    const newCategories: Category[] = req.body;
    const db = readDb();
    db.categories = newCategories;
    writeDb(db);
    res.json({ success: true, categories: db.categories });
  });

  app.post("/api/config/update-bureau-allocations", (req, res) => {
    const newBureauAllocations = req.body;
    const db = readDb();
    db.bureau_allocations = newBureauAllocations;
    writeDb(db);
    res.json({ success: true, bureau_allocations: db.bureau_allocations });
  });

  app.post("/api/config/update-xpact-allocations", (req, res) => {
    const newXpactAllocations = req.body;
    const db = readDb();
    db.xpact_allocations = newXpactAllocations;
    writeDb(db);
    res.json({ success: true, xpact_allocations: db.xpact_allocations });
  });

  app.post("/api/config/update-companies", (req, res) => {
    const newCompanies: Company[] = req.body;
    const db = readDb();
    db.companies = newCompanies;
    writeDb(db);
    res.json({ success: true, companies: db.companies });
  });

  app.post("/api/config/update-dropdown-options", (req, res) => {
    const newOptions: DropdownOption[] = req.body;
    const db = readDb();
    db.dropdown_options = newOptions;
    writeDb(db);
    res.json({ success: true, dropdown_options: db.dropdown_options });
  });

  app.post("/api/config/update-project", (req, res) => {
    const updatedProject = req.body;
    const db = readDb();
    if (!db.projects) {
      db.projects = [];
    }
    const idx = db.projects.findIndex(p => p.id === updatedProject.id);
    if (idx !== -1) {
      db.projects[idx] = updatedProject;
    } else {
      const fallbackId = db.selected_project_id || "proj-1";
      const fidx = db.projects.findIndex(p => p.id === fallbackId);
      if (fidx !== -1) {
        db.projects[fidx] = { ...db.projects[fidx], ...updatedProject, id: fallbackId };
      } else {
        db.projects.push({ ...updatedProject, id: fallbackId });
      }
    }
    
    // Ensure project_detail mirrors the active selected project
    const activeProj = db.projects.find(p => p.id === db.selected_project_id) || db.projects[0];
    if (activeProj) {
      db.project_detail = activeProj;
    }
    
    writeDb(db);
    res.json({ success: true, project_detail: db.project_detail, projects: db.projects });
  });

  app.post("/api/config/add-project", (req, res) => {
    const newProject = req.body;
    if (!newProject.id) {
      newProject.id = `proj-${Date.now()}`;
    }
    const db = readDb();
    if (!db.projects) db.projects = [];
    db.projects.push(newProject);
    if (db.projects.length === 1) {
      db.selected_project_id = newProject.id;
      db.project_detail = newProject;
    }
    writeDb(db);
    res.json({ success: true, projects: db.projects, selected_project_id: db.selected_project_id, project_detail: db.project_detail });
  });

  app.post("/api/config/select-project", (req, res) => {
    const { id } = req.body;
    const db = readDb();
    if (!db.projects) db.projects = [];
    const proj = db.projects.find(p => p.id === id);
    if (!proj) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    db.selected_project_id = id;
    db.project_detail = proj;
    writeDb(db);
    res.json({ success: true, selected_project_id: db.selected_project_id, project_detail: db.project_detail });
  });

  app.post("/api/config/delete-project", (req, res) => {
    const { id } = req.body;
    const db = readDb();
    if (!db.projects) db.projects = [];
    if (db.projects.length <= 1) {
      return res.status(400).json({ success: false, message: "Cannot delete the only remaining active project." });
    }
    db.projects = db.projects.filter(p => p.id !== id);
    if (db.selected_project_id === id) {
      db.selected_project_id = db.projects[0].id;
      db.project_detail = db.projects[0];
    }
    writeDb(db);
    res.json({ success: true, projects: db.projects, selected_project_id: db.selected_project_id, project_detail: db.project_detail });
  });

  app.post("/api/config/add-user", (req, res) => {
    const newUser: User = req.body;
    const db = readDb();
    
    if (db.users.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    db.users.push(newUser);
    writeDb(db);
    res.json({ success: true, users: db.users.map(({ password, ...u }) => u) });
  });

  app.delete("/api/config/users/:username", (req, res) => {
    const { username } = req.params;
    const db = readDb();
    db.users = db.users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    writeDb(db);
    res.json({ success: true });
  });

  // API: Erase all test data & Start fresh (Admin Only)
  app.post("/api/admin/clear-test-data", (req, res) => {
    const db = readDb();
    db.workers = [];
    db.notifications = [
      {
        id: "notif-init",
        message: "System initialized for live operations. All test candidate records and logs cleared.",
        sender: "System Admin",
        role: "admin",
        created_at: new Date().toISOString(),
        type: "success"
      }
    ];
    db.bureau_allocations = [];
    db.xpact_allocations = [];
    writeDb(db);
    res.json({ success: true, message: "System successfully reset! All candidate records, allocations, and notifications have been erased." });
  });

  app.post("/api/notifications/custom", (req, res) => {
    const { message, sender, role, type, project_id } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "Notification message is required" });
    }
    const db = readDb();
    const validatedRole: UserRole = (role && ["recruiter", "engineer", "ops", "admin", "viewer"].includes(role)) 
      ? (role as UserRole) 
      : "viewer";

    const newNotif = addSystemNotification(
      db,
      message.trim(),
      sender || "Anonymous Staff",
      validatedRole,
      type || "info",
      project_id || undefined
    );
    writeDb(db, newNotif);
    res.json({ success: true, notification: newNotif, notifications: db.notifications });
  });

  // Serve Vite app in dev mode, or static bundle in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
