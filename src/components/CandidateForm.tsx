import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { Candidate, POSITIONS, getPositionRubrics } from "../types";
import { migrateCandidateToHundredScale, calculateOverallScore } from "../utils";
import { ArrowLeft, Calendar, ClipboardCheck, Save, Award, BookOpen, Heart, Hammer, Camera, Upload, Trash2, User, Image, Loader2, ChevronDown, ChevronUp, AlertCircle, CheckCircle, HelpCircle, RefreshCw } from "lucide-react";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { SankenLogo } from "./SankenLogo";

interface CandidateFormProps {
  candidate?: Candidate | null; // If null, we are adding new
  positionId: 'bar_bender' | 'finishing_carpenter' | 'labour' | 'mason' | 'rigger' | 'shoutering_carpenter' | 'spray_painter' | 'survey_helper' | 'tile_mason' | 'wall_painter';
  activeProfile?: any;
  candidates?: Candidate[];
  darkMode?: boolean;
  onSave: (candidate: Candidate) => void;
  onCancel: () => void;
}

export default function CandidateForm({
  candidate,
  positionId,
  activeProfile,
  candidates = [],
  darkMode = false,
  onSave,
  onCancel,
}: CandidateFormProps) {
  // Load candidate and ensure values are scaled to 100-point representation
  const initialCandidate = candidate ? migrateCandidateToHundredScale(candidate) : null;

  // Base profile fields
  const [name, setName] = useState(initialCandidate?.name || "");
  const [referenceId, setReferenceId] = useState(initialCandidate?.referenceId || "");
  const [nicNumber, setNicNumber] = useState(initialCandidate?.nicNumber || "");
  const [passportNumber, setPassportNumber] = useState(initialCandidate?.passportNumber || "");
  const [photoUrl, setPhotoUrl] = useState(initialCandidate?.photoUrl || "");
  const [date, setDate] = useState(initialCandidate?.date || new Date().toISOString().split("T")[0]);
  const [assessor, setAssessor] = useState(initialCandidate?.assessor || activeProfile?.engineerName || "");
  const [projectName, setProjectName] = useState(initialCandidate?.projectName || activeProfile?.projectName || "Default Project");
  const [requirementCompany, setRequirementCompany] = useState(initialCandidate?.requirementCompany || "");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [contact, setContact] = useState(initialCandidate?.contact || "");

  // Camera & Upload states
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "requirement_companies"), async (snapshot) => {
      if (snapshot.empty) {
        // Seed default requirement companies if none exist in Firestore
        const defaultCompanies = [
          "KSJ",
          "Star Recruitment Solutions",
          "Apex Transit Ltd",
          "Oasis Labor Supply",
          "Horizon Group Malaysia"
        ];
        try {
          for (let i = 0; i < defaultCompanies.length; i++) {
            const compName = defaultCompanies[i];
            const compId = `comp-${i + 1}`;
            await setDoc(doc(db, "requirement_companies", compId), { name: compName });
          }
        } catch (err) {
          console.error("Failed to seed default requirement companies:", err);
        }
        return;
      }
      const list: { id: string; name: string }[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, name: doc.data().name });
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCompanies(list);
    }, (error) => {
      console.error("Error fetching requirement companies:", error);
      handleFirestoreError(error, OperationType.LIST, "requirement_companies");
    });
    return unsubscribe;
  }, []);

  const startCamera = async (currentMode: "user" | "environment" = facingMode) => {
    setCameraError(null);
    setUploadSuccess(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: currentMode } },
        audio: false
      });
      setStream(mediaStream);
      setCameraActive(true);
      setTimeout(() => {
        const videoElement = document.getElementById("candidate-video") as HTMLVideoElement;
        if (videoElement) {
          videoElement.srcObject = mediaStream;
        }
      }, 200);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setCameraError("Could not access camera. Please make sure camera permissions are enabled, or upload an image instead.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const compressImage = (dataUrl: string, maxWidth = 180, maxHeight = 180): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  };

  const handlePhotoUploadProcess = async (dataUrl: string) => {
    setUploading(true);
    setCameraError(null);
    setUploadSuccess(null);
    try {
      // Create a unique reference in Firebase Storage
      const filename = `candidates/profile_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadString(storageRef, dataUrl, "data_url");
      const downloadUrl = await getDownloadURL(storageRef);
      setPhotoUrl(downloadUrl);
      setUploadSuccess("Photo uploaded successfully to Cloud Storage!");
    } catch (err: any) {
      console.warn("Firebase Storage upload failed, falling back to local compressed storage:", err);
      try {
        // Compress the image to fit in Firestore safely
        const compressedBase64 = await compressImage(dataUrl);
        setPhotoUrl(compressedBase64);
        setUploadSuccess("Photo saved locally as compressed attachment.");
      } catch (fallbackErr) {
        console.error("Image compression failed:", fallbackErr);
        setPhotoUrl(dataUrl);
        setUploadSuccess("Photo saved as raw attachment.");
      }
    } finally {
      setUploading(false);
    }
  };

  const capturePhoto = () => {
    const videoElement = document.getElementById("candidate-video") as HTMLVideoElement;
    if (videoElement) {
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        stopCamera();
        handlePhotoUploadProcess(dataUrl);
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handlePhotoUploadProcess(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Section 1: Experience & Quals (Marks out of 100)

  const [s1_siteExperience, setS1SiteExperience] = useState<number | "">(
    initialCandidate && initialCandidate.s1_siteExperience ? initialCandidate.s1_siteExperience : ""
  );
  const [s1_nvqQualification, setS1NvqQualification] = useState<number | "">(
    initialCandidate && initialCandidate.s1_nvqQualification ? initialCandidate.s1_nvqQualification : ""
  );
  const [s1_recommendation, setS1Recommendation] = useState<number | "">(
    initialCandidate && initialCandidate.s1_recommendation ? initialCandidate.s1_recommendation : ""
  );

  // Section 2: Knowledge & Practice (Marks out of 100)
  const [s2_measurementReading, setS2MeasurementReading] = useState<number | "">(
    initialCandidate && initialCandidate.s2_measurementReading ? initialCandidate.s2_measurementReading : ""
  );
  const [s2_machineKnowledge, setS2MachineKnowledge] = useState<number | "">(
    initialCandidate && initialCandidate.s2_machineKnowledge ? initialCandidate.s2_machineKnowledge : ""
  );
  const [s2_methodology, setS2Methodology] = useState<number | "">(
    initialCandidate && initialCandidate.s2_methodology ? initialCandidate.s2_methodology : ""
  );
  const [s2_hseEquipment, setS2HseEquipment] = useState<number | "">(
    initialCandidate && initialCandidate.s2_hseEquipment ? initialCandidate.s2_hseEquipment : ""
  );

  // Section 3: Appearance & Attitude (Marks out of 100)
  const [s3_physicalAppearance, setS3PhysicalAppearance] = useState<number | "">(
    initialCandidate && initialCandidate.s3_physicalAppearance ? initialCandidate.s3_physicalAppearance : ""
  );
  const [s3_healthCondition, setS3HealthCondition] = useState<number | "">(
    initialCandidate && initialCandidate.s3_healthCondition ? initialCandidate.s3_healthCondition : ""
  );
  const [s3_characterAttitude, setS3CharacterAttitude] = useState<number | "">(
    initialCandidate && initialCandidate.s3_characterAttitude ? initialCandidate.s3_characterAttitude : ""
  );
  const [s3_extendedHours, setS3ExtendedHours] = useState<number | "">(
    initialCandidate && initialCandidate.s3_extendedHours ? initialCandidate.s3_extendedHours : ""
  );

  // Section 4: Practical Test & Remarks
  const [practicalTestRequired, setPracticalTestRequired] = useState<boolean>(
    initialCandidate ? initialCandidate.practicalTestRequired : false
  );
  const [notes, setNotes] = useState(initialCandidate?.notes || "");

  // Section toggle states (accordion dropdowns)
  const [s1Expanded, setS1Expanded] = useState(false);
  const [s2Expanded, setS2Expanded] = useState(false);
  const [s3Expanded, setS3Expanded] = useState(false);
  const [s4Expanded, setS4Expanded] = useState(false);

  // Automatically generate reference ID prefix for new candidates
  useEffect(() => {
    if (!candidate && !referenceId) {
      const prefix =
        positionId === 'bar_bender' ? 'BB' :
        positionId === 'finishing_carpenter' ? 'FC' :
        positionId === 'labour' ? 'LA' : 'MA';
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setReferenceId(`${prefix}-${randNum}`);
    }
  }, [candidate, positionId, referenceId]);

  // Position definitions and trade-specific rubrics
  const currentTrade = POSITIONS.find((p) => p.id === positionId);
  const rubrics = getPositionRubrics(positionId);

  // Safe number parser helper
  const num = (v: number | string | ""): number => {
    if (v === "" || isNaN(Number(v))) return 0;
    return Number(v);
  };

  // Live weighted contribution calculations
  const s1_siteExp_w = (num(s1_siteExperience) / 100) * 50;
  const s1_nvq_w = (num(s1_nvqQualification) / 100) * 30;
  const s1_rec_w = (num(s1_recommendation) / 100) * 20;
  const s1SubtotalRaw = s1_siteExp_w + s1_nvq_w + s1_rec_w; // out of 100
  const s1Subtotal = Math.round((s1SubtotalRaw * 0.5) * 10) / 10; // 50% section weight (out of 50)

  const s2_meas_w = (num(s2_measurementReading) / 100) * 20;
  const s2_mach_w = (num(s2_machineKnowledge) / 100) * 20;
  const s2_meth_w = (num(s2_methodology) / 100) * 50;
  const s2_hse_w = (num(s2_hseEquipment) / 100) * 10;
  const s2SubtotalRaw = s2_meas_w + s2_mach_w + s2_meth_w + s2_hse_w; // out of 100
  const s2Subtotal = Math.round((s2SubtotalRaw * 0.4) * 10) / 10; // 40% section weight (out of 40)

  const s3_phys_w = (num(s3_physicalAppearance) / 100) * 25;
  const s3_heal_w = (num(s3_healthCondition) / 100) * 25;
  const s3_char_w = (num(s3_characterAttitude) / 100) * 30;
  const s3_ext_w = (num(s3_extendedHours) / 100) * 20;
  const s3SubtotalRaw = s3_phys_w + s3_heal_w + s3_char_w + s3_ext_w; // out of 100
  const s3Subtotal = Math.round((s3SubtotalRaw * 0.1) * 10) / 10; // 10% section weight (out of 10)

  const estimatedOverallScore = Math.round((s1Subtotal + s2Subtotal + s3Subtotal) * 10) / 10;

  // Handles safe capping of user number inputs
  const handleNumberChange = (
    setter: (v: number | "") => void,
    valStr: string,
    maxVal: number
  ) => {
    if (valStr === "") {
      setter("");
      return;
    }
    let parsed = parseFloat(valStr);
    if (isNaN(parsed)) return;
    if (parsed < 0) parsed = 0;
    if (parsed > maxVal) parsed = maxVal;
    setter(parsed);
  };

  // Helper to compute automated status selection on submit
  const computeStatus = (
    overallScore: number,
    practicalRequired: boolean
  ): Candidate["status"] => {
    // If it's required, we don't know if they passed until updated elsewhere,
    // but the request is to ONLY ASK if it's required.
    // For now, if required is true, let's keep it "Pending Practical"
    if (practicalRequired) {
      return "Pending Practical";
    }
    if (overallScore >= 80) {
      return "Selected";
    }
    if (overallScore >= 55) {
      return "On Hold";
    }
    return "Rejected";
  };

  const handleSave = (isDraft: boolean) => {
    if (!name.trim()) {
      alert("Please enter the candidate's name.");
      return;
    }

    if (!isDraft && !nicNumber.trim()) {
      alert("Please enter the National Identity Card (NIC) Number to proceed.");
      return;
    }

    const calculatedStatus = isDraft
      ? "Draft"
      : computeStatus(estimatedOverallScore, practicalTestRequired);

    const savedCandidate: Candidate = {
      id: candidate?.id || `cand-${Date.now()}`,
      positionId,
      name: name.trim(),
      referenceId: referenceId.trim() || `REF-${Date.now()}`,
      nicNumber: nicNumber.trim(),
      passportNumber: passportNumber.trim(),
      photoUrl: photoUrl || "",
      date,
      assessor: assessor.trim() || "Assessor",
      projectName: projectName.trim() || "Default Project",
      requirementCompany: requirementCompany.trim(),
      contact: contact.trim() || "+94 77 000 0000",
      s1_siteExperience: num(s1_siteExperience),
      s1_nvqQualification: num(s1_nvqQualification),
      s1_recommendation: num(s1_recommendation),
      s2_measurementReading: num(s2_measurementReading),
      s2_machineKnowledge: num(s2_machineKnowledge),
      s2_methodology: num(s2_methodology),
      s2_hseEquipment: num(s2_hseEquipment),
      s3_physicalAppearance: num(s3_physicalAppearance),
      s3_healthCondition: num(s3_healthCondition),
      s3_characterAttitude: num(s3_characterAttitude),
      s3_extendedHours: num(s3_extendedHours),
      practicalTestRequired,
      notes: notes.trim(),
      status: calculatedStatus,
      isHundredScale: true,
    };

    onSave(savedCandidate);
  };

  const handleSubmitForm = (e: FormEvent) => {
    e.preventDefault();
    handleSave(false);
  };

  return (
    <div id="candidate-form-v2" className={`flex flex-col h-full animate-fadeIn overflow-hidden transition-colors duration-300 ${
      darkMode ? "bg-slate-950" : "bg-[#f8fafc]"
    }`}>
      
      {/* 1. Header: Back Arrow, Position title Assessment, Subtitle */}
      <div className={`px-6 pt-6 pb-4 flex items-start gap-4 shrink-0 border-b transition-colors duration-300 ${
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100/80"
      }`}>
        <button
          type="button"
          onClick={onCancel}
          className={`p-1.5 rounded-xl transition-colors cursor-pointer shrink-0 mt-0.5 ${
            darkMode ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-800"
          }`}
          title="Go back"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
        <div>
          <h1 className={`text-xl font-black tracking-tight font-sans transition-colors duration-300 ${
            darkMode ? "text-white" : "text-slate-950"
          }`}>
            {currentTrade?.title} Assessment
          </h1>
          <p className={`text-xs mt-1 font-medium leading-relaxed transition-colors duration-300 ${
            darkMode ? "text-slate-400" : "text-slate-500"
          }`}>
            Evaluate candidate competency across all criteria
          </p>
        </div>
      </div>

      {/* Form and Content container scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar pb-10">
        
        {/* 2. Total Score Card (Vibrant light blue gradient card matching logo) */}
        <div className="bg-gradient-to-r from-[#2ea1e5] via-[#4db7eb] to-[#1e88e5] rounded-[20px] p-5 text-white flex justify-between items-center shadow-md relative overflow-hidden">
          {/* Subtle background branding watermark */}
          <div className="absolute right-0 top-0 bottom-0 opacity-15 pointer-events-none translate-x-4 flex items-center">
            <SankenLogo className="w-32 h-32" />
          </div>
          
          <div className="relative z-10">
            <span className="text-sky-100 text-xs font-bold tracking-wider uppercase">Total Score</span>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-white font-sans">{estimatedOverallScore}</span>
              <span className="text-sky-100/80 text-sm font-semibold">/ 100</span>
            </div>
          </div>
          <div className="text-right relative z-10">
            <span className={`inline-block px-3 py-1 rounded-xl font-sans text-xs font-black tracking-wider uppercase border ${estimatedOverallScore > 59 ? "bg-emerald-500/30 text-white border-emerald-400" : "bg-rose-500/30 text-white border-rose-300"}`}>
              {estimatedOverallScore > 59 ? "PASS" : "FAIL"}
            </span>
            <p className="text-[9px] text-sky-100 mt-1 font-semibold">Score &gt; 59 to Pass</p>
          </div>
        </div>

        {/* 3. Candidate Information Card */}
        <div className={`rounded-[20px] p-6 space-y-4 shadow-3xs border transition-all duration-300 ${
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        }`}>
          <h2 className={`text-base font-extrabold tracking-tight border-b pb-2.5 transition-colors duration-300 ${
            darkMode ? "text-white border-slate-800" : "text-slate-900 border-slate-50"
          }`}>
            Candidate Information
          </h2>

          {/* Photo Attachment Widget */}
          <div className={`pb-3 border-b transition-colors duration-300 ${
            darkMode ? "border-slate-800" : "border-slate-50"
          }`}>
            <label className={`block text-xs font-extrabold tracking-tight mb-2 transition-colors duration-300 ${
              darkMode ? "text-slate-200" : "text-slate-800"
            }`}>
              Candidate Photo Attachment
            </label>
            
            {uploading ? (
              <div className={`w-full max-w-sm mx-auto p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center space-y-3 min-h-[144px] transition-colors duration-300 ${
                darkMode ? "border-indigo-900 bg-indigo-950/10" : "border-indigo-200 bg-indigo-50/20"
              }`}>
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <div>
                  <p className={`text-xs font-bold transition-colors ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Uploading Profile Picture...</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Please wait while the image is securely processed</p>
                </div>
              </div>
            ) : photoUrl ? (
              <div className={`relative w-36 h-36 mx-auto rounded-2xl overflow-hidden border-2 shadow-3xs transition-colors duration-300 group ${
                darkMode ? "border-indigo-950 bg-slate-800" : "border-indigo-100 bg-slate-100"
              }`}>
                <img referrerPolicy="no-referrer" src={photoUrl} alt="Candidate Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoUrl("");
                    setUploadSuccess(null);
                  }}
                  className="absolute bottom-2 right-2 p-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg shadow-sm transition-all cursor-pointer hover:scale-105"
                  title="Remove photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : cameraActive ? (
              <div className="relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-video flex flex-col justify-between">
                <video id="candidate-video" autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-2 px-4">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center space-x-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer flex items-center space-x-1"
                    title="Switch between front and back camera"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Switch</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={`w-full max-w-sm mx-auto p-4.5 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center space-y-3 transition-all duration-300 ${
                darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-slate-50/50"
              }`}>
                <div className={`p-3 rounded-2xl transition-all duration-300 ${
                  darkMode ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
                }`}>
                  <User className="w-6 h-6 stroke-[1.8]" />
                </div>
                <div>
                  <p className={`text-xs font-bold transition-colors ${darkMode ? "text-slate-300" : "text-slate-700"}`}>No Photo Attached</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Take a live photo or upload from device</p>
                </div>
                {cameraError && (
                  <p className={`text-[10px] p-2 rounded-lg max-w-xs transition-colors ${
                    darkMode ? "text-rose-400 bg-rose-950/20 border border-rose-900" : "text-rose-500 bg-rose-50 border border-rose-100"
                  }`}>{cameraError}</p>
                )}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center space-x-1 border ${
                      darkMode 
                        ? "bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-400 border-indigo-900/60" 
                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-150"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take Photo</span>
                  </button>
                  <label className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer flex items-center space-x-1 shadow-3xs ${
                    darkMode
                      ? "bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-700"
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                  }`}>
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
            
            {uploadSuccess && (
              <p className={`text-[10px] font-extrabold text-center mt-2.5 border py-1.5 px-3 rounded-lg max-w-sm mx-auto animate-fadeIn transition-colors duration-300 ${
                darkMode ? "text-emerald-400 bg-emerald-950/25 border-emerald-900/50" : "text-emerald-600 bg-emerald-50 border-emerald-100"
              }`}>
                {uploadSuccess}
              </p>
            )}

          </div>

          <div className="space-y-4">
            {/* Candidate Name */}
            <div>
              <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                darkMode ? "text-slate-200" : "text-slate-800"
              }`}>
                Candidate Name *
              </label>
              <input
                type="text"
                required
                placeholder="Enter candidate name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl text-sm transition-all font-semibold focus:outline-none focus:ring-1 ${
                  darkMode
                    ? "border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:ring-slate-700 focus:border-slate-700"
                    : "border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-slate-400 focus:border-slate-400"
                }`}
              />
            </div>

            {/* Separate ID Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* NIC Number */}
              <div>
                <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  NIC Number * <span className="text-[10px] text-indigo-400 font-bold">(Mandatory)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 199501234567 or 950123456V"
                  value={nicNumber}
                  onChange={(e) => setNicNumber(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm transition-all font-semibold focus:outline-none focus:ring-1 ${
                    darkMode
                      ? "border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:ring-slate-700 focus:border-slate-700"
                      : "border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-slate-400 focus:border-slate-400"
                  }`}
                />
                
                {nicNumber.trim().length >= 4 && (() => {
                  const trimmed = nicNumber.trim().toLowerCase();
                  const match = (candidates || [])
                    .filter(c => c.id !== initialCandidate?.id && c.nicNumber?.trim().toLowerCase() === trimmed)
                    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];

                  if (match) {
                    const score = calculateOverallScore(match);
                    const passed = score > 59;
                    return (
                      <div className="mt-2 text-[11px] font-bold leading-normal transition-all animate-fadeIn">
                        <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                          passed 
                            ? (darkMode ? "bg-emerald-950/20 text-emerald-300 border-emerald-900/60" : "bg-emerald-50 text-emerald-800 border-emerald-200/80")
                            : (darkMode ? "bg-rose-950/20 text-rose-300 border-rose-900/60" : "bg-rose-50 text-rose-800 border-rose-200/80")
                        }`}>
                          {passed ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-extrabold uppercase tracking-wide text-[9px] mb-0.5">
                              Previous Result: {passed ? "Pass" : "Fail"}
                            </p>
                            <p className={`${darkMode ? "text-slate-300" : "text-slate-600"} font-medium`}>
                              Candidate <span className={`font-bold ${darkMode ? "text-white" : "text-slate-800"}`}>{match.name}</span> previously scored <span className={`font-extrabold ${darkMode ? "text-white" : "text-slate-800"}`}>{score}%</span> on {match.date} for {POSITIONS.find(p => p.id === match.positionId)?.title || match.positionId}.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="mt-2 text-[11px] font-bold leading-normal transition-all animate-fadeIn">
                      <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                        darkMode ? "bg-blue-950/20 text-blue-300 border-blue-900/60" : "bg-blue-50/50 text-blue-800 border-blue-100/60"
                      }`}>
                        <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <div>
                          <p className="font-extrabold uppercase tracking-wide text-[9px] mb-0.5">Interview Status</p>
                          <p className={`${darkMode ? "text-blue-300" : "text-blue-700/90"} font-extrabold`}>First Time Interview</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Passport Number */}
              <div>
                <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  Passport Number <span className="text-[10px] text-slate-400 font-bold">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. N1234567"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm transition-all font-semibold focus:outline-none focus:ring-1 ${
                    darkMode
                      ? "border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:ring-slate-700 focus:border-slate-700"
                      : "border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-slate-400 focus:border-slate-400"
                  }`}
                />
              </div>
            </div>

            {/* Reference ID and Position info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  Assessment Ref ID
                </label>
                <input
                  type="text"
                  readOnly
                  value={referenceId}
                  className={`w-full px-4 py-3 border rounded-xl text-sm font-bold focus:outline-none select-none ${
                    darkMode
                      ? "border-slate-800 bg-slate-900/40 text-slate-400"
                      : "border-slate-100 bg-slate-50 text-slate-500"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  Position
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentTrade?.title || ""}
                  className={`w-full px-4 py-3 border rounded-xl text-sm font-bold focus:outline-none select-none ${
                    darkMode
                      ? "border-slate-800 bg-slate-900/40 text-slate-400"
                      : "border-slate-100 bg-slate-50 text-slate-500"
                  }`}
                />
              </div>
            </div>

            {/* Assessment Date */}
            <div>
              <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                darkMode ? "text-slate-200" : "text-slate-800"
              }`}>
                Assessment Date
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm transition-all font-semibold focus:outline-none focus:ring-1 appearance-none ${
                    darkMode
                      ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                      : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                  }`}
                />
                <Calendar className="w-4 h-4 text-slate-500 absolute right-4 pointer-events-none" />
              </div>
            </div>

            {/* Project Name, Assessor and Requirement Company */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  Project Name
                </label>
                <input
                  type="text"
                  readOnly
                  value={projectName}
                  className={`w-full px-4 py-3 border rounded-xl text-sm font-bold focus:outline-none select-none ${
                    darkMode
                      ? "border-slate-800 bg-slate-900/40 text-slate-400"
                      : "border-slate-100 bg-slate-50 text-slate-500"
                  }`}
                  title="Your active project is pre-selected and locked"
                />
              </div>

              <div>
                <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  Assessor Name
                </label>
                <input
                  type="text"
                  placeholder="Enter assessor name"
                  value={assessor}
                  onChange={(e) => setAssessor(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm transition-all font-semibold focus:outline-none focus:ring-1 ${
                    darkMode
                      ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700 focus:border-slate-700"
                      : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400 focus:border-slate-400"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-extrabold tracking-tight mb-1.5 transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  Requirement Company Name
                </label>
                <select
                  value={requirementCompany}
                  onChange={(e) => setRequirementCompany(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm transition-all font-semibold focus:outline-none focus:ring-1 ${
                    darkMode
                      ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700 focus:border-slate-700"
                      : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400 focus:border-slate-400"
                  }`}
                >
                  <option value="">-- Select Company --</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.name} className={darkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-800"}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Section 1: Experience & Qualification */}
        <div className={`rounded-[20px] border-l-[6px] border-l-blue-600 border-y border-r overflow-hidden shadow-3xs transition-all duration-300 ${
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80"
        }`}>
          <button
            type="button"
            onClick={() => setS1Expanded(!s1Expanded)}
            className={`w-full text-left px-5 py-4.5 flex justify-between items-center border-b transition-all duration-300 focus:outline-none cursor-pointer ${
              darkMode ? "bg-blue-950/20 border-slate-850 hover:bg-blue-950/30 text-white" : "bg-blue-50/40 border-slate-100 hover:bg-blue-50/75 text-slate-900"
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                darkMode ? "bg-blue-950/85 text-blue-400 border border-blue-900/40" : "bg-blue-100 text-blue-700"
              }`}>
                <Award className="w-4.5 h-4.5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <h3 className={`text-xs sm:text-sm font-black tracking-tight font-sans leading-snug transition-colors duration-300 ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}>
                  <span className="block">Section 1: Experience &</span>
                  <span className="inline-flex items-center gap-1 mt-0.5">
                    Quals
                    {s1Expanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 stroke-[3]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 stroke-[3]" />
                    )}
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex flex-col items-center shrink-0 ml-2">
              <div className={`w-14 py-2 rounded-xl flex flex-col items-center justify-center font-mono border transition-colors ${
                darkMode 
                  ? "bg-slate-950/85 border-slate-800/80 text-blue-400 shadow-3xs" 
                  : "bg-slate-100 border-slate-200 text-blue-800"
              }`}>
                <span className="text-[11px] font-black leading-none">{s1Subtotal} /</span>
                <span className="text-xs font-black leading-none mt-0.5">50</span>
              </div>
              <div className="flex flex-col items-center mt-1 text-[8px] font-black leading-tight uppercase tracking-wider text-slate-500">
                <span>50%</span>
                <span>WEIGHT</span>
              </div>
            </div>
          </button>

          {s1Expanded && (
            <div className="p-5 space-y-4">
              {/* Site Experience */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s1.s1_siteExperience.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 50
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s1_siteExperience)}/100) * 50 = {Math.round(s1_siteExp_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s1_siteExperience}
                    onChange={(e) => handleNumberChange(setS1SiteExperience, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>

              {/* NVQ Qualification */}
              <div className={`space-y-1.5 pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s1.s1_nvqQualification.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 30
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s1_nvqQualification)}/100) * 30 = {Math.round(s1_nvq_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s1_nvqQualification}
                    onChange={(e) => handleNumberChange(setS1NvqQualification, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>

              {/* 3rd Party Recommendation */}
              <div className={`space-y-1.5 pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s1.s1_recommendation.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 20
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s1_recommendation)}/100) * 20 = {Math.round(s1_rec_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s1_recommendation}
                    onChange={(e) => handleNumberChange(setS1Recommendation, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. Section 2: Knowledge & Practice */}
        <div className={`rounded-[20px] border-l-[6px] border-l-indigo-600 border-y border-r overflow-hidden shadow-3xs transition-all duration-300 ${
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80"
        }`}>
          <button
            type="button"
            onClick={() => setS2Expanded(!s2Expanded)}
            className={`w-full text-left px-5 py-4.5 flex justify-between items-center border-b transition-all duration-300 focus:outline-none cursor-pointer ${
              darkMode ? "bg-indigo-950/15 border-slate-850 hover:bg-indigo-950/25 text-white" : "bg-indigo-50/40 border-slate-100 hover:bg-indigo-50/75 text-slate-900"
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                darkMode ? "bg-indigo-950/85 text-indigo-400 border border-indigo-900/30" : "bg-indigo-100 text-indigo-700"
              }`}>
                <BookOpen className="w-4.5 h-4.5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <h3 className={`text-xs sm:text-sm font-black tracking-tight font-sans leading-snug transition-colors duration-300 ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}>
                  <span className="block">Section 2: Knowledge &</span>
                  <span className="inline-flex items-center gap-1 mt-0.5">
                    Practice
                    {s2Expanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 stroke-[3]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 stroke-[3]" />
                    )}
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex flex-col items-center shrink-0 ml-2">
              <div className={`w-14 py-2 rounded-xl flex flex-col items-center justify-center font-mono border transition-colors ${
                darkMode 
                  ? "bg-slate-950/85 border-slate-800/80 text-indigo-400 shadow-3xs" 
                  : "bg-slate-100 border-slate-200 text-indigo-800"
              }`}>
                <span className="text-[11px] font-black leading-none">{s2Subtotal} /</span>
                <span className="text-xs font-black leading-none mt-0.5">40</span>
              </div>
              <div className="flex flex-col items-center mt-1 text-[8px] font-black leading-tight uppercase tracking-wider text-slate-500">
                <span>40%</span>
                <span>WEIGHT</span>
              </div>
            </div>
          </button>

          {s2Expanded && (
            <div className="p-5 space-y-4">
              {/* Measurement Reading */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s2.s2_measurementReading.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 20
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s2_measurementReading)}/100) * 20 = {Math.round(s2_meas_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s2_measurementReading}
                    onChange={(e) => handleNumberChange(setS2MeasurementReading, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>

              {/* Knowledge in Machines */}
              <div className={`space-y-1.5 pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s2.s2_machineKnowledge.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 20
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s2_machineKnowledge)}/100) * 20 = {Math.round(s2_mach_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s2_machineKnowledge}
                    onChange={(e) => handleNumberChange(setS2MachineKnowledge, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>

              {/* Knowledge & Practise Methodology */}
              <div className={`space-y-1.5 pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s2.s2_methodology.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 50
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s2_methodology)}/100) * 50 = {Math.round(s2_meth_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s2_methodology}
                    onChange={(e) => handleNumberChange(setS2Methodology, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>

              {/* Knowledge & Practise with HSE */}
              <div className={`space-y-1.5 pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s2.s2_hseEquipment.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 10
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s2_hseEquipment)}/100) * 10 = {Math.round(s2_hse_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s2_hseEquipment}
                    onChange={(e) => handleNumberChange(setS2HseEquipment, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Section 3: Appearance & Attitude */}
        <div className={`rounded-[20px] border-l-[6px] border-l-amber-500 border-y border-r overflow-hidden shadow-3xs transition-all duration-300 ${
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80"
        }`}>
          <button
            type="button"
            onClick={() => setS3Expanded(!s3Expanded)}
            className={`w-full text-left px-5 py-4.5 flex justify-between items-center border-b transition-all duration-300 focus:outline-none cursor-pointer ${
              darkMode ? "bg-amber-950/10 border-slate-850 hover:bg-amber-950/20 text-white" : "bg-amber-50/40 border-slate-100 hover:bg-amber-50/75 text-slate-900"
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                darkMode ? "bg-amber-950/80 text-amber-400 border border-amber-900/30" : "bg-amber-100 text-amber-700"
              }`}>
                <Heart className="w-4.5 h-4.5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <h3 className={`text-xs sm:text-sm font-black tracking-tight font-sans leading-snug transition-colors duration-300 ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}>
                  <span className="block">Section 3: Appearance &</span>
                  <span className="inline-flex items-center gap-1 mt-0.5">
                    Attitude
                    {s3Expanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 stroke-[3]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 stroke-[3]" />
                    )}
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex flex-col items-center shrink-0 ml-2">
              <div className={`w-14 py-2 rounded-xl flex flex-col items-center justify-center font-mono border transition-colors ${
                darkMode 
                  ? "bg-slate-950/85 border-slate-800/80 text-amber-400 shadow-3xs" 
                  : "bg-slate-100 border-slate-200 text-amber-800"
              }`}>
                <span className="text-[11px] font-black leading-none">{s3Subtotal} /</span>
                <span className="text-xs font-black leading-none mt-0.5">10</span>
              </div>
              <div className="flex flex-col items-center mt-1 text-[8px] font-black leading-tight uppercase tracking-wider text-slate-500">
                <span>10%</span>
                <span>WEIGHT</span>
              </div>
            </div>
          </button>

          {s3Expanded && (
            <div className="p-5 space-y-4">
              {/* Physical Appearance & Fitness */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s3.s3_physicalAppearance.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 25
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s3_physicalAppearance)}/100) * 25 = {Math.round(s3_phys_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s3_physicalAppearance}
                    onChange={(e) => handleNumberChange(setS3PhysicalAppearance, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>

              {/* Health Condition */}
              <div className={`space-y-1.5 pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s3.s3_healthCondition.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 25
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s3_healthCondition)}/100) * 25 = {Math.round(s3_heal_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s3_healthCondition}
                    onChange={(e) => handleNumberChange(setS3HealthCondition, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>

              {/* Character & Attitude */}
              <div className={`space-y-1.5 pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s3.s3_characterAttitude.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 30
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s3_characterAttitude)}/100) * 30 = {Math.round(s3_char_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s3_characterAttitude}
                    onChange={(e) => handleNumberChange(setS3CharacterAttitude, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>

              {/* Ability to Work Extended Hours */}
              <div className={`space-y-1.5 pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold leading-normal transition-colors duration-300 ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  {rubrics.s3.s3_extendedHours.label}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-slate-800 text-slate-400" : "bg-[#f1f5f9] text-slate-600"
                  }`}>
                    Weight: 20
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded tracking-tight transition-colors ${
                    darkMode ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    Result: ({num(s3_extendedHours)}/100) * 20 = {Math.round(s3_ext_w * 10) / 10}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={s3_extendedHours}
                    onChange={(e) => handleNumberChange(setS3ExtendedHours, e.target.value, 100)}
                    className={`flex-1 px-4 py-3 border rounded-xl text-sm text-center font-bold transition-all focus:outline-none focus:ring-1 ${
                      darkMode
                        ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700"
                        : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                    }`}
                  />
                  <span className="text-slate-400 text-sm font-bold shrink-0">/ 100 marks</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 7. Section 4: Practical Test & Remarks */}
        <div className={`rounded-[20px] border-l-[6px] border-l-emerald-600 border-y border-r overflow-hidden shadow-3xs transition-all duration-300 ${
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80"
        }`}>
          <button
            type="button"
            onClick={() => setS4Expanded(!s4Expanded)}
            className={`w-full text-left px-5 py-4.5 flex justify-between items-center border-b transition-all duration-300 focus:outline-none cursor-pointer ${
              darkMode ? "bg-emerald-950/10 border-slate-850 hover:bg-emerald-950/20 text-white" : "bg-emerald-50/40 border-slate-100 hover:bg-emerald-50/75 text-slate-900"
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                darkMode ? "bg-emerald-950/80 text-emerald-400 border border-emerald-900/30" : "bg-emerald-100 text-emerald-700"
              }`}>
                <Hammer className="w-4.5 h-4.5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <h3 className={`text-xs sm:text-sm font-black tracking-tight font-sans leading-snug transition-colors duration-300 ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}>
                  <span className="block">Section 4: Practical Test &</span>
                  <span className="inline-flex items-center gap-1 mt-0.5">
                    Remarks
                    {s4Expanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 stroke-[3]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 stroke-[3]" />
                    )}
                  </span>
                </h3>
              </div>
            </div>
            {/* Center-aligned chevron block to match card visual spacing on right */}
            <div className="flex flex-col items-center shrink-0 ml-2 w-14">
              <div className={`p-1 rounded-lg ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                {s4Expanded ? (
                  <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                )}
              </div>
            </div>
          </button>

          {s4Expanded && (
            <div className="p-5 space-y-4">
              {/* Practical Test */}
              <div>
                <label className={`block text-xs font-bold leading-normal mb-1 transition-colors ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  Practical Test Status
                </label>
                <p className="text-[10px] text-slate-400 font-semibold tracking-tight mb-3">
                  Check if a practical field test is required
                </p>
                
                <div className="flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer select-none group py-1">
                    <input
                      type="checkbox"
                      checked={practicalTestRequired}
                      onChange={(e) => setS4Expanded(true) || setPracticalTestRequired(e.target.checked)}
                      className={`w-5 h-5 rounded border transition-colors cursor-pointer accent-blue-600 ${
                        darkMode ? "border-slate-800 bg-slate-950" : "border-slate-300 bg-white"
                      }`}
                    />
                    <div className={`text-sm font-extrabold transition-colors ${
                      darkMode ? "text-slate-200 group-hover:text-white" : "text-slate-800 group-hover:text-slate-950"
                    }`}>
                      Practical Test Required
                    </div>
                  </label>
                </div>
              </div>

              {/* Remarks */}
              <div className={`pt-4 border-t transition-colors duration-300 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <label className={`block text-xs font-bold mb-1.5 transition-colors ${
                  darkMode ? "text-slate-200" : "text-slate-800"
                }`}>
                  Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-1 transition-all font-medium resize-none ${
                    darkMode
                      ? "border-slate-800 bg-slate-950 text-slate-100 focus:ring-slate-700 placeholder-slate-600"
                      : "border-slate-200 bg-white text-slate-800 focus:ring-slate-400"
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* 9. Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Submit Assessment */}
          <button
            type="button"
            onClick={() => handleSave(false)}
            className={`w-full active:scale-98 py-4 rounded-[14px] flex items-center justify-center gap-2.5 text-sm font-bold transition-all cursor-pointer ${
              darkMode
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-900/20"
                : "bg-black hover:bg-zinc-900 text-white shadow-sm"
            }`}
          >
            <ClipboardCheck className="w-5 h-5 text-white stroke-[2.2]" />
            <span>Submit Assessment</span>
          </button>

          {/* Save as Draft */}
          <button
            type="button"
            onClick={() => handleSave(true)}
            className={`w-full active:scale-98 py-4 border rounded-[14px] flex items-center justify-center gap-2.5 text-sm font-bold transition-all cursor-pointer ${
              darkMode
                ? "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 shadow-3xs"
                : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-3xs"
            }`}
          >
            <Save className="w-5 h-5 text-slate-450 stroke-[2.2]" />
            <span>Save as Draft</span>
          </button>
        </div>

      </div>
    </div>
  );
}
