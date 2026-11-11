/* =========================================================
   IU CGPA Calculator – editable data file
   Faculty / Department / Degree / Hall lists live here.
   Edit freely: the app reads everything from this object.
   ========================================================= */
const IU = {
  universityName: "Islamic University",
  universityPlace: "Kushtia-Jhenidah, Bangladesh",
  logo: "assets/logo.png",

  /* ---- Faculties & departments (n = full name, a = short code) ---- */
  faculties: [
    { id: "theology", name: "Faculty of Theology and Islamic Studies", departments: [
      { n: "Al-Quran and Islamic Studies", a: "AQIS" },
      { n: "Al-Hadith and Islamic Studies", a: "AHIS" },
      { n: "Comparative Tafsir", a: "CT" },
      { n: "As-Sirah An-Nabawiyyah", a: "ASN" }
    ]},
    { id: "comparative", name: "Faculty of Islamic and Comparative Religion", departments: [
      { n: "Dawah and Islamic Studies", a: "DIS" },
      { n: "Comparative Religion", a: "CR" },
      { n: "Muslim Philosophy", a: "MP" },
      { n: "Aqidah and Ideology", a: "AI" }
    ]},
    { id: "engineering", name: "Faculty of Engineering and Technology", departments: [
      { n: "Electrical and Electronic Engineering", a: "EEE" },
      { n: "Computer Science and Engineering", a: "CSE" },
      { n: "Applied Chemistry and Chemical Engineering", a: "ACCE" },
      { n: "Information and Communication Technology", a: "ICT" },
      { n: "Biomedical Engineering", a: "BME" }
    ]},
    { id: "biological", name: "Faculty of Biological Sciences", departments: [
      { n: "Biotechnology and Genetic Engineering", a: "BTGE" },
      { n: "Applied Nutrition and Food Technology", a: "ANFT" },
      { n: "Pharmacy", a: "PHAR" }
    ]},
    { id: "sciences", name: "Faculty of Sciences", departments: [
      { n: "Mathematics", a: "MATH" },
      { n: "Statistics and Data Science", a: "SDS" },
      { n: "Environmental Science and Geography", a: "GSE" },
      { n: "Physical Education and Sports Science", a: "PESS" }
    ]},
    { id: "business", name: "Faculty of Business Administration", departments: [
      { n: "Accounting and Information Systems", a: "AIS" },
      { n: "Management", a: "MGT" },
      { n: "Finance and Banking", a: "FAB" },
      { n: "Marketing", a: "MKT" },
      { n: "Human Resource Management", a: "HRM" },
      { n: "Tourism and Hospitality Management", a: "THM" }
    ]},
    { id: "arts", name: "Faculty of Arts", departments: [
      { n: "Arabic Language and Literature", a: "ALL" },
      { n: "Bengali", a: "BNG" },
      { n: "English", a: "ENG" },
      { n: "Islamic History and Culture", a: "IHC" },
      { n: "Fine Arts", a: "FA" }
    ]},
    { id: "social", name: "Faculty of Social Sciences", departments: [
      { n: "Economics", a: "ECO" },
      { n: "Public Administration", a: "PA" },
      { n: "Political Science", a: "PS" },
      { n: "Folklore and Social Studies", a: "FSS" },
      { n: "Development Studies", a: "DS" },
      { n: "Social Welfare", a: "SW" },
      { n: "Communication and Multimedia Journalism", a: "CMJ" }
    ]},
    { id: "law", name: "Faculty of Law", departments: [
      { n: "Law", a: "LAW" },
      { n: "Al-Fiqh and Law", a: "AFL" },
      { n: "Law and Land Administration", a: "LLA" }
    ]}
  ],

  /* ---- Degrees ----
     level: bachelor | master | research
     full : text printed on the marksheet                      */
  degrees: [
    { group: "Bachelor", items: [
      { id: "ba-hons",   label: "B.A. (Honours)",                full: "Bachelor of Arts (Honours)",            level: "bachelor" },
      { id: "bss-hons",  label: "B.S.S. (Honours)",              full: "Bachelor of Social Science (Honours)",  level: "bachelor" },
      { id: "bsc-hons",  label: "B.Sc. (Honours)",               full: "Bachelor of Science (Honours)",         level: "bachelor" },
      { id: "bsc-engg",  label: "B.Sc. in Engineering",          full: "Bachelor of Science in Engineering",    level: "bachelor" },
      { id: "bba",       label: "B.B.A.",                        full: "Bachelor of Business Administration",   level: "bachelor" },
      { id: "bpharm",    label: "B.Pharm (Honours)",             full: "Bachelor of Pharmacy (Honours)",        level: "bachelor" },
      { id: "llb",       label: "LL.B. (Honours)",               full: "Bachelor of Laws (Honours)",            level: "bachelor" },
      { id: "btis",      label: "BTIS (Honours)",                full: "Bachelor of Theology and Islamic Studies (Honours)", level: "bachelor" },
      { id: "bicr",      label: "BICR (Honours)",                full: "Bachelor of Islam and Comparative Religion (Honours)", level: "bachelor" }
    ]},
    { group: "Master's", items: [
      { id: "ma",        label: "M.A.",                          full: "Master of Arts",                        level: "master" },
      { id: "mss",       label: "M.S.S.",                        full: "Master of Social Science",              level: "master" },
      { id: "msc",       label: "M.Sc.",                         full: "Master of Science",                     level: "master" },
      { id: "msc-engg",  label: "M.Sc. in Engineering",          full: "Master of Science in Engineering",      level: "master" },
      { id: "mba",       label: "M.B.A.",                        full: "Master of Business Administration",     level: "master" },
      { id: "mpharm",    label: "M.Pharm",                       full: "Master of Pharmacy",                    level: "master" },
      { id: "llm",       label: "LL.M.",                         full: "Master of Laws",                        level: "master" },
      { id: "mtis",      label: "MTIS",                          full: "Master of Theology and Islamic Studies", level: "master" },
      { id: "micr",      label: "MICR",                          full: "Master of Islam and Comparative Religion", level: "master" }
    ]},
    { group: "Research", items: [
      { id: "mphil",     label: "M.Phil",                        full: "Master of Philosophy",                  level: "research" },
      { id: "phd",       label: "Ph.D.",                         full: "Doctor of Philosophy",                  level: "research" }
    ]},
    { group: "Other", items: [
      { id: "other",     label: "Other (type manually)",         full: "",                                      level: "bachelor" }
    ]}
  ],

  /* ---- Halls ---- */
  halls: [
    "Saddam Hussein Hall",
    "Shahid Ziaur Rahman Hall",
    "Shah Azizur Rahman Hall",
    "Lalon Shah Hall",
    "Shahid Anas Hall",
    "Abrar Fahad Hall",
    "Khaleda Zia Hall",
    "Ummul Muminin Ayesha Siddiqa Hall",
    "July-36 Hall",
    "Non-resident (Day Scholar)"
  ],

  /* ---- Roll / Registration rules ---- */
  rules: {
    bachelor: { rollMin: 7, rollMax: 7, text: "Roll must be exactly 7 digits" },
    master:   { rollMin: 6, rollMax: 6, text: "Roll must be exactly 6 digits" },
    research: { rollMin: 1, rollMax: 10, text: "Roll must be 1–10 digits" },
    regMin: 4, regMax: 8
  },

  /* ---- Grading scale (lowest % first element is highest) ---- */
  scale: [
    { min: 80, letter: "A+", gp: 4.00, range: "80% and above", remark: "Outstanding" },
    { min: 75, letter: "A",  gp: 3.75, range: "75% to < 80%",  remark: "Excellent" },
    { min: 70, letter: "A-", gp: 3.50, range: "70% to < 75%",  remark: "Very good" },
    { min: 65, letter: "B+", gp: 3.25, range: "65% to < 70%",  remark: "Good" },
    { min: 60, letter: "B",  gp: 3.00, range: "60% to < 65%",  remark: "Satisfactory" },
    { min: 55, letter: "B-", gp: 2.75, range: "55% to < 60%",  remark: "Below Satisfactory" },
    { min: 50, letter: "C+", gp: 2.50, range: "50% to < 55%",  remark: "Average" },
    { min: 45, letter: "C",  gp: 2.25, range: "45% to < 50%",  remark: "Below Average" },
    { min: 40, letter: "D",  gp: 2.00, range: "40% to < 45%",  remark: "Poor" },
    { min: 0,  letter: "F",  gp: 0.00, range: "< 40%",         remark: "Fail" }
  ]
};

/* Session list: 2025-26 (top) … 1979-80 (bottom) */
IU.sessions = (function () {
  const out = [];
  for (let y = 2025; y >= 1979; y--) out.push(y + "-" + String((y + 1) % 100).padStart(2, "0"));
  return out;
})();
