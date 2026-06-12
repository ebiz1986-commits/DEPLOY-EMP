import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import * as XLSX from "xlsx";
import firebaseConfig from "../firebase-applet-config.json";
import { Worker } from "./types";

// Initialize Firebase safely without throwing double initialization errors
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add Google Drive file specific scope to manage files we created/edited in Drive
provider.addScope("https://www.googleapis.com/auth/drive.file");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth listener
export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get Google Access Token from Authentication response");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Checks if the master file already exists, and modifies/replaces its content (Overwrites media).
 * If it doesn't exist, it creates a new spreadsheet file in Google Drive.
 */
export const uploadOrUpdateMasterFile = async (
  workers: Worker[],
  accessToken: string
): Promise<{ success: boolean; id?: string; name: string; error?: string }> => {
  try {
    if (!accessToken) {
      throw new Error("Credentials token expired or not available");
    }

    // 1. Compile worker data matching the excel template
    const excelData = workers.map((w, idx) => ({
      "No.": idx + 1,
      "Worker Name": w.name,
      "Passport Number": w.passport,
      "Actual Job Category": w.category,
      "Supply Company": w.supply_company,
      "Pipeline State": w.state.toUpperCase(),
      "Visa Approved Date": w.visa_doc_date || "Pending",
      "Sending Batch": w.sending_batch || "None",
      "WhatsApp Checker": w.doc_upload_wa,
      "WhatsApp Status Date": w.doc_upload_wa_date ? new Date(w.doc_upload_wa_date).toLocaleDateString() : "N/A",
      "Last Stage Transition": w.last_updated || "N/A",
      "Visa Status": w.status,
      "Visa Status Date": w.status_date ? new Date(w.status_date).toLocaleDateString() : "N/A",
      "Bureau Placement": w.bureau,
      "Bureau Date": w.bureau_date ? new Date(w.bureau_date).toLocaleDateString() : "N/A",
      "Final Placement": w.final_status,
      "Final Status Date": w.final_status_date ? new Date(w.final_status_date).toLocaleDateString() : "N/A",
      "Database Creation": w.created_at ? new Date(w.created_at).toLocaleDateString() : "N/A"
    }));

    // 2. Generate worksheet and workbook using XLSX
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Masterfile Report");

    // 3. Write Excel to binary ArrayBuffer
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const fileData = new Uint8Array(wbout);

    const fileName = "Combined_Master_Records_Archive.xlsx";

    // 4. Query if a file with the same name already exists in the admin's drive space
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(fileName)}'+and+trashed=false`;
    const searchRes = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      throw new Error(`Google Drive API search failed: ${errText}`);
    }

    const searchData = await searchRes.json();
    const existingFiles = searchData.files || [];
    let fileId: string;

    if (existingFiles.length > 0) {
      // Overwrite/Update the existing file's contents
      fileId = existingFiles[0].id;
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      const updateRes = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: fileData,
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`Google Drive media update failed: ${errText}`);
      }
    } else {
      // Create a metadata entry for the file first
      const createMetaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fileName,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      });

      if (!createMetaRes.ok) {
        const errText = await createMetaRes.text();
        throw new Error(`Google Drive metadata creation failed: ${errText}`);
      }

      const metaData = await createMetaRes.json();
      fileId = metaData.id;

      // Upload the workbook binary package under the new file reference ID
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      const uploadRes = await fetch(uploadUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: fileData,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Google Drive media content upload failed: ${errText}`);
      }
    }

    return { success: true, id: fileId, name: fileName };
  } catch (err: any) {
    console.error("Google Drive synchronization error:", err);
    return {
      success: false,
      name: "Combined_Master_Records_Archive.xlsx",
      error: err?.message || String(err),
    };
  }
};
