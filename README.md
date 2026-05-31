# Worker Deployment Tracker — Operational Documentation

A modern, high-end multi-user operational web application replacing the legacy Excel "Masterfile" used to track migrant workers through the visa-and-deployment pipeline.

## 🌟 Architecture Overview

This application of a full-stack architecture running a React + TypeScript frontend bound to a Node.js Express server utilizing real-time **Server-Sent Events (SSE)**. 

*   **Database Persistence**: Active state is preserved locally on the server in `db.json`.
*   **Real-time Synced updates**: All open instances/sessions dynamically sync using SSE when modifications arise anywhere, mimicking cloud realtime services.
*   **Role Enforcement**: Scope boundaries are gated at both the API level and the UI view level.

---

## 👥 Roles & Quick Sandbox Credentials

| Persona | Username | Passkey | Owned Action |
|---|---|---|---|
| **KSJ Recruiter** (Role 1) | `recruiter` | `password` | Fast bulk-adds registered workers, approves Bureau clearance |
| **Engineer Gate** (Role 2) | `engineer` | `password` | Approves Visa Sending Batches against active category quotas |
| **Ops Manager** (Role 3) | `ops` | `password` | Inline manages documentation, final bookings, and arrivals status |
| **System Admin** (Role 4) | `admin` | `password` | Fully configures Quotas, Lookups, supply companies, and credentials |
| **Executive Viewer** (Role 5) | `viewer` | `password` | Read-only analytics dashboard with SheetJS Excel Master Exporter |

---

## 🛠️ Tech Stack & Key Libraries
- **Vite & React 19**
- **Express Backend & Tsx execution module**
- **Tailwind CSS v4** with a luxury, warm humanist-editorial palette (terracotta, off-white, and charcoal)
- **Lucide Icons**
- **Motion/React** (for fluid slide view transitions)
- **SheetJS (xlsx)** for fully typed local Excel exports

---

## 🚀 Production Deployment Reference (Supabase + Vercel)

As part of the design specification to port this to hosted Supabase, the following steps are provided.

### 1. Database Schema (`schema.sql`)
Run the following structure inside the Supabase SQL Editor:

```sql
-- Create Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    max_quota INTEGER NOT NULL DEFAULT 100
);

-- Create Supply Companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

-- Create Dropdown Lookups Option List
CREATE TABLE dropdown_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE (field, value)
);

-- Create Worker Records main log
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    passport TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL REFERENCES categories(name) ON UPDATE CASCADE,
    supply_company TEXT NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
    sending_batch TEXT,
    visa_doc_date DATE,
    state TEXT CHECK (state IN ('pending', 'active')) DEFAULT 'pending',
    doc_upload_wa TEXT CHECK (doc_upload_wa IN ('Yes', 'No')) DEFAULT 'No',
    last_updated DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Pending',
    bureau TEXT DEFAULT 'Pending',
    final_status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Active Vacancy count helper view
CREATE VIEW category_vacancy AS 
SELECT 
    c.id,
    c.name,
    c.max_quota,
    COUNT(w.id) FILTER (WHERE w.state = 'active') as active_count,
    GREATEST(0, c.max_quota - COUNT(w.id) FILTER (WHERE w.state = 'active')) as remaining
FROM categories c
LEFT JOIN workers w ON w.category = c.name
GROUP BY c.id, c.name, c.max_quota;

-- Auto-Stamp Trigger for Document Changes
CREATE OR REPLACE FUNCTION stamp_doc_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.doc_upload_wa IS DISTINCT FROM OLD.doc_upload_wa THEN
        NEW.last_updated := CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stamp_doc
BEFORE UPDATE ON workers
FOR EACH ROW EXECUTE FUNCTION stamp_doc_change();
```

### 2. Live Supabase Realtime Authorization (RLS)
To secure roles, ensure Row Level Security is active and write security policies utilizing token metadata:

```sql
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Recruiter Policy: Read all, update bureau, insert new pending
CREATE POLICY recruiter_access ON workers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (
        (auth.jwt() -> 'user_metadata' ->> 'role' = 'recruiter') 
        AND state = 'pending'
    );
```

### 3. Vercel Hosting Variables
Map connection details in Vercel settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
