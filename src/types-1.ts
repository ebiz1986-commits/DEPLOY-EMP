export interface Candidate {
  id: string;
  positionId: 'bar_bender' | 'finishing_carpenter' | 'labour' | 'mason' | 'rigger' | 'shoutering_carpenter' | 'spray_painter' | 'survey_helper' | 'tile_mason' | 'wall_painter';
  name: string;
  referenceId: string;
  nicNumber?: string;
  passportNumber?: string;
  photoUrl?: string;
  date: string;
  assessor: string;
  contact: string;
  projectName?: string; // Associated construction project name
  requirementCompany?: string; // Requirement company name
  
  // Section 1: Experience & Qualification (50% weight total)
  s1_siteExperience: number; // Max 50
  s1_nvqQualification: number; // Max 30
  s1_recommendation: number; // Max 20
  
  // Section 2: Knowledge & Practice (40% weight total)
  s2_measurementReading: number; // Max 20
  s2_machineKnowledge: number; // Max 20
  s2_methodology: number; // Max 50
  s2_hseEquipment: number; // Max 10
  
  // Section 3: Appearance & Attitude (10% weight total)
  s3_physicalAppearance: number; // Max 25
  s3_healthCondition: number; // Max 25
  s3_characterAttitude: number; // Max 30
  s3_extendedHours: number; // Max 20
  
  // Section 4: Practical Test
  practicalTestRequired: boolean;
  
  // General Remarks
  notes: string;
  status: 'Selected' | 'On Hold' | 'Rejected' | 'Pending Practical' | 'Draft';
  isHundredScale?: boolean;
  sentToEngineer?: boolean;
}

export interface ScoreItemConfig {
  label: string;
  maxScore: number;
  weightPercent: number;
  description: string;
}

export interface PositionInfo {
  id: 'bar_bender' | 'finishing_carpenter' | 'labour' | 'mason' | 'rigger' | 'shoutering_carpenter' | 'spray_painter' | 'survey_helper' | 'tile_mason' | 'wall_painter';
  title: string;
  description: string;
  shortDescription: string;
  iconName: 'wrench' | 'hammer' | 'hard-hat' | 'building' | 'anchor' | 'layout' | 'paint-bucket' | 'compass' | 'grid' | 'brush';
  colorClass: string;
}

export const POSITIONS: PositionInfo[] = [
  {
    id: 'bar_bender',
    title: 'Bar Bender',
    description: 'Rebar bending and steel reinforcement operations',
    shortDescription: 'Rebar bending and steel reinforc...',
    iconName: 'wrench',
    colorClass: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    id: 'finishing_carpenter',
    title: 'Finishing Carpenter',
    description: 'High-precision wood joinery, finishing, and trim carpentry',
    shortDescription: 'Finishing and trim carpentry work',
    iconName: 'hammer',
    colorClass: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    id: 'labour',
    title: 'Labour',
    description: 'General construction manual work, site preparation, and hauling',
    shortDescription: 'General construction labour',
    iconName: 'hard-hat',
    colorClass: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  {
    id: 'mason',
    title: 'Mason',
    description: 'Bricklaying, stone blockwork, cementing, and plastering masonry',
    shortDescription: 'Brickwork and masonry',
    iconName: 'building',
    colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    id: 'rigger',
    title: 'Rigger',
    description: 'Rigging and heavy lifting operations',
    shortDescription: 'Rigging and heavy lifting',
    iconName: 'anchor',
    colorClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    id: 'shoutering_carpenter',
    title: 'Shoutering Carpenter',
    description: 'Concrete shuttering and formwork construction',
    shortDescription: 'Shuttering and formwork construction',
    iconName: 'layout',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'spray_painter',
    title: 'Spray Painter',
    description: 'Surface preparation and spray painting applications',
    shortDescription: 'Surface coating and spray painting',
    iconName: 'paint-bucket',
    colorClass: 'bg-rose-50 text-rose-600 border-rose-100',
  },
  {
    id: 'survey_helper',
    title: 'Survey Helper',
    description: 'Land surveying assistance and layout measurement support',
    shortDescription: 'Surveying and layout support',
    iconName: 'compass',
    colorClass: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  },
  {
    id: 'tile_mason',
    title: 'Tile Mason',
    description: 'Tile cutting, surface preparation, laying, and grouting',
    shortDescription: 'Tiling and surface finishing',
    iconName: 'grid',
    colorClass: 'bg-teal-50 text-teal-600 border-teal-100',
  },
  {
    id: 'wall_painter',
    title: 'Wall Painter',
    description: 'Wall surface preparation, plaster repair, and roller/brush painting',
    shortDescription: 'Wall finishing and painting',
    iconName: 'brush',
    colorClass: 'bg-orange-50 text-orange-600 border-orange-100',
  }
];

export function getPositionRubrics(positionId: string) {
  const isCarpenter = positionId === 'finishing_carpenter';
  const isLabour = positionId === 'labour';
  const isMason = positionId === 'mason';
  const isRigger = positionId === 'rigger';
  const isShoutering = positionId === 'shoutering_carpenter';
  const isSprayPainter = positionId === 'spray_painter';
  const isSurveyHelper = positionId === 'survey_helper';
  const isTileMason = positionId === 'tile_mason';
  const isWallPainter = positionId === 'wall_painter';
  
  // Section 2 custom max scores and weights
  let maxScores = {
    measurementReading: 20,
    machineKnowledge: 20,
    methodology: 50,
    hseEquipment: 10
  };

  if (isSprayPainter || isSurveyHelper) {
    maxScores = {
      measurementReading: 20,
      machineKnowledge: 20,
      methodology: 40,
      hseEquipment: 20
    };
  }

  return {
    s1: {
      s1_siteExperience: {
        label: isCarpenter 
          ? "Woodwork Site Experience" 
          : isLabour 
            ? "General Site Exposure & Track Record" 
            : isMason 
              ? "Masonry / Blockwork Site Experience" 
              : "Site Experience (KSJ/SO/Overseas/Worked sites)",
        maxScore: 50,
        weightPercent: 25.0,
        description: isCarpenter 
          ? "Years on trim/veneer installs, cabinetry fitting, and complex residential/commercial sites."
          : isLabour 
            ? "Familiarity with active construction environment, excavation, sorting, and manual team tasks."
            : isMason 
              ? "Experience in building brick walls, cement pouring, structural plastering, and block layering."
              : isRigger
                ? "Experience in rigging setups, crane operations, slinging, heavy lifting, and material hoisting safely."
                : isShoutering
                  ? "Experience in structural formwork, shuttering assembly, timber framing, and blueprint reading."
                  : isSprayPainter
                    ? "Experience in industrial spray painting, surface coatings, paint mixing, and area preparation."
                    : isSurveyHelper
                      ? "Experience in assisting surveyor, handling leveling staffs, prisms, GPS instruments, and layout marks."
                      : isTileMason
                        ? "Experience in high-quality tile installations, precision cutting, grouting, and pattern layout."
                        : isWallPainter
                          ? "Experience in interior/exterior wall painting, surface preparation, putty finishing, and primer coats."
                          : "Evaluates years and depth of experience across key projects, overseas assignments, and specific relevant sites."
      },
      s1_nvqQualification: {
        label: isLabour ? "Basic Safety Induction / CSC Card" : "NVQ Qualification",
        maxScore: 30,
        weightPercent: 15.0,
        description: isLabour
          ? "National safety certificates, site induction checklist accuracy, and basic labor licenses."
          : "National Vocational Qualification level alignment, trade certification verification, and verified training records."
      },
      s1_recommendation: {
        label: "3rd Party Recommendation",
        maxScore: 20,
        weightPercent: 10.0,
        description: isCarpenter 
          ? "Reference letters from senior carpenters, interior fit-out leads, or master craftsmen."
          : isLabour
            ? "Vouching from shift supervisors, contractors, or site logistics managers."
            : isMason
              ? "Vouching by principal civil engineers or veteran head masons."
              : "Strength of professional references and direct contractor recommendations."
      }
    },
    s2: {
      s2_measurementReading: {
        label: isCarpenter 
          ? "Precision Measurements & Detail Reading" 
          : isLabour 
            ? "Tape Measuring & Sorting Literacy" 
            : isMason 
              ? "Plumb, Level, & Ratio Scale Literacy"
              : isRigger
                ? "Swimming & Diving skill"
                : isShoutering
                  ? "Measurement Reading (mm) & Drawing literacy"
                  : isSprayPainter
                    ? "Area Coverage"
                    : isSurveyHelper
                      ? "Measurement Reading (mm) & Drawing literacy"
                      : isTileMason
                        ? "Measurement Reading (mm)"
                        : isWallPainter
                          ? "Area coverage"
                          : "Measurement Reading (mm) & Drawing Literacy",
        maxScore: maxScores.measurementReading,
        weightPercent: maxScores.measurementReading * 0.4,
        description: isCarpenter
          ? "Reading detail drawings, executing millimeter cuts without errors, and matching wood veneers."
          : isLabour
            ? "Reading dual-unit tapes, basic material sorting by specifications, and simple stock logs."
            : isMason
              ? "Reading level indicators, matching layout sketches, measuring plaster thickness, and water ratios."
              : isRigger
                ? "Ability to perform water-based tasks, emergency rescue, and underwater rigging operations."
                : isSprayPainter
                  ? "Estimating paint requirements, coverage ratios, uniform thickness control, and material estimation."
                  : isSurveyHelper
                    ? "Reading leveling tapes, metric staffs, contour lines, and converting drawing coordinates."
                    : isTileMason
                      ? "Estimating tile alignments, measuring joint widths, matching layout drawings, and pattern cutting."
                      : isWallPainter
                        ? "Calculating wall surface area, paint consumption per square meter, water/solvent mixing ratio."
                        : "Ability to read construction blueprints, structural drawings, and perform precise metric measurements in millimeters."
      },
      s2_machineKnowledge: {
        label: isCarpenter 
          ? "Power Saw & Routing Machinery" 
          : isLabour 
            ? "Hauling & Compactor Machinery" 
            : isMason 
              ? "Cement Mixers & Wet Cutter Machinery"
              : isRigger
                ? "Knowledge in Tools"
                : isShoutering
                  ? "Knowledge in Tools"
                  : isSprayPainter
                    ? "Knowledge in Tools"
                    : isSurveyHelper
                      ? "Knowledge in Tools (TL/TS/LM)"
                      : isTileMason
                        ? "Knowledge in Tools"
                        : isWallPainter
                          ? "Knowledge in Tools"
                          : "Knowledge in Machines",
        maxScore: maxScores.machineKnowledge,
        weightPercent: maxScores.machineKnowledge * 0.4,
        description: isCarpenter
          ? "Safe setups and operations of table saws, routing jigs, miter saws, and specialized sanders."
          : isLabour
            ? "Operation of standard motorized wheelbarrows, mechanical compactors, and basic power drills."
            : isMason
              ? "Safe startup of mechanical drum mixers, grout pumps, and masonry wet-stone cutters."
              : isRigger
                ? "Use and inspection of shackles, wire ropes, slings, chain blocks, and pulleys."
                : isShoutering
                  ? "Safe use of table saws, circular hand saws, hammering tools, framing squares, and laser levels."
                  : isSprayPainter
                    ? "Handling of air compressors, pneumatic spray guns, high-pressure hoses, and paint mixing mixers."
                    : isSurveyHelper
                      ? "Basic care, setup, and reading of Theodolite Levels (TL), Total Stations (TS), and Laser Measures (LM)."
                      : isTileMason
                        ? "Usage of manual tile cutters, wet tile saw machinery, spacers, rubber mallets, and float trowels."
                        : isWallPainter
                          ? "Use of paint mixers, roller extension rods, high-quality brushes, sandpaper holders, and scrapers."
                          : "Familiarity, operation, and safety standards for benders, cutters, and reinforcement fabrication machinery."
      },
      s2_methodology: {
        label: isCarpenter 
          ? "Wood Joinery & Veneer Methodology" 
          : isLabour 
            ? "Manual Handling & Digging Methods" 
            : isMason 
              ? "Brickwork Bonding & Mortar Ratios"
              : "Knowledge & Practice Methodology in Construction",
        maxScore: maxScores.methodology,
        weightPercent: maxScores.methodology * 0.4,
        description: isCarpenter
          ? "Hands-on mastery of mortise & tenon, dovetails, edge-bandings, door frames, and trim alignment."
          : isLabour
            ? "Stance techniques for lifting bags, trenching, waste sorting, scaffolding assembly support."
            : isMason
              ? "Laying English/Flemish brick bonds, trowel work, joint spacing, rendering, and block alignments."
              : isRigger
                ? "Standard construction rigging procedures, lifting plans, safe hand signaling, hoist operations."
                : isShoutering
                  ? "Erection of concrete formwork, wall shutters, columns, slabs, and beam formworks safely."
                  : isSprayPainter
                    ? "Surface preparation, grinding, cleaning, filler application, spray guns configuration, and thickness controls."
                    : isSurveyHelper
                      ? "Setting out benchmarks, maintaining visual sight lines, transferring datum levels, and drawing coordinate layout."
                      : isTileMason
                        ? "Surface levelling, adhesive mixing ratios, uniform glue comb spreading, tile setting, and grouting finish."
                        : isWallPainter
                          ? "Wall surface cleaning, crack/hole filling, sanding, undercoat/primer application, and topcoat uniform roll layering."
                          : "Expertise in standard bar bending schedules, reinforcement anchoring, overlapping, and structural joint techniques."
      },
      s2_hseEquipment: {
        label: isCarpenter 
          ? "Dust-Extraction & Blade-Guard Safety" 
          : isLabour 
            ? "Safety Signs & Lift-Stance Safety" 
            : isMason 
              ? "Dust-Inhalation & Scaffold Safety"
              : isSprayPainter
                ? "HSE & Working at Height"
                : isSurveyHelper
                  ? "HSE & Swimming/Diving"
                  : "Knowledge & Practice with HSE Equipments",
        maxScore: maxScores.hseEquipment,
        weightPercent: maxScores.hseEquipment * 0.4,
        description: isCarpenter
          ? "Strict compliance with wood dust masks, safety goggles, and blade-guard lockouts."
          : isLabour
            ? "Correct utilization of high-vis vests, steel-toed boots, helmet, and lifting belts."
            : isMason
              ? "Compliance with respiratory silica masks, safety boots, and secure high-scaffolding walks."
              : isRigger
                ? "Strict usage of full-body harnesses, lanyard tie-offs, safety nets, and fall arresters."
                : isShoutering
                  ? "Use of protective goggles, ear plugs, safe scaffold walking, and high-altitude harness tying."
                  : isSprayPainter
                    ? "Safe operations at heights, scaffolding safety, use of respiratory paint filters/gas masks, and harness tie-offs."
                    : isSurveyHelper
                      ? "Water safety, swimming qualifications for marine/wet excavations, high-visibility vest rules, and heavy vehicle awareness."
                      : isTileMason
                        ? "Use of knee protective pads, safety goggles during cutting, respiratory dust masks, and gloves."
                        : isWallPainter
                          ? "Scaffolding safety walks, paint dust inhalation masks, safety eyewear, and safe ladder handling."
                          : "Adherence to Health, Safety, and Environment protocols, and correct usage of personal protective equipment."
      }
    },
    s3: {
      s3_physicalAppearance: {
        label: "Physical Appearance & Fitness",
        maxScore: 25,
        weightPercent: 2.5,
        description: isCarpenter
          ? "Steady hand-eye control, capacity to lift custom doors, and balance on ladders."
          : isLabour
            ? "High lifting limits (25kg+), consistent muscle stamina, and ability to load/unload heavy vehicles."
            : isMason
              ? "Strong core strength for lifting clay/concrete bricks and repetitive bending-troweling motions."
              : "Physical capability to handle standard trade tasks, lift tools, and work under demanding site conditions."
      },
      s3_healthCondition: {
        label: "Health Condition",
        maxScore: 25,
        weightPercent: 2.5,
        description: isCarpenter
          ? "Excellent visual acuity and absence of chronic wood dust respiratory allergies."
          : isLabour
            ? "High cardiovascular stamina, clear joint flexibility, and thermal resilience under heat/rain."
            : isMason
              ? "Healthy respiratory profile and excellent hand-joint flexibility (avoiding carpal stress)."
              : "General health assessments, stamina levels, and absence of chronic physical limitations."
      },
      s3_characterAttitude: {
        label: "Character & Attitude",
        maxScore: 30,
        weightPercent: 3.0,
        description: "Discipline, respect for safety orders, team collaboration, and professional work ethic."
      },
      s3_extendedHours: {
        label: "Ability to Work Extended Hours",
        maxScore: 20,
        weightPercent: 2.0,
        description: isLabour
          ? "Willingness to support night deliveries, heavy cleanup sessions, or tight deadlines."
          : isMason
            ? "Availability to continue work until cement sets or brick rows reach locking joints."
            : "Willingness and stamina to support late sessions, tight project deadlines, and shift extensions."
      }
    }
  };
}

export interface UserProfile {
  id: string; // Composite doc ID: email_project (lowercased/slugified)
  email: string;
  password?: string;
  role: string;
  projectName?: string;
  engineerName?: string;
  createdAt?: string;
}
