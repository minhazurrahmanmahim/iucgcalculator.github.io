/* =========================================================
   IU CGPA Calculator – application logic (no build step)
   ========================================================= */
(function () {
'use strict';

/* ------------------------------------------------------------------ helpers */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const num = v => (v === '' || v == null) ? NaN : Number(v);
const rHU = x => Math.floor(x + 0.5 + 1e-9);   // round half up: 35.5 -> 36, 35.25 -> 35
const r2 = x => Math.round((x + 1e-9) * 100) / 100;
const r4 = x => Math.round((x + 1e-9) * 10000) / 10000;
const sum = a => r4(a.reduce((p, c) => p + c, 0));
const fmtCredit = v => Number.isInteger(v) ? v.toFixed(1) : String(parseFloat(Number(v).toFixed(2)));   // 3 -> 3.0, 1.5 -> 1.5
const fmt = (x, d = 3) => (x == null || isNaN(x)) ? '–' : String(parseFloat(Number(x).toFixed(d)));
const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
const KEY = 'iu-cgpa-v1';
const SCALE = IU.scale;
const MAX_YEARS = 8;
const YN = i => ORD[(state.years[i] ? state.years[i].no : i + 1) - 1];   // "Second" for the year at index i
const yrNum = i => (state.years[i] ? state.years[i].no : i + 1);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}
function fmtDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`;
}
function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

/* -------------------------------------------------------------------- state */
function blankCourse() { return { id: uid(), code: '', name: '', credit: '', theory: '', inter: '', total: '', letter: '', gp: '', src: 'marks' }; }
function blankSem(n = 5) { return { courses: Array.from({ length: n }, blankCourse) }; }
function blankYear(no) { return { no: no || 1, semesters: [blankSem(), blankSem()] }; }
function defaultState() {
  return {
    v: 1,
    info: { name: '', father: '', mother: '', dob: '', facultyId: '', dept: '', deptOther: '', degreeId: '', degreeCustom: '', degreeCustomLevel: 'bachelor', hall: '', hallOther: '', session: '', roll: '', reg: '' },
    settings: { mode: 'marks', failInCgpa: true, dedupe: false },
    years: [blankYear(1)],
    view: { scope: 'all', y: 0, s: 0, multi: [0] },
    print: { paper: 'a4', per: 'year', summary: true, watermark: false }
  };
}
function clampView(st) {
  const n = st.years.length, v = st.view;
  if (!(v.y >= 0 && v.y < n)) v.y = 0;
  if (!(v.s === 0 || v.s === 1)) v.s = 0;
  v.multi = (Array.isArray(v.multi) ? v.multi : []).filter(i => i >= 0 && i < n);
  if (!['semester', 'year', 'multi', 'all'].includes(v.scope)) v.scope = 'all';
}
function merge(d, s) {
  if (!s || typeof s !== 'object') return d;
  ['info', 'settings', 'view', 'print'].forEach(k => { if (s[k] && typeof s[k] === 'object') d[k] = Object.assign(d[k], s[k]); });
  if (Array.isArray(s.years) && s.years.length) {
    d.years = s.years.slice(0, MAX_YEARS).map((y, yi) => ({
      no: (y && y.no >= 1 && y.no <= MAX_YEARS) ? Math.floor(y.no) : yi + 1,
      semesters: [0, 1].map(i => {
        const sem = (y && y.semesters && y.semesters[i]) || {};
        const cs = Array.isArray(sem.courses) ? sem.courses : [];
        const list = cs.slice(0, 40).map(c => Object.assign(blankCourse(), c, { id: uid() }));
        return { courses: list.length ? list : [blankCourse()] };
      })
    }));
  }
  clampView(d);
  return d;
}
function loadState() {
  const d = defaultState();
  try { const raw = localStorage.getItem(KEY); return raw ? merge(d, JSON.parse(raw)) : d; }
  catch (e) { return d; }
}
let state = loadState();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full / private mode */ } }, 250);
}

/* ----------------------------------------------------------- grading engine */
const gradeFromPercent = p => SCALE.find(g => p >= g.min) || SCALE[SCALE.length - 1];
const gradeByLetter = l => SCALE.find(g => g.letter === l);
const gradeFromGP = v => SCALE.find(g => v + 1e-9 >= g.gp) || SCALE[SCALE.length - 1];
const remarkFor = cg => { const g = SCALE.find(x => cg + 1e-9 >= x.gp); return g ? g.remark : 'Fail'; };

function evalCourse(c) {
  const code = (c.code || '').trim().toUpperCase();
  const name = (c.name || '').trim();
  const credit = num(c.credit);
  const any = code || name || c.credit !== '' || c.theory !== '' || c.inter !== '' || c.total !== '' || c.letter || c.gp !== '';
  if (!any) return { active: false, valid: false };
  const errs = [];
  const out = { active: true, code, name, credit, errs, theory: c.theory, inter: c.inter };
  if (!code) errs.push('Course code is required');
  if (isNaN(credit) || credit <= 0 || credit > 30) errs.push('Enter a valid credit (e.g. 3 or 1.5)');
  let g = null;
  if (c.src === 'marks') {
    const t = num(c.total);
    if (isNaN(t)) errs.push('Enter the marks');
    else if (t < 0 || t > 100) errs.push('Total marks must be between 0 and 100');
    else { const tr = rHU(t); g = gradeFromPercent(tr); out.total = tr; }
  } else if (c.src === 'letter') {
    if (!c.letter) errs.push('Select a grade'); else g = gradeByLetter(c.letter);
  } else {
    const v = num(c.gp);
    if (isNaN(v)) errs.push('Enter the grade point');
    else if (v < 0 || v > 4 || (v > 0 && v < 2)) errs.push('Grade point must be 0 or between 2.00 and 4.00');
    else g = { gp: v, letter: gradeFromGP(v).letter };
  }
  if (g) { out.letter = g.letter; out.gp = g.gp; if (!isNaN(credit)) out.ps = r4(credit * g.gp); }
  out.valid = errs.length === 0;
  return out;
}

function aggregate(list, dedupe) {
  if (dedupe === undefined) dedupe = state.settings.dedupe;
  let used = list, superseded = 0;
  if (dedupe) {
    const best = new Map();
    list.forEach(e => { const p = best.get(e.code); if (!p || e.gp >= p.gp) best.set(e.code, e); });
    used = list.filter(e => best.get(e.code) === e);
    superseded = list.length - used.length;
  }
  const credits = sum(used.map(e => e.credit));
  const tps = sum(used.map(e => e.ps));
  const ec = sum(used.filter(e => e.gp > 0).map(e => e.credit));
  const denom = state.settings.failInCgpa ? credits : ec;
  const cgpa = denom > 0 ? r2(tps / denom) : null;
  return { n: used.length, credits, tps, ec, cgpa, remark: cgpa == null ? '' : remarkFor(cgpa), superseded, used };
}

function semData(ref) {
  const sem = state.years[ref.y].semesters[ref.s];
  const evs = sem.courses.map(evalCourse);
  const valid = evs.filter(e => e.valid);
  return {
    ref, valid, invalid: evs.filter(e => e.active && !e.valid).length,
    label: `${YN(ref.y)} Year – ${ORD[ref.s]} Semester`,
    sLabel: `${ORD[ref.s]} Semester`,
    aggr: aggregate(valid)
  };
}
function allRefs() {
  const r = []; state.years.forEach((y, yi) => y.semesters.forEach((s, si) => r.push({ y: yi, s: si }))); return r;
}
function scopeRefs() {
  const v = state.view, refs = allRefs();
  if (v.scope === 'semester') return refs.filter(r => r.y === v.y && r.s === v.s);
  if (v.scope === 'year') return refs.filter(r => r.y === v.y);
  if (v.scope === 'multi') return refs.filter(r => v.multi.includes(r.y));
  return refs;
}

/* ------------------------------------------------------------- degree logic */
function degreeObj() {
  for (const g of IU.degrees) for (const d of g.items) if (d.id === state.info.degreeId) return d;
  return null;
}
function degreeLevel() {
  const d = degreeObj(); if (!d) return null;
  return d.id === 'other' ? state.info.degreeCustomLevel : d.level;
}
function validateInfo() {
  const e = {}, i = state.info, lv = degreeLevel(), R = IU.rules;
  if (i.roll) {
    if (!/^\d+$/.test(i.roll)) e.roll = 'Digits only';
    else if (lv) { const r = R[lv]; if (i.roll.length < r.rollMin || i.roll.length > r.rollMax) e.roll = r.text; }
  }
  if (i.reg) {
    if (!/^\d+$/.test(i.reg)) e.reg = 'Digits only';
    else if (i.reg.length < R.regMin || i.reg.length > R.regMax) e.reg = `Registration must be ${R.regMin}–${R.regMax} digits`;
  }
  if (i.degreeId === 'other' && !i.degreeCustom.trim()) e.degree = 'Type the degree name';
  if (i.dept === '__other__' && !i.deptOther.trim()) e.dept = 'Type the department name';
  if (i.hall === '__other__' && !i.hallOther.trim()) e.hall = 'Type the hall name';
  return e;
}
function infoView() {
  const i = state.info, fac = IU.faculties.find(f => f.id === i.facultyId), deg = degreeObj();
  return {
    name: i.name.trim(), father: i.father.trim(), mother: i.mother.trim(), dob: fmtDate(i.dob),
    faculty: fac ? fac.name : '',
    dept: i.dept === '__other__' ? i.deptOther.trim() : i.dept,
    degFull: deg ? (deg.id === 'other' ? i.degreeCustom.trim() : deg.full) : '',
    hall: i.hall === '__other__' ? i.hallOther.trim() : i.hall,
    session: i.session, roll: i.roll, reg: i.reg
  };
}

/* ------------------------------------------------------------------- tabs */
let curTab = 'info';
function goTab(name) {
  curTab = name;
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  if (name === 'info') syncInfoUI(true);
  if (name === 'courses') renderCourses();
  if (name === 'results') { renderScopes(); renderResults(); }
  if (name === 'print') { renderScopes(); renderPrint(); }
  if (name === 'tools') renderTools();
  window.scrollTo({ top: 0 });
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) goTab(b.dataset.tab); });
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goTab(b.dataset.go); });

/* ------------------------------------------------------------- student info */
let lastFaculty = null;
function initInfo() {
  const sel = (id, html) => { $(id).innerHTML = html; };
  sel('#f-faculty', '<option value="">Select faculty</option>' + IU.faculties.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join(''));
  sel('#f-degree', '<option value="">Select degree</option>' + IU.degrees.map(g =>
    `<optgroup label="${esc(g.group)}">${g.items.map(d => `<option value="${d.id}">${esc(d.label)}${d.full ? ' — ' + esc(d.full) : ''}</option>`).join('')}</optgroup>`).join(''));
  sel('#f-hall', '<option value="">Select hall</option>' + IU.halls.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('') + '<option value="__other__">Other (type manually)</option>');
  sel('#f-session', '<option value="">Select session</option>' + IU.sessions.map(s => `<option value="${s}">${s}</option>`).join(''));
  $('#f-dob').max = new Date().toISOString().slice(0, 10);
  $$('[data-info]').forEach(inp => {
    inp.addEventListener('input', onInfoInput);
    inp.addEventListener('change', onInfoInput);
  });
}
function onInfoInput(e) {
  const t = e.target, k = t.dataset.info; let v = t.value;
  if (k === 'roll' || k === 'reg') { v = v.replace(/\D+/g, ''); if (t.value !== v) t.value = v; }
  state.info[k] = v;
  if (k === 'facultyId') { state.info.dept = ''; state.info.deptOther = ''; }
  save(); syncInfoUI(false);
}
function rebuildDept() {
  const f = IU.faculties.find(x => x.id === state.info.facultyId), sel = $('#f-dept');
  sel.disabled = !f;
  sel.innerHTML = f
    ? '<option value="">Select department</option>' + f.departments.map(d => `<option value="${esc(d.n)}">${esc(d.n)} (${esc(d.a)})</option>`).join('') + '<option value="__other__">Other (type manually)</option>'
    : '<option value="">Select faculty first</option>';
  sel.value = state.info.dept;
  if (sel.value !== state.info.dept) { state.info.dept = ''; sel.value = ''; }
  lastFaculty = state.info.facultyId;
}
function syncInfoUI(setValues) {
  const i = state.info;
  if (setValues) {
    $$('[data-info]').forEach(inp => { if (inp.id !== 'f-dept') inp.value = i[inp.dataset.info] || ''; });
    lastFaculty = null;
  }
  if (lastFaculty !== i.facultyId) rebuildDept();
  else if (setValues) $('#f-dept').value = i.dept;
  $('#w-deptother').hidden = i.dept !== '__other__';
  $('#w-hallother').hidden = i.hall !== '__other__';
  $('#w-degcustom').hidden = i.degreeId !== 'other';
  const lv = degreeLevel(), R = IU.rules;
  const roll = $('#f-roll');
  roll.maxLength = lv ? R[lv].rollMax : 10;
  $('#rollHint').textContent = lv ? R[lv].text : 'Choose your degree to see the roll format.';
  roll.placeholder = lv === 'bachelor' ? '7 digits' : lv === 'master' ? '6 digits' : 'Digits only';
  const errs = validateInfo();
  $$('[data-err]').forEach(s => { s.textContent = errs[s.dataset.err] || ''; });
}

/* --------------------------------------------------------------- courses UI */
const MODE_COLS = {
  marks: ['Code', 'Course name (optional)', 'Credit', 'Theory', 'Inter. Theory', 'Total marks', 'Grade', 'GP', 'PS', ''],
  letter: ['Code', 'Course name (optional)', 'Credit', 'Letter grade', 'GP', 'PS', ''],
  gp: ['Code', 'Course name (optional)', 'Credit', 'Grade point', 'Grade', 'PS', '']
};
function rowHTML(c, yi, si, i) {
  const m = state.settings.mode, ev = evalCourse(c);
  const derivedLetter = ev.letter || '', derivedGP = ev.gp != null ? String(ev.gp) : '';
  const cell = (cls, label, inner) => `<div class="cell ${cls}"><label>${label}</label>${inner}</div>`;
  const inp = (f, extra = '') => `<input data-f="${f}" value="${esc(c[f])}" ${extra}>`;
  const numAttr = 'type="number" step="any" min="0" inputmode="decimal"';
  let h = cell('c-code', 'Code <i>*</i>', inp('code', 'placeholder="e.g. BME-2101" maxlength="14" autocapitalize="characters" autocomplete="off" spellcheck="false"'));
  h += cell('c-name', 'Course name <em>(optional)</em>', inp('name', 'placeholder="Course name" maxlength="80" autocomplete="off"'));
  h += cell('c-credit', 'Credit', inp('credit', numAttr + ' max="30" placeholder="3"'));
  const chip = (k, v) => `<div class="chip ${k === 'letter' && v === 'F' ? 'f' : ''}" data-out="${k}">${v || '–'}</div>`;
  if (m === 'marks') {
    h += cell('c-theory', 'Theory', inp('theory', numAttr + ' placeholder="–"'));
    h += cell('c-inter', 'Inter. theory', inp('inter', numAttr + ' placeholder="–"'));
    h += cell('c-total', 'Total marks <i>*</i>', inp('total', numAttr + ' max="100" placeholder="/100"'));
    h += cell('c-letter', 'Grade', chip('letter', derivedLetter));
    h += cell('c-gp', 'GP', chip('gp', derivedGP));
  } else if (m === 'letter') {
    const selL = c.src === 'letter' ? c.letter : derivedLetter;
    h += cell('c-letter', 'Letter grade <i>*</i>', `<select data-f="letter"><option value="">Grade</option>${SCALE.map(g => `<option value="${g.letter}" ${g.letter === selL ? 'selected' : ''}>${g.letter} (${g.gp.toFixed(2)})</option>`).join('')}</select>`);
    h += cell('c-gp', 'GP', chip('gp', derivedGP));
  } else {
    const gv = c.src === 'gp' ? c.gp : derivedGP;
    h += cell('c-gp', 'Grade point <i>*</i>', `<input data-f="gp" value="${esc(gv)}" ${numAttr} max="4" placeholder="0 – 4">`);
    h += cell('c-letter', 'Grade', chip('letter', derivedLetter));
  }
  h += cell('c-ps', 'PS', `<div class="chip dim" data-out="ps">${ev.ps != null ? fmt(ev.ps, 3) : '–'}</div>`);
  h += `<div class="cell c-del"><label>&nbsp;</label><button class="icon-btn" data-act="del-row" title="Remove course" aria-label="Remove course">×</button></div>`;
  return `<div class="crow m-${m}" data-y="${yi}" data-s="${si}" data-i="${i}">${h}<div class="rerr"></div></div>`;
}
function semHTML(sem, yi, si) {
  const m = state.settings.mode;
  return `<div class="sem" data-y="${yi}" data-s="${si}">
    <div class="sem-head"><h4>${ORD[si]} Semester</h4><span class="stats" data-sstats></span></div>
    <div class="chead m-${m}">${MODE_COLS[m].map(t => `<div>${t}</div>`).join('')}</div>
    ${sem.courses.map((c, i) => rowHTML(c, yi, si, i)).join('')}
    <div class="sem-actions">
      <button class="btn small ghost" data-act="add-row">+ Add course</button>
      <button class="btn small ghost" data-act="add-5">+ 5 rows</button>
      <button class="btn small ghost danger" data-act="clear-sem">Clear semester</button>
    </div></div>`;
}
function renderCourses() {
  $('#yearsContainer').innerHTML = state.years.map((y, yi) => `<section class="card year" data-y="${yi}">
    <div class="year-head"><label class="yr-pick"><span class="sr">Which year is this?</span><select data-yearsel aria-label="Which year is this?">${ORD.slice(0, MAX_YEARS).map((n, k) => `<option value="${k + 1}" ${state.years[yi].no === k + 1 ? 'selected' : ''} ${state.years.some((o, j) => j !== yi && o.no === k + 1) ? 'disabled' : ''}>${n} Year</option>`).join('')}</select></label><span class="stats" data-ystats></span>
      <button class="btn small ghost danger" data-act="del-year" ${state.years.length < 2 ? 'disabled' : ''}>Remove year</button></div>
    ${y.semesters.map((s, si) => semHTML(s, yi, si)).join('')}</section>`).join('');
  $('#btnAddYear').disabled = state.years.length >= MAX_YEARS;
  $$('#segMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === state.settings.mode));
  $('#optFail').checked = state.settings.failInCgpa;
  $('#optDedupe').checked = state.settings.dedupe;
  refreshCourseDom();
}
const getCourse = row => state.years[+row.dataset.y].semesters[+row.dataset.s].courses[+row.dataset.i];
function statsHTML(a) {
  return `GPA <b>${a.cgpa == null ? '–' : fmt(a.cgpa, 2)}</b> · Credits <b>${fmt(a.credits, 2)}</b> · EC <b>${fmt(a.ec, 2)}</b> · TPS <b>${fmt(a.tps, 3)}</b>`;
}
function refreshCourseDom() {
  $$('#yearsContainer .sem').forEach(semEl => {
    const seen = {};
    $$('.crow', semEl).forEach(row => {
      const c = getCourse(row), ev = evalCourse(c);
      row.classList.toggle('bad', ev.active && !ev.valid);
      const setOut = (k, v) => { const o = $(`[data-out="${k}"]`, row); if (o) { o.textContent = v; if (k === 'letter') o.classList.toggle('f', v === 'F'); } };
      setOut('letter', ev.letter || '–');
      setOut('gp', ev.gp != null ? fmt(ev.gp, 2) : '–');
      setOut('ps', ev.ps != null ? fmt(ev.ps, 3) : '–');
      let msg = ev.active && !ev.valid ? ev.errs.join(' · ') : '';
      if (ev.active && ev.code) { seen[ev.code] = (seen[ev.code] || 0) + 1; if (seen[ev.code] > 1 && !msg) msg = 'Note: this code is repeated in this semester'; }
      $('.rerr', row).textContent = msg;
    });
    const sd = semData({ y: +semEl.dataset.y, s: +semEl.dataset.s });
    $('[data-sstats]', semEl).innerHTML = sd.valid.length ? statsHTML(sd.aggr) : '<span class="muted">No complete courses yet</span>';
  });
  $$('#yearsContainer .year').forEach(yEl => {
    const yi = +yEl.dataset.y;
    const valid = [0, 1].flatMap(s => semData({ y: yi, s }).valid);
    $('[data-ystats]', yEl).innerHTML = valid.length ? 'Year: ' + statsHTML(aggregate(valid)) : '';
  });
  const all = allRefs().flatMap(r => semData(r).valid), a = aggregate(all);
  $('#miniSummary').innerHTML = all.length
    ? `<span>Overall CGPA</span><b>${fmt(a.cgpa, 2)}</b><span>${esc(a.remark)}</span><span>Credits ${fmt(a.credits, 2)}</span><span>EC ${fmt(a.ec, 2)}</span><span>TPS ${fmt(a.tps, 3)}</span>`
    : '<span>Fill in a course code, credit and marks/grade – your CGPA appears here instantly.</span>';
}
function setSrc(c, src) {
  if (c.src === src) return;
  c.src = src;
  if (src !== 'marks') { c.theory = c.inter = c.total = ''; }
  if (src !== 'letter') c.letter = '';
  if (src !== 'gp') c.gp = '';
}
function sortYears() {
  const v = state.view, cur = state.years[v.y], multi = v.multi.map(i => state.years[i]);
  state.years.sort((a, b) => a.no - b.no);
  v.y = Math.max(0, state.years.indexOf(cur));
  v.multi = multi.map(y => state.years.indexOf(y)).filter(i => i >= 0).sort((a, b) => a - b);
}
const yearsEl = $('#yearsContainer');
yearsEl.addEventListener('change', e => {
  const t = e.target; if (!t.matches('[data-yearsel]')) return;
  const yi = +t.closest('.year').dataset.y;
  state.years[yi].no = +t.value; sortYears(); save(); renderCourses();
  toast(`Set to ${ORD[+t.value - 1]} Year`);
});
yearsEl.addEventListener('input', e => {
  const t = e.target, f = t.dataset.f, row = t.closest('.crow');
  if (!f || !row) return;
  const c = getCourse(row); let v = t.value;
  if (f === 'code') { v = v.toUpperCase(); if (t.value !== v) { const p = t.selectionStart; t.value = v; try { t.setSelectionRange(p, p); } catch (_) { } } }
  if (f === 'theory' || f === 'inter' || f === 'total') setSrc(c, 'marks');
  if (f === 'letter') setSrc(c, 'letter');
  if (f === 'gp') setSrc(c, 'gp');
  c[f] = v;
  if (f === 'theory' || f === 'inter') {
    const a = num(c.theory), b = num(c.inter);
    c.total = (isNaN(a) && isNaN(b)) ? '' : String(rHU(r4((isNaN(a) ? 0 : a) + (isNaN(b) ? 0 : b))));
    const tot = $('[data-f="total"]', row); if (tot) tot.value = c.total;
  }
  save(); refreshCourseDom();
});
yearsEl.addEventListener('change', e => {
  const t = e.target; if (t.dataset.f !== 'total') return;
  const v = num(t.value); if (isNaN(v)) return;
  const row = t.closest('.crow'), c = getCourse(row), r = rHU(v);
  if (String(r) !== t.value) { t.value = String(r); c.total = String(r); save(); refreshCourseDom(); }
});
yearsEl.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, yEl = b.closest('.year'), yi = +yEl.dataset.y;
  const semEl = b.closest('.sem'), si = semEl ? +semEl.dataset.s : 0;
  const sem = state.years[yi].semesters[si];
  if (act === 'add-row') { sem.courses.push(blankCourse()); }
  else if (act === 'add-5') { for (let k = 0; k < 5; k++) sem.courses.push(blankCourse()); }
  else if (act === 'del-row') { sem.courses.splice(+b.closest('.crow').dataset.i, 1); if (!sem.courses.length) sem.courses.push(blankCourse()); }
  else if (act === 'clear-sem') { if (!confirm(`Clear all courses in ${YN(yi)} Year – ${ORD[si]} Semester?`)) return; sem.courses = [0, 1, 2, 3, 4].map(blankCourse); }
  else if (act === 'del-year') {
    if (state.years.length < 2) return;
    if (!confirm(`Remove ${YN(yi)} Year and all its courses?`)) return;
    state.years.splice(yi, 1); clampView(state);
  }
  save(); renderCourses();
  if (act === 'add-row') { const rows = $$('.crow', $$('#yearsContainer .sem')[yi * 2 + si]); const last = rows[rows.length - 1]; if (last) $('input', last).focus(); }
});
$('#btnAddYear').addEventListener('click', () => {
  if (state.years.length >= MAX_YEARS) return;
  let no = 1; while (state.years.some(y => y.no === no)) no++;
  const y = blankYear(no); state.years.push(y); sortYears(); save(); renderCourses();
  toast(`${ORD[no - 1]} Year added`);
  const el = $$('#yearsContainer .year')[state.years.indexOf(y)]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#segMode').addEventListener('click', e => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  state.settings.mode = b.dataset.mode; save(); renderCourses();
});
$('#optFail').addEventListener('change', e => { state.settings.failInCgpa = e.target.checked; save(); refreshCourseDom(); });
$('#optDedupe').addEventListener('change', e => { state.settings.dedupe = e.target.checked; save(); refreshCourseDom(); });

/* -------------------------------------------------------------------- scope */
function scopeHTML() {
  const v = state.view;
  const seg = [['semester', 'One semester'], ['year', 'One year'], ['multi', 'Multiple years'], ['all', 'Entire degree']]
    .map(([k, t]) => `<button class="${v.scope === k ? 'on' : ''}" data-scope="${k}">${t}</button>`).join('');
  let ctl = '';
  if (v.scope === 'semester') {
    ctl = `<select data-scope-sel="sem" aria-label="Semester">${state.years.flatMap((y, yi) => y.semesters.map((_, si) =>
      `<option value="${yi}-${si}" ${v.y === yi && v.s === si ? 'selected' : ''}>${YN(yi)} Year – ${ORD[si]} Semester</option>`)).join('')}</select>`;
  } else if (v.scope === 'year') {
    ctl = `<select data-scope-sel="year" aria-label="Year">${state.years.map((_, i) => `<option value="${i}" ${v.y === i ? 'selected' : ''}>${YN(i)} Year</option>`).join('')}</select>`;
  } else if (v.scope === 'multi') {
    ctl = `<div class="checks" style="flex-direction:row;flex-wrap:wrap;gap:6px 16px">${state.years.map((_, i) =>
      `<label class="chk"><input type="checkbox" data-scope-multi="${i}" ${v.multi.includes(i) ? 'checked' : ''}> ${YN(i)} Year</label>`).join('')}</div>`;
  }
  return `<div class="scope"><div class="field"><label>Show result for</label><div class="seg">${seg}</div></div>${ctl ? `<div class="field">${ctl}</div>` : ''}</div>`;
}
function renderScopes() { clampView(state); ['#scopeResults', '#scopePrint'].forEach(s => { const el = $(s); if (el) el.innerHTML = scopeHTML(); }); }
function afterScope() { save(); renderScopes(); if (curTab === 'results') renderResults(); if (curTab === 'print') renderPrint(); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-scope]'); if (!b) return;
  state.view.scope = b.dataset.scope;
  if (state.view.scope === 'multi' && !state.view.multi.length) state.view.multi = state.years.map((_, i) => i);
  afterScope();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.scopeSel === 'sem') { const [y, s] = t.value.split('-').map(Number); state.view.y = y; state.view.s = s; afterScope(); }
  else if (t.dataset.scopeSel === 'year') { state.view.y = +t.value; afterScope(); }
  else if (t.dataset.scopeMulti !== undefined) {
    const i = +t.dataset.scopeMulti, set = new Set(state.view.multi);
    t.checked ? set.add(i) : set.delete(i);
    state.view.multi = [...set].sort((a, b) => a - b); afterScope();
  }
});

/* ------------------------------------------------------------------ results */
function gpaChart(items) {
  const W = 640, H = 230, pl = 34, pr = 10, pt = 18, pb = 36, n = items.length;
  const slot = (W - pl - pr) / n, bw = Math.min(56, slot * 0.6), ph = H - pt - pb;
  const y = v => pt + ph - (v / 4) * ph;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="GPA by semester">`;
  [0, 1, 2, 3, 4].forEach(g => { s += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(g)}" y2="${y(g)}"/><text x="${pl - 6}" y="${y(g) + 4}" text-anchor="end">${g}</text>`; });
  items.forEach((it, i) => {
    const cx = pl + slot * i + slot / 2, top = y(it.val);
    s += `<rect class="bar ${it.val < 2.5 ? 'low' : ''}" x="${cx - bw / 2}" y="${top}" width="${bw}" height="${Math.max(0, y(0) - top)}" rx="5"/>`;
    s += `<text class="v" x="${cx}" y="${top - 5}" text-anchor="middle">${fmt(it.val, 2)}</text>`;
    s += `<text x="${cx}" y="${H - 14}" text-anchor="middle">${esc(it.label)}</text>`;
  });
  return s + '</svg>';
}
function semCardHTML(sd) {
  const cs = sd.valid, hasMarks = cs.some(e => e.total != null);
  const a = sd.aggr;
  return `<div class="card semcard"><h4>${sd.label} <small>${statsHTMLPlain(a)}</small></h4>
  <div class="table-wrap"><table class="plain"><thead><tr><th>Code</th><th>Course</th><th class="r">Credit</th>${hasMarks ? '<th class="r">Marks</th>' : ''}<th>Grade</th><th class="r">GP</th><th class="r">PS</th></tr></thead><tbody>
  ${cs.map(e => `<tr><td>${esc(e.code)}</td><td>${esc(e.name) || '<span class="muted">–</span>'}</td><td class="r">${fmt(e.credit, 2)}</td>${hasMarks ? `<td class="r">${e.total != null ? fmt(e.total, 2) : '–'}</td>` : ''}<td>${e.letter}</td><td class="r">${fmt(e.gp, 2)}</td><td class="r">${fmt(e.ps, 3)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="2">Total</td><td class="r">${fmt(a.credits, 2)}</td>${hasMarks ? '<td></td>' : ''}<td></td><td class="r">${a.cgpa == null ? '–' : fmt(a.cgpa, 2)}</td><td class="r">${fmt(a.tps, 3)}</td></tr></tfoot></table></div></div>`;
}
const statsHTMLPlain = a => `GPA ${a.cgpa == null ? '–' : fmt(a.cgpa, 2)} · Credits ${fmt(a.credits, 2)} · EC ${fmt(a.ec, 2)} · TPS ${fmt(a.tps, 3)}`;

function renderResults() {
  const body = $('#resultsBody');
  const sds = scopeRefs().map(semData), used = sds.filter(s => s.valid.length);
  const incomplete = sds.reduce((p, s) => p + s.invalid, 0);
  let html = '';
  if (incomplete) html += `<div class="notice">${incomplete} course row${incomplete > 1 ? 's are' : ' is'} incomplete and not counted. <a data-go="courses">Fix in Courses →</a></div>`;
  if (!used.length) { body.innerHTML = html + `<div class="empty">No complete courses in this selection yet.<br><br><button class="btn primary" data-go="courses">Add courses</button></div>`; return; }

  const courses = used.flatMap(s => s.valid), a = aggregate(courses);
  const iv = infoView();
  html += `<div class="card hero"><div><div class="lbl">${used.length > 1 ? 'Cumulative CGPA' : 'CGPA'}</div><div class="big">${a.cgpa == null ? '–' : fmt(a.cgpa, 2)}</div><span class="pill">${esc(a.remark)}</span></div>
    <div class="stat-grid"><div><b>${a.n}</b><span>Courses</span></div><div><b>${fmt(a.credits, 2)}</b><span>Total credits</span></div><div><b>${fmt(a.ec, 2)}</b><span>Earned credits (EC)</span></div><div><b>${fmt(a.tps, 3)}</b><span>TPS</span></div></div></div>`;
  if (a.superseded) html += `<div class="notice">${a.superseded} earlier attempt${a.superseded > 1 ? 's' : ''} of repeated courses not counted (best grade used).</div>`;

  const items = used.map(s => ({ label: `Y${yrNum(s.ref.y)} S${s.ref.s + 1}`, val: s.aggr.cgpa || 0 }));
  const dist = SCALE.map(g => ({ g, n: a.used.filter(e => e.letter === g.letter).length })).filter(d => d.n);
  const maxN = Math.max(...dist.map(d => d.n), 1);
  html += `<div class="grid2"><div class="card chart"><h3>GPA by semester</h3>${gpaChart(items)}</div>
    <div class="card"><h3>Grade distribution</h3><div class="dist" style="margin-top:10px">${dist.map(d => `<div class="d ${d.g.letter === 'F' ? 'f' : ''}"><span>${d.g.letter}</span><i style="width:${(d.n / maxN) * 100}%"></i><span>${d.n}</span></div>`).join('')}</div></div></div>`;

  const sorted = [...a.used].sort((p, q) => q.gp - p.gp || q.credit - p.credit);
  const best = sorted.slice(0, 3), low = sorted.slice(-3).reverse();
  const failed = a.used.filter(e => e.gp === 0);
  const bestSem = [...used].sort((p, q) => (q.aggr.cgpa || 0) - (p.aggr.cgpa || 0))[0];
  html += `<div class="card"><h3 style="margin-bottom:10px">Highlights</h3><div class="insights">
    <div><b>Top courses</b>${best.map(e => `${esc(e.code)} (${e.letter})`).join(', ')}</div>
    <div><b>Lowest courses</b>${low.map(e => `${esc(e.code)} (${e.letter})`).join(', ')}</div>
    <div><b>Failed courses</b>${failed.length ? failed.map(e => esc(e.code)).join(', ') : 'None 🎉'}</div>
    ${used.length > 1 ? `<div><b>Best semester</b>${bestSem.label.replace(' Semester', '')} – ${fmt(bestSem.aggr.cgpa, 2)}</div>` : ''}
  </div></div>`;

  html += `<div class="res-actions"><button class="btn primary" data-go="print">Print marksheet →</button><button class="btn ghost" id="btnCsv">Download CSV</button></div>`;
  html += used.map(semCardHTML).join('');
  body.innerHTML = html;
  void iv;
}
document.addEventListener('click', e => {
  if (!e.target.closest('#btnCsv')) return;
  const rows = [['Year', 'Semester', 'Code', 'Course name', 'Credit', 'Marks', 'Letter grade', 'Grade point', 'PS']];
  scopeRefs().map(semData).forEach(sd => sd.valid.forEach(e2 => rows.push([YN(sd.ref.y), ORD[sd.ref.s], e2.code, e2.name, e2.credit, e2.total != null ? e2.total : '', e2.letter, e2.gp, e2.ps])));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download('iu-cgpa-results.csv', '﻿' + csv, 'text/csv;charset=utf-8');
});

/* ---------------------------------------------------------------- marksheet */
const PAPER = { a4: { w: '297mm', h: '210mm', px: 1122.52, py: 793.7, css: 'A4 landscape' }, letter: { w: '11in', h: '8.5in', px: 1056, py: 816, css: 'Letter landscape' } };

function scaleTableHTML() {
  return `<table class="g-scale"><thead><tr><th>Numerical Grade</th><th>Letter Grade</th><th>GP</th><th>Remarks</th></tr></thead><tbody>${SCALE.map(g =>
    `<tr><td>${g.range}</td><td>${g.letter}</td><td>${g.gp.toFixed(2)}</td><td>${g.remark}</td></tr>`).join('')}</tbody></table>`;
}
function legendHTML(sems) {
  if (!sems.some(sd => sd.valid.some(e => e.name))) return '';
  return `<div class="g-legend">${sems.map(sd => `<table><thead><tr><th colspan="2">${sd.sLabel}</th></tr><tr><th>Code</th><th>Name</th></tr></thead><tbody>${sd.valid.map(e =>
    `<tr><td>${esc(e.code)}</td><td>${esc(e.name)}</td></tr>`).join('')}</tbody></table>`).join('')}</div>`;
}
function headHTML(iv, yearLine, boxText, legend) {
  return `<div class="sh-head"><div>${scaleTableHTML()}</div>
    <div class="sh-c"><div class="t-uni">${esc(IU.universityName)}</div><div class="t-place">${esc(IU.universityPlace)}</div>
      <img class="t-logo" src="${IU.logo}" alt="" onerror="this.style.display='none'">
      ${iv.faculty ? `<div class="t-fac">${esc(iv.faculty)}</div>` : ''}
      ${iv.dept ? `<div class="t-dept">Department of ${esc(iv.dept)}</div>` : ''}
      ${iv.degFull ? `<div class="t-deg">${esc(iv.degFull)}</div>` : ''}
      <div class="t-year">${esc(yearLine)}</div><div class="t-ms">${boxText}</div></div>
    <div>${legend}</div></div>`;
}
function infoBlockHTML(iv) {
  const b = (a, c) => `<div class="ib"><span class="l">${a[0]}</span><span class="v">: ${esc(a[1])}</span><span class="l">${c[0]}</span><span class="v">: ${esc(c[1])}</span></div>`;
  return `<div class="sh-info">${b(['Name', iv.name], ['Hall Name', iv.hall])}${b(["Father's Name", iv.father], ['Roll', iv.roll])}${b(["Mother's Name", iv.mother], ['Reg', iv.reg])}${b(['Date of Birth', iv.dob], ['Session', iv.session])}</div>`;
}
function semTableHTML(sd) {
  const cs = sd.valid;
  const hasT = cs.some(e => e.theory !== '' && e.theory != null), hasI = cs.some(e => e.inter !== '' && e.inter != null), hasTot = cs.some(e => e.total != null);
  const row = (lab, fn) => `<tr><td class="rl">${lab}</td>${cs.map(e => `<td>${fn(e)}</td>`).join('')}</tr>`;
  const mv = v => (v === '' || v == null) ? '–' : fmt(v, 2);
  const a = sd.aggr;
  return `<div class="sem-cap">${sd.sLabel}</div><table class="mt"><thead><tr><th class="rl"></th>${cs.map(e => `<th><div class="cd">${esc(e.code)}</div><div>${fmtCredit(e.credit)}</div></th>`).join('')}</tr></thead><tbody>
    ${hasT ? row('Theory', e => mv(e.theory)) : ''}${hasI ? row('Inter. Theory', e => mv(e.inter)) : ''}${hasTot ? row('Total Marks', e => e.total != null ? fmt(e.total, 2) : '–') : ''}
    ${row('Letter Grade', e => e.letter)}${row('Grade Point', e => fmt(e.gp, 2))}${row('PS', e => fmt(e.ps, 3))}</tbody></table>`;
}
function sumRowHTML(a) {
  return `<div class="sumrow"><div><b>TPS</b>${fmt(a.tps, 3)}</div><div><b>EC</b>${fmt(a.ec, 3)}</div><div><b>CGPA</b>${a.cgpa == null ? '–' : fmt(a.cgpa, 2)}</div><div><b>Remarks</b>${esc(a.remark)}</div></div>${a.superseded ? '<div class="note-small">Repeated courses: only the best attempt is counted in the totals above.</div>' : ''}`;
}
function footHTML(page, total) {
  return `<div class="sh-foot"><div class="disc"><b>This is NOT a marksheet issued by the University administration.</b></div>
    <div class="disc2">Unofficial CGPA calculation prepared by the student for personal reference only. It carries no official seal or signature and has no official validity.</div>
    <div class="gen">Generated on ${todayStr()} &nbsp;·&nbsp; IU CGPA Calculator &nbsp;·&nbsp; Page ${page} of ${total}</div></div>`;
}
function summaryTableHTML(sds, a) {
  return `<div class="sem-cap">Semester-wise summary</div><table class="mt sumt"><thead><tr><th>Year / Semester</th><th>Courses</th><th>Credits</th><th>EC</th><th>TPS</th><th>GPA</th></tr></thead><tbody>
  ${sds.map(sd => `<tr><td>${sd.label}</td><td>${sd.aggr.n}</td><td>${fmt(sd.aggr.credits, 2)}</td><td>${fmt(sd.aggr.ec, 2)}</td><td>${fmt(sd.aggr.tps, 3)}</td><td>${sd.aggr.cgpa == null ? '–' : fmt(sd.aggr.cgpa, 2)}</td></tr>`).join('')}
  <tr class="tot"><td>Overall</td><td>${a.n}</td><td>${fmt(a.credits, 2)}</td><td>${fmt(a.ec, 2)}</td><td>${fmt(a.tps, 3)}</td><td>${a.cgpa == null ? '–' : fmt(a.cgpa, 2)}</td></tr></tbody></table>`;
}
function buildPages() {
  const sds = scopeRefs().map(semData).filter(s => s.valid.length), pages = [];
  if (state.print.per === 'year') {
    const by = new Map();
    sds.forEach(sd => { if (!by.has(sd.ref.y)) by.set(sd.ref.y, []); by.get(sd.ref.y).push(sd); });
    by.forEach((arr, y) => pages.push({ y, sems: arr }));
  } else sds.forEach(sd => pages.push({ y: sd.ref.y, sems: [sd] }));
  return { pages, sds };
}
function sheetShell(inner) {
  return `<div class="sheet-wrap"><div class="sheet"><div class="sheet-inner">${inner}</div>${state.print.watermark ? '<div class="wm">UNOFFICIAL</div>' : ''}</div></div>`;
}
function applyPaper() {
  const p = PAPER[state.print.paper], pv = $('#preview');
  pv.style.setProperty('--pw', p.w); pv.style.setProperty('--ph', p.h);
  $('#pageStyle').textContent = `@page{size:${p.css};margin:0}`;
}
function updateScale() {
  const pv = $('#preview'); if (!pv.clientWidth) return;
  const cs = getComputedStyle(pv), w = pv.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  pv.style.setProperty('--s', Math.min(1, w / PAPER[state.print.paper].px).toFixed(4));
}
function fitSheets() {
  $$('#preview .sheet').forEach(sheet => {
    const inner = $('.sheet-inner', sheet), cs = getComputedStyle(sheet);
    inner.style.setProperty('--fit', '1');
    const availH = sheet.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 6;
    const availW = sheet.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const f = Math.min(1, availH / inner.scrollHeight, availW / inner.scrollWidth);
    inner.style.setProperty('--fit', (f * 0.995).toFixed(4));
  });
}
function renderPrint() {
  const pv = $('#preview');
  applyPaper();
  $$('#segPaper button').forEach(b => b.classList.toggle('on', b.dataset.paper === state.print.paper));
  $$('#segPer button').forEach(b => b.classList.toggle('on', b.dataset.per === state.print.per));
  $('#optSummary').checked = state.print.summary; $('#optWm').checked = state.print.watermark;

  const { pages, sds } = buildPages(), iv = infoView(), errs = validateInfo();
  const warn = [], invalid = scopeRefs().map(semData).reduce((p, s) => p + s.invalid, 0);
  Object.values(errs).forEach(m => warn.push(`<div class="notice err2">${esc(m)} — fix it in the <a data-go="info">Student tab</a>.</div>`));
  const missing = []; if (!iv.name) missing.push('name'); if (!iv.dept) missing.push('department'); if (!iv.degFull) missing.push('degree'); if (!iv.roll) missing.push('roll'); if (!iv.session) missing.push('session');
  if (missing.length && !Object.keys(errs).length) warn.push(`<div class="notice">Not filled yet: ${missing.join(', ')}. <a data-go="info">Add them</a> or print with blanks.</div>`);
  if (invalid) warn.push(`<div class="notice">${invalid} incomplete course row${invalid > 1 ? 's' : ''} will be left out. <a data-go="courses">Fix in Courses</a></div>`);
  $('#printWarn').innerHTML = warn.join('');
  $('#btnPrint').disabled = $('#btnImage').disabled = !pages.length || Object.keys(errs).length > 0;

  if (!pages.length) { pv.innerHTML = '<div class="empty">Nothing to print yet — add some complete courses first.</div>'; return; }

  const showSummary = state.print.summary && sds.length > 1;
  const total = pages.length + (showSummary ? 1 : 0);
  let html = pages.map((p, idx) => {
    const a = aggregate(p.sems.flatMap(s => s.valid));
    const inner = headHTML(iv, `${YN(p.y)} year`, 'MARKS SHEET', legendHTML(p.sems)) + infoBlockHTML(iv)
      + p.sems.map(sd => semTableHTML(sd)).join('') + sumRowHTML(a) + footHTML(idx + 1, total);
    return sheetShell(inner);
  }).join('');
  if (showSummary) {
    const a = aggregate(sds.flatMap(s => s.valid)), ys = sds.map(s => s.ref.y), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const yl = y0 === y1 ? `${YN(y0)} year` : `${YN(y0)} year – ${YN(y1)} year`;
    html += sheetShell(headHTML(iv, yl, 'CUMULATIVE RESULT', '') + infoBlockHTML(iv) + summaryTableHTML(sds, a) + sumRowHTML(a) + footHTML(total, total));
  }
  pv.innerHTML = html;
  updateScale();
  requestAnimationFrame(() => { fitSheets(); });
}
$('#segPaper').addEventListener('click', e => { const b = e.target.closest('[data-paper]'); if (!b) return; state.print.paper = b.dataset.paper; save(); renderPrint(); });
$('#segPer').addEventListener('click', e => { const b = e.target.closest('[data-per]'); if (!b) return; state.print.per = b.dataset.per; save(); renderPrint(); });
$('#optSummary').addEventListener('change', e => { state.print.summary = e.target.checked; save(); renderPrint(); });
$('#optWm').addEventListener('change', e => { state.print.watermark = e.target.checked; save(); renderPrint(); });
$('#btnPrint').addEventListener('click', () => {
  const iv = infoView();
  if (!iv.name && !confirm('Your name is empty. Print anyway?')) return;
  fitSheets(); setTimeout(() => window.print(), 60);
});
/* ---- save marksheet pages as PNG / JPG: drawn directly on a canvas (works in every browser, no libraries) ---- */
const FONT = 'Arial, Helvetica, sans-serif';
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = src; }); }
function setFont(c, size, b) { c.font = `${b ? 'bold ' : ''}${size}px ${FONT}`; }
function tw(c, s, size, b) { setFont(c, size, b); return c.measureText(String(s)).width; }
function T(c, s, x, y, o = {}) {
  let size = o.size || 12, str = String(s == null ? '' : s);
  setFont(c, size, o.b);
  if (o.max) {
    while (c.measureText(str).width > o.max && size > (o.min || 7)) { size -= 0.5; setFont(c, size, o.b); }
    if (c.measureText(str).width > o.max) { while (str.length > 1 && c.measureText(str + '…').width > o.max) str = str.slice(0, -1); str += '…'; }
  }
  c.fillStyle = o.color || '#000'; c.textAlign = o.align || 'left'; c.textBaseline = 'alphabetic';
  c.fillText(str, x, y);
}
function hline(c, x1, x2, y, w) { c.strokeStyle = '#000'; c.lineWidth = w || 1; c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke(); }
function rbox(c, x, y, w, h, lw) { c.strokeStyle = '#000'; c.lineWidth = lw || 1; c.strokeRect(x, y, w, h); }

function drawHeader(c, w, iv, yearLine, boxText, legendSems, logo) {
  const lw = w * 0.29, cx = w * 0.5, rx = w * 0.725, rw = w - rx;
  // grading scale table (left)
  const rh = 15, cols = [0.33, 0.2, 0.14, 0.33].map(f => f * lw);
  const rows = [['Numerical Grade', 'Letter Grade', 'GP', 'Remarks'], ...SCALE.map(g => [g.range, g.letter, g.gp.toFixed(2), g.remark])];
  let ty = 0;
  rows.forEach((r, ri) => { let x = 0; r.forEach((cell, ci) => { rbox(c, x, ty, cols[ci], rh, 0.8); T(c, cell, x + cols[ci] / 2, ty + rh - 4.5, { size: 9, b: ri === 0, align: 'center', max: cols[ci] - 4, min: 6 }); x += cols[ci]; }); ty += rh; });
  let leftH = ty;
  // centre block
  const cmax = w * 0.42; let cy = 24;
  T(c, IU.universityName, cx, cy, { size: 26, align: 'center', max: cmax });
  cy += 22; T(c, IU.universityPlace, cx, cy, { size: 15, align: 'center', max: cmax });
  cy += 8;
  if (logo) { const lh = 56, lwd = logo.width * lh / logo.height; c.drawImage(logo, cx - lwd / 2, cy, lwd, lh); cy += lh + 6; } else cy += 4;
  if (iv.faculty) { cy += 13; T(c, iv.faculty, cx, cy, { size: 12, align: 'center', max: cmax }); }
  if (iv.dept) { cy += 20; T(c, 'Department of ' + iv.dept, cx, cy, { size: 16.5, align: 'center', max: cmax }); }
  if (iv.degFull) { cy += 20; T(c, iv.degFull, cx, cy, { size: 16.5, align: 'center', max: cmax }); }
  cy += 20; T(c, yearLine, cx, cy, { size: 16.5, b: true, align: 'center', max: cmax });
  cy += 12; const bw = tw(c, boxText, 14, true) + 34; rbox(c, cx - bw / 2, cy, bw, 24, 1); T(c, boxText, cx, cy + 17, { size: 14, b: true, align: 'center' }); cy += 24;
  // course-name legend (right)
  let rightH = 0;
  if (legendSems.length) {
    const gap = 8, tW = (rw - gap * (legendSems.length - 1)) / legendSems.length, rr = 13;
    legendSems.forEach((sd, k) => {
      const x0 = rx + k * (tW + gap), c1 = tW * 0.36; let yy = 0;
      [['h', sd.sLabel], ['h2']].forEach(() => { });
      rbox(c, x0, yy, tW, rr, 0.7); T(c, sd.sLabel, x0 + tW / 2, yy + rr - 3.5, { size: 8.5, b: true, align: 'center' }); yy += rr;
      rbox(c, x0, yy, c1, rr, 0.7); rbox(c, x0 + c1, yy, tW - c1, rr, 0.7);
      T(c, 'Code', x0 + c1 / 2, yy + rr - 3.5, { size: 8.5, b: true, align: 'center' }); T(c, 'Name', x0 + c1 + (tW - c1) / 2, yy + rr - 3.5, { size: 8.5, b: true, align: 'center' }); yy += rr;
      sd.valid.forEach(e => {
        rbox(c, x0, yy, c1, rr, 0.7); rbox(c, x0 + c1, yy, tW - c1, rr, 0.7);
        T(c, e.code, x0 + 3, yy + rr - 3.5, { size: 8, max: c1 - 5, min: 5.5 }); T(c, e.name, x0 + c1 + 3, yy + rr - 3.5, { size: 8, max: tW - c1 - 6, min: 5.5 }); yy += rr;
      });
      rightH = Math.max(rightH, yy);
    });
  }
  return Math.max(leftH, cy, rightH) + 14;
}
function drawInfo(c, w, iv, y) {
  const xs = [0, 0.33, 0.58, 0.79].map(f => f * w);
  const items = [[['Name', iv.name], ['Hall Name', iv.hall]], [["Father's Name", iv.father], ['Roll', iv.roll]], [["Mother's Name", iv.mother], ['Reg', iv.reg]], [['Date of Birth', iv.dob], ['Session', iv.session]]];
  items.forEach((pair, i) => {
    const x = xs[i], nx = i < 3 ? xs[i + 1] : w, lbl = Math.max(...pair.map(p => tw(c, p[0], 12, true))) + 8;
    pair.forEach((p, r) => { const yy = y + 14 + r * 21; T(c, p[0], x, yy, { size: 12, b: true }); T(c, ': ' + String(p[1] || '').toUpperCase(), x + lbl, yy, { size: 12, max: nx - x - lbl - 10, min: 7 }); });
  });
  return y + 14 + 21 + 14;
}
function drawSemTable(c, w, sd, y) {
  const cs = sd.valid, n = cs.length, labW = Math.min(112, w * 0.12), colW = (w - labW) / n, fs = Math.max(7, Math.min(12.5, colW / 7));
  const hh = 38, rh = 22;
  T(c, sd.sLabel, w / 2, y + 14, { size: 13, b: true, align: 'center' }); y += 26;
  rbox(c, 0, y, labW, hh, 0.9);
  cs.forEach((e, i) => { const x = labW + i * colW; rbox(c, x, y, colW, hh, 0.9); T(c, e.code, x + 5, y + 15, { size: fs, max: colW - 9, min: 6 }); T(c, fmtCredit(e.credit), x + 5, y + 31, { size: fs }); });
  y += hh;
  const hasT = cs.some(e => e.theory !== '' && e.theory != null), hasI = cs.some(e => e.inter !== '' && e.inter != null), hasTot = cs.some(e => e.total != null);
  const mv = v => (v === '' || v == null) ? '–' : fmt(v, 2);
  const rows = [];
  if (hasT) rows.push(['Theory', e => mv(e.theory)]);
  if (hasI) rows.push(['Inter. Theory', e => mv(e.inter)]);
  if (hasTot) rows.push(['Total Marks', e => e.total != null ? fmt(e.total, 2) : '–']);
  rows.push(['Letter Grade', e => e.letter], ['Grade Point', e => fmt(e.gp, 2)], ['PS', e => fmt(e.ps, 3)]);
  rows.forEach(([lab, fn]) => {
    rbox(c, 0, y, labW, rh, 0.9); T(c, lab, 5, y + rh - 7, { size: 12, max: labW - 9, min: 7 });
    cs.forEach((e, i) => { const x = labW + i * colW; rbox(c, x, y, colW, rh, 0.9); T(c, fn(e), x + 5, y + rh - 7, { size: fs, max: colW - 9, min: 6 }); });
    y += rh;
  });
  return y + 12;
}
function drawSummaryTable(c, w, sds, a, y) {
  T(c, 'Semester-wise summary', w / 2, y + 14, { size: 13, b: true, align: 'center' }); y += 38;
  const xs = [0, 0.38, 0.52, 0.66, 0.80, 0.92].map(f => f * w), heads = ['Year / Semester', 'Courses', 'Credits', 'EC', 'TPS', 'GPA'];
  heads.forEach((h, i) => T(c, h, xs[i] + 3, y, { size: 12 })); y += 7; hline(c, 0, w, y, 0.9);
  const row = (vals, bold) => { y += 22; vals.forEach((v, i) => T(c, v, xs[i] + 3, y - 6, { size: 12, b: bold })); };
  sds.forEach(sd => row([sd.label, sd.aggr.n, fmt(sd.aggr.credits, 2), fmt(sd.aggr.ec, 2), fmt(sd.aggr.tps, 3), sd.aggr.cgpa == null ? '–' : fmt(sd.aggr.cgpa, 2)]));
  y += 6; hline(c, 0, w, y, 0.9);
  row(['Overall', a.n, fmt(a.credits, 2), fmt(a.ec, 2), fmt(a.tps, 3), a.cgpa == null ? '–' : fmt(a.cgpa, 2)], true);
  return y + 8;
}
function drawTotals(c, w, a, y) {
  y += 12;
  [['TPS', fmt(a.tps, 3), 0], ['EC', fmt(a.ec, 3), w * 0.33], ['CGPA', a.cgpa == null ? '–' : fmt(a.cgpa, 2), w * 0.6]].forEach(([l, v, x]) => {
    T(c, l, x, y + 14, { size: 13.5, b: true }); T(c, v, x + tw(c, l, 13.5, true) + 14, y + 14, { size: 13.5 });
  });
  const val = a.remark || '', vw = tw(c, val, 13.5), lw = tw(c, 'Remarks', 13.5, true);
  T(c, val, w, y + 14, { size: 13.5, align: 'right' }); T(c, 'Remarks', w - vw - 14 - lw, y + 14, { size: 13.5, b: true });
  y += 30;
  if (a.superseded) { T(c, 'Repeated courses: only the best attempt is counted in the totals above.', 0, y + 8, { size: 9.5, color: '#333' }); y += 14; }
  return y;
}
function drawFooterBox(c, w, y, idx, total) {
  y += 8; const h = 66; rbox(c, 0, y, w, h, 1.3);
  T(c, 'This is NOT a marksheet issued by the University administration.', w / 2, y + 25, { size: 15, b: true, align: 'center', max: w - 20 });
  T(c, 'Unofficial CGPA calculation prepared by the student for personal reference only. It carries no official seal or signature and has no official validity.', w / 2, y + 43, { size: 11.5, align: 'center', max: w - 20, min: 7 });
  T(c, `Generated on ${todayStr()}  ·  IU CGPA Calculator  ·  Page ${idx} of ${total}`, w / 2, y + 58, { size: 10, color: '#333', align: 'center' });
  return y + h;
}
function drawPage(c, w, spec, iv, logo) {
  let y = 0;
  if (spec.kind === 'sem') {
    y = drawHeader(c, w, iv, spec.yearLine, 'MARKS SHEET', spec.sems.some(sd => sd.valid.some(e => e.name)) ? spec.sems : [], logo);
    y = drawInfo(c, w, iv, y);
    spec.sems.forEach(sd => { y = drawSemTable(c, w, sd, y); });
  } else {
    y = drawHeader(c, w, iv, spec.yearLine, 'CUMULATIVE RESULT', [], logo);
    y = drawInfo(c, w, iv, y);
    y = drawSummaryTable(c, w, spec.sds, spec.agg, y);
  }
  y = drawTotals(c, w, spec.agg, y);
  return drawFooterBox(c, w, y, spec.idx, spec.total);
}
function printSpecs() {
  const { pages, sds } = buildPages(), showSummary = state.print.summary && sds.length > 1, total = pages.length + (showSummary ? 1 : 0);
  const specs = pages.map((p, i) => ({ kind: 'sem', sems: p.sems, agg: aggregate(p.sems.flatMap(s => s.valid)), yearLine: `${YN(p.y)} year`, idx: i + 1, total }));
  if (showSummary) {
    const ys = sds.map(s => s.ref.y), y0 = Math.min(...ys), y1 = Math.max(...ys);
    specs.push({ kind: 'sum', sds, agg: aggregate(sds.flatMap(s => s.valid)), yearLine: y0 === y1 ? `${YN(y0)} year` : `${YN(y0)} year – ${YN(y1)} year`, idx: total, total });
  }
  return specs;
}
function renderPageCanvas(spec, iv, logo) {
  const P = PAPER[state.print.paper], W = Math.round(P.px), H = Math.round(P.py), S = 2, mx = 38, my = 28;
  const probe = document.createElement('canvas').getContext('2d');
  const h1 = drawPage(probe, W - 2 * mx, spec, iv, logo), k = Math.min(1, (H - 2 * my) / h1);
  const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
  const c = cv.getContext('2d'); c.scale(S, S); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  if (state.print.watermark) { c.save(); c.translate(W / 2, H / 2); c.rotate(-24 * Math.PI / 180); c.fillStyle = 'rgba(0,0,0,0.055)'; c.font = `bold 110px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('UNOFFICIAL', 0, 0); c.restore(); }
  c.translate(mx, my); c.scale(k, k);
  drawPage(c, (W - 2 * mx) / k, spec, iv, logo);
  return cv;
}
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
let imgUrls = [];
function closeImgDialog() { const d = $('#imgDialog'); if (d.open) d.close(); imgUrls.forEach(o => URL.revokeObjectURL(o.url)); imgUrls = []; $('#imgList').innerHTML = ''; }
$('#imgClose').addEventListener('click', closeImgDialog);
$('#imgDialog').addEventListener('cancel', () => setTimeout(closeImgDialog, 0));
$('#imgList').addEventListener('click', async e => {
  const b = e.target.closest('[data-share]'); if (!b) return;
  const it = imgUrls[+b.dataset.share]; if (!it) return;
  try { await navigator.share({ files: [it.file] }); } catch (_) { /* cancelled */ }
});
$('#btnImage').addEventListener('click', async () => {
  const btn = $('#btnImage'), sheets = $$('#preview .sheet'), fmt = $('#imgFmt').value;
  if (!sheets.length) return;
  btn.disabled = true; const old = btn.textContent; btn.textContent = 'Preparing…';
  try {
    const specs = printSpecs(); if (!specs.length) throw new Error('nothing to save');
    let logo = null; try { logo = await loadImg(IU.logo); } catch (_) { }
    const iv = infoView(), base = 'IU-Marksheet-' + ((iv.roll || iv.name || 'result').replace(/[^\w-]+/g, '_'));
    closeImgDialog(); imgUrls = [];
    for (let i = 0; i < specs.length; i++) {
      const cv = renderPageCanvas(specs[i], iv, logo);
      const blob = await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('blob')), fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
      const name = `${base}-page${i + 1}.${fmt}`, file = new File([blob], name, { type: blob.type });
      imgUrls.push({ url: URL.createObjectURL(blob), name, file });
    }
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [imgUrls[0].file] }));
    $('#imgList').innerHTML = imgUrls.map((o, i) => `<figure class="imgfig"><img src="${o.url}" alt="Page ${i + 1}"><figcaption><b>Page ${i + 1}</b>
      <a class="btn small primary" href="${o.url}" download="${esc(o.name)}">Download</a>
      ${canShare ? `<button class="btn small ghost" data-share="${i}">Share / Save to Photos</button>` : ''}</figcaption></figure>`).join('');
    $('#imgDialog').showModal ? $('#imgDialog').showModal() : $('#imgDialog').setAttribute('open', '');
  } catch (e) {
    console.error(e);
    toast('Could not make the image on this browser (' + (e && e.message ? e.message : 'error') + '). Use Print → Save as PDF instead.');
  }
  btn.textContent = old; btn.disabled = false;
});
window.addEventListener('beforeprint', () => { if (curTab !== 'print') { renderScopes(); curTab = 'print'; $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-print')); renderPrint(); } fitSheets(); });
window.addEventListener('resize', () => { if (curTab === 'print') updateScale(); });
if ('ResizeObserver' in window) new ResizeObserver(() => { if (curTab === 'print') updateScale(); }).observe($('#preview'));

/* -------------------------------------------------------------------- tools */
function renderTools() {
  $('#scaleTable').innerHTML = `<thead><tr><th>Marks</th><th>Letter</th><th class="r">GP</th><th>Remarks</th></tr></thead><tbody>${SCALE.map(g =>
    `<tr><td>${g.range}</td><td><b>${g.letter}</b></td><td class="r">${g.gp.toFixed(2)}</td><td>${g.remark}</td></tr>`).join('')}</tbody>`;
}
function planner() {
  const a = num($('#tp-cred').value), b = num($('#tp-cgpa').value), r = num($('#tp-rem').value), t = num($('#tp-target').value), out = $('#tp-out');
  if ([a, b, r, t].some(isNaN)) { out.innerHTML = ''; return; }
  if (r <= 0) { out.innerHTML = '<div class="box warn">Enter the credits you still have to complete.</div>'; return; }
  const need = (t * (a + r) - b * a) / r, maxC = (b * a + 4 * r) / (a + r);
  if (need > 4 + 1e-9) out.innerHTML = `<div class="box bad">Not reachable. Even straight A+ (4.00) gives a CGPA of <b>${fmt(maxC, 2)}</b>.</div>`;
  else if (need <= 0) out.innerHTML = '<div class="box">You have already secured this target — nice!</div>';
  else {
    const g = [...SCALE].reverse().find(x => x.gp + 1e-9 >= need);
    out.innerHTML = `<div class="box">You need an average GPA of <b>${fmt(need + 0.004999, 2)}</b> over the next ${fmt(r, 2)} credits${g ? ` — roughly <b>${g.letter}</b> in every course` : ''}.</div>`;
  }
}
['tp-cred', 'tp-cgpa', 'tp-rem', 'tp-target'].forEach(id => $('#' + id).addEventListener('input', planner));
$('#tp-use').addEventListener('click', () => {
  const a = aggregate(allRefs().flatMap(r => semData(r).valid));
  if (a.cgpa == null) { toast('Add some courses first'); return; }
  $('#tp-cred').value = fmt(a.credits, 2); $('#tp-cgpa').value = fmt(a.cgpa, 2); planner();
});
$('#cv-marks').addEventListener('input', e => {
  const v = num(e.target.value), out = $('#cv-out');
  if (isNaN(v)) { out.innerHTML = ''; return; }
  if (v < 0 || v > 100) { out.innerHTML = '<div class="box bad">Enter marks between 0 and 100.</div>'; return; }
  const g = gradeFromPercent(v);
  out.innerHTML = `<div class="box">Grade <b>${g.letter}</b> · GP <b>${g.gp.toFixed(2)}</b> · ${g.remark} <span class="muted">(${g.range})</span></div>`;
});

/* ----------------------------------------------------- data in / out / reset */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
function closeMenu() { const m = $('.menu'); if (m) m.open = false; }
function rerenderCurrent() { syncInfoUI(true); goTab(curTab); }
$('#btnExport').addEventListener('click', () => {
  closeMenu(); const d = new Date();
  download(`iu-cgpa-data-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`, JSON.stringify(state, null, 2), 'application/json');
  toast('Data exported');
});
$('#btnImport').addEventListener('click', () => { closeMenu(); $('#fileImport').click(); });
$('#fileImport').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try { const s = JSON.parse(rd.result); if (!s || !Array.isArray(s.years)) throw 0; state = merge(defaultState(), s); save(); rerenderCurrent(); toast('Data imported'); }
    catch (_) { toast('That file is not a valid IU CGPA export'); }
  };
  rd.readAsText(f); e.target.value = '';
});
$('#btnReset').addEventListener('click', () => {
  closeMenu(); if (!confirm('Delete all your information and courses from this device?')) return;
  state = defaultState(); save(); rerenderCurrent(); toast('Everything cleared');
});
$('#btnSample').addEventListener('click', () => {
  closeMenu(); if (!confirm('Replace the courses with made-up sample data?')) return;
  const mk = (code, credit, total) => Object.assign(blankCourse(), { code, credit: String(credit), total: String(total), theory: '', inter: '' });
  state.years = [{
    semesters: [
      { courses: [mk('SMP-1101', 3, 78), mk('SMP-1102', 3, 66), mk('SMP-1103', 3, 58), mk('SMP-1104', 1.5, 83), mk('SMP-1105', 2, 71)] },
      { courses: [mk('SMP-1201', 3, 69), mk('SMP-1202', 3, 52), mk('SMP-1203', 3, 36), mk('SMP-1204', 1, 74), mk('SMP-1205', 2.5, 61)] }
    ]
  }];
  state.view = { scope: 'all', y: 0, s: 0, multi: [0] }; save(); rerenderCurrent(); toast('Sample data loaded');
});
$('.menu') && document.addEventListener('click', e => { const m = $('.menu'); if (m && m.open && !m.contains(e.target)) m.open = false; });

/* ------------------------------------------------------------------ install */
let deferredPrompt = null;
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
function syncInstallBtn() { $('#btnInstall').hidden = isStandalone(); }
syncInstallBtn();
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; syncInstallBtn(); });
$('#btnInstall').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (_) { }
    deferredPrompt = null; return;
  }
  // browser has not offered a one-tap install (iPhone, already installed, or offered earlier) – show manual steps
  $('#installNote').textContent = 'Your browser did not offer one-tap install right now. Use one of these ways:';
  const dlg = $('#installHelp');
  if (dlg.showModal) dlg.showModal(); else alert('Open your browser menu and choose "Install app" or "Add to Home screen".');
});
$('#installClose').addEventListener('click', () => $('#installHelp').close());
window.addEventListener('appinstalled', () => { $('#btnInstall').hidden = true; toast('App installed'); });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });

/* --------------------------------------------------------------------- boot */
initInfo();
syncInfoUI(true);
renderCourses();
renderTools();

})();
