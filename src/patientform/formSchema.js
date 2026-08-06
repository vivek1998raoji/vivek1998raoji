// ======================================================================
// Digital version of the Quantum ProCytronics MediClinic "Cold & Flu"
// patient intake / symptom checklist (Page 1 of the paper form).
//
// This file is the single source of truth for the whole intake experience:
// the patient form renders from it, and the doctor dashboard reads back
// against the same ids/labels so a saved submission is always meaningful.
// ======================================================================

// Clinic identity shown in the form header (matches the printed letterhead).
export const CLINIC = {
  campaign: '"KILL FLU EARLY, SAVE LIFE" WORLDWIDE CAMPAIGN',
  name: 'Quantum ProCytronics MediClinic',
  unit: '(A Unit of PabCyte Life Sciences Pvt. Ltd)',
  division: 'COLD & FLU DIVISION',
  doctor: 'Dr. Vikram Pabreja',
  qualification: 'M.B.B.S. — Consultant Physician',
  regd: 'DMC 108534 · HMC 23900 · Member: IMA, USA/Canada',
};

// Yes / No history questions that sit above the symptom checklist.
export const HISTORY_QUESTIONS = [
  { id: 'travel', label: 'History of Travel' },
  {
    id: 'substance',
    label: 'History of Tobacco / Alcohol / Recreational Substance',
  },
];

// The symptom checklist, grouped exactly like the paper form. Each item has a
// stable `id` (used as the storage key) and the `label` shown to the patient.
// A section flagged `others: true` shows a free-text box for "Others".
export const SECTIONS = [
  {
    id: 'fever',
    title: 'Fever',
    items: [
      { id: 'fever_chills', label: 'Fever with Chills' },
      { id: 'shivering', label: 'Shivering' },
      { id: 'fever_no_chills', label: 'Fever Without Chills' },
    ],
  },
  {
    id: 'eye_ent_upper',
    title: 'Eye, ENT & Upper Airways',
    others: true,
    items: [
      { id: 'eyes_pink_red', label: 'Pink / Red Eyes / Watery / Itchy / Burning' },
      { id: 'eyes_painful', label: 'Painful Eyes' },
      { id: 'eyes_swollen', label: 'Swollen Eyes' },
      { id: 'eyes_heavy', label: 'Heavy Eyes' },
      { id: 'cough', label: 'Cough' },
      { id: 'cough_dry', label: 'Dry' },
      { id: 'expectoration', label: 'Expectoration' },
      { id: 'sputum_colour', label: 'Yellow / Green / Blood / Blood Clots' },
      { id: 'blocked_ear', label: 'Blocked Ear' },
      { id: 'earache', label: 'Earache' },
      { id: 'ear_discharge', label: 'Ear Discharge' },
      { id: 'loss_of_smell', label: 'Loss of Smell' },
      { id: 'stuffy_nose', label: 'Stuffy Nose' },
      { id: 'running_nose', label: 'Running Nose' },
      { id: 'nasal_congestion', label: 'Nasal Congestion' },
      { id: 'post_nasal_drip', label: 'Post Nasal Drip' },
      { id: 'feeling_cold', label: 'Feeling Cold' },
      { id: 'sneezing', label: 'Sneezing' },
      { id: 'heavy_head', label: 'Heavy Head / Headache' },
      { id: 'itchy_throat', label: 'Itchy / Harsh Throat' },
      { id: 'throat_swallow', label: 'Pain / Difficulty in Throat while Swallowing' },
      { id: 'cant_speak', label: "Can't Speak" },
      { id: 'change_voice', label: 'Change in Voice' },
      { id: 'mucous_nose_mouth', label: 'Mucous from Nose or Mouth' },
      { id: 'sweating', label: 'Sweating' },
      { id: 'mouth_breathing', label: 'Mouth Breathing' },
    ],
  },
  {
    id: 'lower_airways',
    title: 'Lower Airways',
    others: true,
    items: [
      { id: 'wheeze', label: 'Wheeze' },
      { id: 'pain_ribs', label: 'Pain in Ribs' },
      { id: 'chest_pain', label: 'Chest Pain' },
      { id: 'sob', label: 'SOB (Shortness of Breath)' },
      { id: 'chest_congestion', label: 'Chest Congestion' },
      { id: 'deep_cough', label: 'Deep Cough / Chest Discomfort' },
    ],
  },
  {
    id: 'abdominal',
    title: 'Abdominal',
    others: true,
    items: [
      { id: 'nausea', label: 'Nausea' },
      { id: 'vomiting', label: 'Vomiting' },
      { id: 'diarrhea', label: 'Diarrhea' },
      { id: 'loss_appetite', label: 'Loss of Appetite' },
      { id: 'cramp_abdomen', label: 'Cramp / Pain Abdomen' },
      { id: 'altered_bowel', label: 'Altered Bowel Movements' },
      { id: 'not_formed_stools', label: 'Not Formed Stools' },
      { id: 'bleeding_piles', label: 'Bleeding / Dry Piles' },
      { id: 'bloating', label: 'Bloating' },
      { id: 'belching', label: 'Belching' },
      { id: 'loss_taste', label: 'Loss of Taste' },
      { id: 'gas', label: 'Gas' },
      { id: 'black_stools', label: 'Black Stools' },
    ],
  },
  {
    id: 'general',
    title: 'General / Others',
    others: true,
    items: [
      { id: 'dizziness', label: 'Dizziness' },
      { id: 'difficulty_arousal', label: 'Difficulty in Arousal' },
      { id: 'unsteadiness', label: 'Unsteadiness' },
      { id: 'fainting', label: 'Fainting' },
      { id: 'fatigue', label: 'Fatigue / Lethargy' },
      { id: 'burning_chest', label: 'Burning Behind Chest' },
      { id: 'severe_weakness', label: 'Severe Weakness' },
      { id: 'skin_rashes', label: 'Skin Rashes' },
      { id: 'loss_energy', label: 'Loss of Energy' },
      { id: 'anuria', label: 'No Urine x 8 hrs (Anuria)' },
      { id: 'oliguria', label: 'Less Urine (Oliguria)' },
      { id: 'uop_24', label: '24 Hr. UOP' },
      { id: 'body_ache', label: 'Body Ache' },
      { id: 'difficulty_sleeping', label: 'Difficulty in Sleeping' },
      { id: 'nocturnal_wheeze', label: 'Nocturnal Wheeze' },
      { id: 'epilepsy', label: 'Epilepsy / Seizures' },
    ],
  },
];

// Flat lookup: symptom id -> { label, sectionTitle }. Used by the dashboard to
// render a saved submission without re-walking the section tree each time.
export const SYMPTOM_LOOKUP = SECTIONS.reduce((acc, section) => {
  for (const item of section.items) {
    acc[item.id] = { label: item.label, section: section.title };
  }
  return acc;
}, {});

// Total number of checkbox symptoms (for the dashboard summary count).
export const TOTAL_SYMPTOMS = Object.keys(SYMPTOM_LOOKUP).length;
