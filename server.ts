import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { DbState, Worker, Category, Company, DropdownOption, User } from "./src/types";

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

// Helper to write to JSON database
const readDb = (): DbState => {
  if (!fs.existsSync(DB_FILE)) {
    // Generate initial state (Seed data)
    const initialState: DbState = {
      categories: [
        { id: "cat-1", name: "Construction", max_quota: 120 },
        { id: "cat-2", name: "Agriculture", max_quota: 90 },
        { id: "cat-3", name: "Manufacturing", max_quota: 75 },
        { id: "cat-4", name: "F&B Services", max_quota: 40 },
        { id: "cat-5", name: "Tech & Engineering", max_quota: 15 }
      ],
      companies: [
        { id: "co-1", name: "Global Pathway Holdings" },
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
        { id: "opt-14", field: "final_status", value: "Arrived" }
      ],
      users: [
        { username: "recruiter", password: "password", name: "Farid (Recruiter)", role: "recruiter" },
        { username: "engineer", password: "password", name: "Ir. Tan (Engineer)", role: "engineer" },
        { username: "ops", password: "password", name: "Sarah (Operations)", role: "ops" },
        { username: "admin", password: "password", name: "Admin (System Admin)", role: "admin" },
        { username: "viewer", password: "password", name: "Viewer (Dashboard Only)", role: "viewer" }
      ],
      workers: [
        {
          id: "w-1",
          name: "Mohammad Rahman",
          passport: "A81729381",
          category: "Construction",
          supply_company: "Global Pathway Holdings",
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
          supply_company: "Global Pathway Holdings",
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
          doc_upload_wa: "No",
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
          doc_upload_wa: "No",
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
          doc_upload_wa: "No",
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
        name: "Sanken Overseas Infrastructure Link MRT Project",
        client: "Malaysia MRT Corp",
        engineer_in_charge: "Ir. Tan (Engineer)",
        admin_coordinator: "Admin (System Admin)",
        location: "Kuala Lumpur Central Hub",
        contract_number: "MRT-2026-SANKEN-0982"
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf8");
    return initialState;
  }
  const content = fs.readFileSync(DB_FILE, "utf8");
  const db = JSON.parse(content) as DbState;
  if (!db.project_detail) {
    db.project_detail = {
      name: "Sanken Overseas Infrastructure Link MRT Project",
      client: "Malaysia MRT Corp",
      engineer_in_charge: "Ir. Tan (Engineer)",
      admin_coordinator: "Admin (System Admin)",
      location: "Kuala Lumpur Central Hub",
      contract_number: "MRT-2026-SANKEN-0982"
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  }
  return db;
};

const writeDb = (state: DbState) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf8");
  broadcastUpdate();
};

// SSE Active client connections for live updates
let clients: express.Response[] = [];

const broadcastUpdate = () => {
  clients.forEach((client) => {
    client.write("data: reload\n\n");
  });
};

async function startServer() {
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

    const createdWorkers: Worker[] = newWorkersData.map((w) => ({
      id: `w-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: w.name.trim(),
      passport: w.passport.trim().toUpperCase(),
      category: w.category,
      supply_company: w.supply_company,
      state: "pending",
      doc_upload_wa: "No",
      status: "Pending",
      bureau: "Pending",
      final_status: "Pending",
      created_at: new Date().toISOString()
    }));

    db.workers = [...createdWorkers, ...db.workers];
    writeDb(db);

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

    // Verify category quota
    const categoryName = worker.category;
    const category = db.categories.find((c) => c.name === categoryName);
    if (!category) {
      return res.status(400).json({ success: false, message: `Category "${categoryName}" does not exist` });
    }

    const activeCount = db.workers.filter((w) => w.category === categoryName && w.state === "active").length;
    if (activeCount >= category.max_quota) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve: Quota exhausted for category "${categoryName}" (${activeCount}/${category.max_quota} used)`
      });
    }

    // Perform approval action
    worker.sending_batch = sending_batch;
    worker.visa_doc_date = new Date().toISOString().split("T")[0];
    worker.state = "active";
    // Also reset last_updated on state activation
    worker.last_updated = new Date().toISOString().split("T")[0];

    db.workers[workerIndex] = worker;
    writeDb(db);

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

    // Trigger check for doc_upload_wa change -> autostamp
    if (updates.doc_upload_wa !== undefined && updates.doc_upload_wa !== currentWorker.doc_upload_wa) {
      currentWorker.last_updated = new Date().toISOString().split("T")[0];
    }

    // Apply updates
    const updatedWorker: Worker = {
      ...currentWorker,
      ...updates
    };

    // Rule: Recruiter Bureau pending lock check
    // If Admin2 sets status = "Visa Approved (xpact)", worker enters recruiter bureau queue.
    // If Admin2 sets status to other than Visa Approved, recruiter might not have permission, but backend allows updating.

    db.workers[workerIndex] = updatedWorker;
    writeDb(db);

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
    const newProjectDetail = req.body;
    const db = readDb();
    db.project_detail = newProjectDetail;
    writeDb(db);
    res.json({ success: true, project_detail: db.project_detail });
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
