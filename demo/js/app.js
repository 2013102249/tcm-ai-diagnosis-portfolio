/* 云诊中医大脑 — 应用逻辑（演示版） */
"use strict";

/* ================= 全局状态 ================= */
const state = {
  page: "dash",
  dxPatient: 0,
  sel: { symptoms: new Set(), tongueZhi: new Set(), tongueTai: new Set(), tongueXing: new Set(), face: new Set(), voice: new Set(), smell: new Set(), pulseL: new Set(), pulseR: new Set(), palp: new Set() },
  dxCount: 0,
  result: null,        // 辨证结果
  confirmed: null,     // 已确认证型
  rxHerbs: [],         // 当前处方 [{name,dose,min,max,role}]
  contraActive: false
};

const $ = id => document.getElementById(id);
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* ================= 导航 ================= */
function showPage(p){
  state.page = p;
  document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
  $("page-" + p).classList.add("active");
  document.querySelectorAll(".nav-item,.tab-item").forEach(el => el.classList.toggle("active", el.dataset.page === p));
  window.scrollTo({ top: 0 });
  if (p === "ops") renderCharts();
  if (p === "cases") renderCases();
  if (p === "knowledge") renderKb();
}
function enterWorkstation(){ $("view-login").classList.add("hidden"); $("app").classList.remove("hidden"); showPage("dash"); toast("已登录医生工作站（演示账号：张医师）"); }
function logout(){ $("app").classList.add("hidden"); $("view-login").classList.remove("hidden"); }

let toastTimer = null;
function toast(msg){
  const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

/* ================= 工作台 ================= */
function renderDash(){
  $("today-patients").innerHTML = PATIENTS.map(p => `
    <div class="patient-row" onclick="startDiagnose(${p.id})">
      <div class="avatar">${esc(p.name[0])}</div>
      <div class="pr-info"><b>${esc(p.name)}</b><small>${esc(p.sex)} · ${p.age} 岁 · ${esc(p.his)}</small></div>
      <span class="pill blue">调阅</span>
    </div>`).join("");
}
function startDiagnose(pid){
  state.dxPatient = Number(pid);
  showPage("diagnose");
  renderDxPatient();
}

/* ================= 四诊采集 ================= */
function renderDxPatient(){
  const p = PATIENTS[state.dxPatient];
  $("dx-patient-name").textContent = p.name;
  $("dx-patient-meta").textContent = p.meta;
  $("dx-patient-select").innerHTML = PATIENTS.map((pt,i) => `<option value="${i}" ${i===state.dxPatient?"selected":""}>${esc(pt.name)}</option>`).join("");
}
function selectDxPatient(v){
  state.dxPatient = Number(v);
  // 切换患者时清空录入
  Object.values(state.sel).forEach(s => s.clear());
  updateDxCount();
  renderDxPatient();
  if (state.dxPatient === 2) toast("注意：该患者妊娠 12 周，将自动启用妊娠禁忌校验");
}

function chipHtml(group, item, on){
  return `<a class="chip ${on ? "on" : ""}" onclick="toggleSel('${group}','${esc(item)}',this)">${esc(item)}</a>`;
}
function toggleSel(group, item, el){
  const s = state.sel[group];
  if (s.has(item)) { s.delete(item); el.classList.remove("on"); }
  else { s.add(item); el.classList.add("on"); }
  updateDxCount();
}
function updateDxCount(){
  state.dxCount = Object.values(state.sel).reduce((n,s) => n + s.size, 0);
  $("dx-count").textContent = state.dxCount;
}

function dxTab(t){
  document.querySelectorAll(".dx-tab").forEach(el => el.classList.toggle("active", el.dataset.t === t));
  document.querySelectorAll(".dx-pane").forEach(el => el.classList.remove("active"));
  $("dx-" + t).classList.add("active");
}

function tongueScan(){
  const btn = $("tongue-btn");
  btn.disabled = true; btn.textContent = "识别中…";
  $("tongue-box").querySelector(".tongue-visual").classList.add("scanning");
  setTimeout(() => {
    $("tongue-box").querySelector(".tongue-visual").classList.remove("scanning");
    btn.disabled = false; btn.textContent = "📷 重新拍摄 / 上传";
    $("tongue-result").classList.remove("hidden");
    $("tongue-tags").innerHTML = `
      <span class="tg-label">舌质（识别置信度 92%）</span>${TONGUE_RESULT.舌质.map(t => chipHtml("tongueZhi", t, t === "淡红")).join("")}
      <span class="tg-label">舌苔（识别置信度 88%）</span>${TONGUE_RESULT.舌苔.map(t => chipHtml("tongueTai", t, t === "薄白")).join("")}
      <span class="tg-label">舌形（识别置信度 85%）</span>${TONGUE_RESULT.舌形.map(t => chipHtml("tongueXing", t, t === "正常")).join("")}
      <span class="tg-label">提示：Top3 类别建议值已预选，请医生一键确认或修改</span>`;
    updateDxCount();
    toast("舌象识别完成（P95 ≤ 2s），建议值已输出，请确认");
  }, 1600);
}

function renderDxTags(){
  // 望：面色神态
  $("face-tags").innerHTML = Object.entries(FACE_TAGS).map(([g, arr]) =>
    `<span class="tg-label">${esc(g)}</span>` + arr.map(t => chipHtml("face", t, false)).join("")).join("");
  // 闻
  $("voice-tags").innerHTML = Object.entries(VOICE_TAGS).map(([g, arr]) =>
    `<span class="tg-label">${esc(g)}</span>` + arr.map(t => chipHtml("voice", t, false)).join("")).join("");
  $("smell-tags").innerHTML = Object.entries(SMELL_TAGS).map(([g, arr]) =>
    `<span class="tg-label">${esc(g)}</span>` + arr.map(t => chipHtml("smell", t, false)).join("")).join("");
  // 问
  $("inquiry-groups").innerHTML = INQUIRY_GROUPS.map(grp => `
    <div class="inq-group"><b>${esc(grp.g)}</b><div class="tag-groups">${grp.items.map(t => chipHtml("symptoms", t, false)).join("")}</div></div>`).join("");
  // 切
  $("pulse-left").innerHTML = PULSE_LIST.map(t => chipHtml("pulseL", t, false)).join("");
  $("pulse-right").innerHTML = PULSE_LIST.map(t => chipHtml("pulseR", t, false)).join("");
  $("palpation-tags").innerHTML = Object.entries(PALPATION_TAGS).map(([g, arr]) =>
    `<span class="tg-label">${esc(g)}</span>` + arr.map(t => chipHtml("palp", t, false)).join("")).join("");
}

/* ================= AI 辨证引擎（规则演示版） ================= */
function runDiagnosis(){
  const total = state.dxCount;
  if (total < 3) { toast("请至少录入 3 项四诊信息（舌象 / 症状 / 脉象）"); return; }
  showPage("syndrome");
  const sym = state.sel.symptoms;
  const tongueAll = [...state.sel.tongueZhi, ...state.sel.tongueTai, ...state.sel.tongueXing];
  const pulseAll = [...state.sel.pulseL, ...state.sel.pulseR];

  const scored = SYNDROMES.map(sy => {
    let score = 0, evidence = [];
    for (const [feat, w] of Object.entries(sy.feat)) {
      // 症状命中：精确或包含匹配
      let hit = sym.has(feat);
      if (!hit) for (const s2 of sym) { if (s2.includes(feat) || feat.includes(s2)) { hit = true; break; } }
      if (hit) { score += w; evidence.push(feat); }
    }
    const tHits = sy.tongue.filter(t => tongueAll.some(x => x.includes(t) || t.includes(x)));
    const pHits = sy.pulse.filter(t => pulseAll.includes(t));
    score += tHits.length * 2 + pHits.length * 2.5;
    return { sy, score, evidence: [...evidence, ...(tHits.length ? ["舌象：" + tHits.join("/") ] : []), ...(pHits.length ? ["脉象：" + pHits.join("/")] : [])] };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

  if (!scored.length) {
    $("syndrome-empty").classList.remove("hidden");
    $("syndrome-body").classList.add("hidden");
    return;
  }
  $("syndrome-empty").classList.add("hidden");
  $("syndrome-body").classList.remove("hidden");
  $("confirm-area").classList.add("hidden");
  $("prescription-area").classList.add("hidden");
  $("record-area").classList.add("hidden");

  const sum = scored.slice(0, 3).reduce((n,x) => n + x.score, 0);
  const top3 = scored.slice(0, 3).map(x => ({ ...x, conf: Math.round(x.score / sum * 100) }));

  // 辨证存疑：Top1 与 Top2 置信度差 < 10%
  let doubt = "";
  if (top3.length >= 2 && top3[0].conf - top3[1].conf < 10) {
    const missing = Object.keys(top3[0].sy.feat).filter(f => !top3[0].evidence.includes(f)).slice(0, 4);
    doubt = `<div class="doubt-box"><b>⚠ 辨证存疑：</b>Top1 与 Top2 证型置信度差 < 10%，建议进一步补充问诊。建议追加的鉴别问题：
      <ul>${missing.length ? missing.map(m => `<li>是否${esc(m)}？</li>`).join("") : "<li>请复核舌脉信息是否录入完整。</li>"}</ul></div>`;
  }

  const rank = ["Top1", "Top2", "Top3"];
  $("syndrome-cards").innerHTML = doubt + top3.map((x, i) => `
    <div class="syn-card ${i === 0 ? "top1" : ""}">
      <div class="syn-head">
        <div class="syn-name">${rank[i]} · ${esc(x.sy.name)} ${i === 0 ? '<span class="tag">推荐</span>' : ""}</div>
        <div class="conf-badge">${x.conf}%</div>
      </div>
      <div class="conf-bar"><div class="conf-fill" style="width:0%" data-w="${x.conf}"></div></div>
      <div class="syn-evidence"><b>辨证依据：</b>${x.evidence.length ? esc(x.evidence.join("、")) : "（信息较少，置信度偏低）"}</div>
      <div class="syn-negative">不支持依据：尚未见${esc(Object.keys(x.sy.feat).filter(f => !x.evidence.includes(f)).slice(0,3).join("、") || "明显阴性指征")}；治法宜「${esc(x.sy.treat)}」。</div>
      <div style="margin-top:10px"><button class="btn ${i === 0 ? "btn-primary" : "btn-ghost"}" onclick="confirmSyndrome(${i})">确认此证型</button></div>
    </div>`).join("") + `
    <p class="cpa-note">AI 推荐，仅供医师参考，最终诊断由执业医师作出。医生确认/修改行为将回流模型样本库。</p>`;

  requestAnimationFrame(() => setTimeout(() => document.querySelectorAll(".conf-fill").forEach(el => el.style.width = el.dataset.w + "%"), 60));
  state.result = top3;
}

function confirmSyndrome(i){
  const item = state.result[i];
  state.confirmed = item.sy;
  $("confirmed-syndrome").textContent = item.sy.name;
  $("confirm-area").classList.remove("hidden");
  $("prescription-area").classList.add("hidden");
  $("record-area").classList.add("hidden");

  const sy = item.sy;
  const f = FORMULAS.find(x => sy.formula.startsWith(x.name)) || FORMULAS[0];
  state.rxHerbs = f.herbs.map(([n, d, role]) => ({
    name: n, dose: parseInt(d), unit: d.replace(/\d+/g, "") || "g", max: parseInt(d), min: Math.max(1, Math.round(parseInt(d) * 0.5)), role
  }));
  $("treatment-area").innerHTML = `
    <div class="trx-block"><b>治法</b><span>${esc(sy.treat)}</span></div>
    <div class="trx-block"><b>经典方剂</b><div class="formula-title">${esc(f.name)} <span class="formula-src">${esc(f.source)}</span></div>
      <div style="font-size:.85rem;color:var(--ink-2);margin-top:4px">主治：${esc(f["主治"])}</div></div>
    <div class="trx-block"><b>中成药推荐</b><span>${esc(sy.patent)}</span></div>
    ${sy.contra && sy.contra.hypertension && PATIENTS[state.dxPatient].hypertension ? `<div class="doubt-box"><b>⚠ 既往史冲突提醒：</b>${esc(sy.contra.hypertension)}</div>` : ""}`;
  renderRx();
  $("confirm-area").classList.remove("hidden");
  toast(`已确认证型：${sy.name}，推荐治法与方剂已生成`);
}

/* ---------- 处方微调与禁忌校验 ---------- */
const ADD_HERBS = ["海藻", "半夏", "黄芪", "川芎", "酸枣仁", "熟地黄", "当归", "黄连"];
function renderRx(){
  $("rx-herbs").innerHTML = state.rxHerbs.map((h, i) => `
    <div class="rx-herb-row">
      <span class="hname">${esc(h.name)}</span>
      <span class="rx-dose">
        <a onclick="adjDose(${i},-1)" class="chip" style="padding:2px 10px">−</a>
        <input value="${h.dose}" onchange="setDose(${i},this.value)"> ${esc(h.unit)}
        <a onclick="adjDose(${i},1)" class="chip" style="padding:2px 10px">＋</a>
        <span class="rx-role">常用区间 ${h.min}-${h.max}${esc(h.unit)}</span>
        ${h.dose > h.max ? '<span class="dose-warn">⚠ 超药典常用剂量，请谨慎</span>' : ""}
      </span>
      <span class="rx-role">${esc(h.role)}</span>
    </div>`).join("");
  $("add-herb-tags").innerHTML = ADD_HERBS.map(n => {
    const inRx = state.rxHerbs.some(h => h.name === n);
    return `<a class="chip ${inRx ? "on" : ""}" onclick="addHerb('${n}',this)">${n}${inRx ? " ✓" : ""}</a>`;
  }).join("");
  checkContra();
}
function adjDose(i, d){ state.rxHerbs[i].dose = Math.max(0, state.rxHerbs[i].dose + d); renderRx(); }
function setDose(i, v){ const n = parseInt(v); if (!isNaN(n)) state.rxHerbs[i].dose = n; renderRx(); }
function addHerb(name, el){
  const idx = state.rxHerbs.findIndex(h => h.name === name);
  if (idx >= 0) { state.rxHerbs.splice(idx, 1); }
  else {
    const kb = HERBS.find(h => h.name === name);
    state.rxHerbs.push({ name, dose: 9, unit: "g", max: 12, min: 3, role: "加减" });
    if (kb && kb.warn && kb.warn.includes("十八反")) toast(`${name}：${kb.warn.split("；")[0]}`);
  }
  renderRx();
}

function checkContra(){
  const p = PATIENTS[state.dxPatient];
  const names = state.rxHerbs.map(h => h.name);
  const hits = [];
  for (const r of CONTRA_RULES) if (names.includes(r.a) && names.includes(r.b)) hits.push(r.msg);
  if (p.pregnant) for (const h of names) if (PREGNANCY_FORBIDDEN.includes(h)) hits.push(`妊娠禁忌：方中含${h}，孕妇禁用，请立即调整。`);
  if (p.hypertension && names.includes("甘草")) {
    const g = state.rxHerbs.find(h => h.name === "甘草");
    if (g && g.dose >= 10) hits.push("既往史冲突：患者有高血压病史，方中甘草剂量较大（≥10g），建议减量并监测血压。");
  }
  state.contraActive = hits.length > 0;
  const box = $("contraindication-alert");
  if (hits.length) {
    box.classList.remove("hidden");
    box.innerHTML = `<b>⛔ 禁忌校验命中（规则召回率目标 100%）</b>
      <ul style="margin:6px 0 0 18px;font-size:.86rem">${hits.map(h => `<li>${esc(h)}</li>`).join("")}</ul>
      <p style="font-size:.8rem;margin-top:8px">继续开具须填写理由：</p>
      <textarea id="contra-reason" placeholder="请说明继续使用的临床理由（必填）…"></textarea>`;
  } else {
    box.classList.add("hidden");
  }
}

function generateRecord(){
  if (state.contraActive) {
    const reason = ($("contra-reason") || {}).value || "";
    if (!reason.trim()) { toast("存在禁忌命中，必须填写理由方可继续"); return; }
  }
  if (!state.rxHerbs.length) { toast("处方为空，无法生成病历"); return; }
  const p = PATIENTS[state.dxPatient];
  const sy = state.confirmed;
  const f = FORMULAS.find(x => sy.formula.startsWith(x.name)) || FORMULAS[0];
  const wang = [...state.sel.tongueZhi, ...state.sel.tongueTai].join("、") || "未记录";
  const pulse = [...state.sel.pulseL, ...state.sel.pulseR].join("、") || "未记录";
  const symptoms = [...state.sel.symptoms].slice(0, 10).join("、") || "详见问诊记录";
  $("record-preview").textContent =
`【患者】${p.name}（${p.sex}，${p.age} 岁）  就诊日期：2026-10-12
【科室】中医内科 3 诊室   【就诊类型】门诊复诊
────────────────────────
【主诉】${symptoms.split("、")[0] || "不适"}，加重就诊。
【四诊摘要】
 · 望诊：面色${[...state.sel.face].join("、") || "未记录"}；舌质舌苔：${wang}；舌形：${[...state.sel.tongueXing].join("、") || "未记录"}
 · 闻诊：${[...state.sel.voice, ...state.sel.smell].join("、") || "未记录"}
 · 问诊：${symptoms}
 · 切诊：脉象 ${pulse}；按诊：${[...state.sel.palp].join("、") || "未记录"}
【辨证】${sy.name}（AI Top 推荐置信度 ${state.result ? state.result[0].conf : "—"}%，医师已确认）
【治法】${sy.treat}
【方药】${f.name}加减（出处：${f.source}）
${state.rxHerbs.map(h => ` · ${h.name} ${h.dose}${h.unit}（${h.role}）`).join("\n")}
【禁忌校验】${state.contraActive ? "命中并已填写临床理由备案" : "未命中禁忌规则（十八反/十九畏/妊娠/证候禁忌校验通过）"}
【按语】依《中医病历书写基本规范》生成；诊疗行为（采纳/修改）已回流模型样本库。
────────────────────────
AI 推荐，仅供医师参考，最终诊断由执业医师作出。`;
  $("record-area").classList.remove("hidden");
  $("record-area").scrollIntoView({ behavior: "smooth", block: "start" });
  toast("结构化病历已生成，可导出 PDF 或回写 EMR");
}

/* ================= 医案库 ================= */
function renderCases(){
  const kw = ($("case-kw").value || "").trim();
  const sySel = $("case-syndrome").value;
  if (!$("case-syndrome").options.length) {
    $("case-syndrome").innerHTML = '<option value="">全部证型</option>' + [...new Set(CASES.map(c => c.syn))].map(s => `<option>${esc(s)}</option>`).join("");
  }
  const famousOnly = $("case-famous").checked;
  const list = CASES.filter(c =>
    (!kw || [c.patient, c.disease, c.syn, c.formula, c.doctor].some(v => v.includes(kw))) &&
    (!sySel || c.syn === sySel) && (!famousOnly || c.famous));
  $("case-list").innerHTML = list.length ? list.map((c, i) => `
    <div class="case-item" onclick="toggleCase('tc-${i}')">
      <div class="case-top"><b>${esc(c.patient)} · ${esc(c.disease)} ${c.famous ? '<span class="tag amber">名老医案</span>' : ""}</b><span class="tl-date">${esc(c.date)}</span></div>
      <div class="case-meta">${esc(c.doctor)} · ${esc(c.adopt)}</div>
      <div class="case-syn-tags"><span class="tag">${esc(c.syn)}</span><span class="tag blue">${esc(c.formula)}</span></div>
      <div class="hidden" id="tc-${i}">
        <p style="font-size:.86rem;margin-top:10px;color:var(--ink-2)">${esc(c.note)}</p>
        <div class="timeline"><div class="tl-item"><b>${esc(c.date)}</b><br>${esc(c.syn)} → ${esc(c.formula)}</div>
        <div class="tl-item"><b>本诊</b><br>辨证结论已结构化入库，可用于教学检索与模型回标。</div></div>
      </div>
    </div>`).join("") : '<div class="card empty-state">未检索到匹配医案</div>';
}
function toggleCase(id){ $(id).classList.toggle("hidden"); }

/* ================= 知识库 ================= */
let kbCur = "herbs";
function kbTab(k){
  kbCur = k;
  document.querySelectorAll(".kb-tab").forEach(el => el.classList.toggle("active", el.dataset.k === k));
  renderKb();
}
function renderKb(){
  const kw = ($("kb-kw").value || "").trim();
  let html = "";
  if (kbCur === "herbs") {
    const list = HERBS.filter(h => !kw || h.name.includes(kw) || h.effect.includes(kw));
    html = list.map(h => `<div class="kb-item" onclick="showHerb('${h.name}')"><div><b>${esc(h.name)}</b><small>${esc(h.prop)}</small></div><span class="tag">详情</span></div>`).join("");
  } else if (kbCur === "formulas") {
    const list = FORMULAS.filter(f => !kw || f.name.includes(kw) || f.treat.includes(kw));
    html = list.map(f => `<div class="kb-item" onclick="showFormula('${f.name}')"><div><b>${esc(f.name)}</b><small>${esc(f.treat)} · ${esc(f.source)}</small></div><span class="tag">详情</span></div>`).join("");
  } else {
    const list = SYNDROMES.filter(s => !kw || s.name.includes(kw) || s.treat.includes(kw));
    html = list.map((s, i) => `<div class="kb-item" onclick="showSyndrome(${i})"><div><b>${esc(s.name)}</b><small>治法：${esc(s.treat)}</small></div><span class="tag">详情</span></div>`).join("");
  }
  $("kb-list").innerHTML = html || '<div class="card empty-state">未检索到内容</div>';
}
function openDetail(html){ $("kb-detail").innerHTML = `<div class="kb-detail-inner" onclick="event.stopPropagation()">${html}<button class="kb-close" onclick="closeKbDetail()">×</button></div>`; $("kb-detail").classList.remove("hidden"); }
function closeKbDetail(){ $("kb-detail").classList.add("hidden"); }
function showHerb(name){
  const h = HERBS.find(x => x.name === name);
  openDetail(`<h3>${esc(h.name)}</h3><div class="kb-sub">中药知识库 · 内容版本 V1.0（2026-10-12 审核）</div>
    <div class="kv"><b>性味归经</b><span>${esc(h.prop)}</span></div>
    <div class="kv"><b>功效</b><span>${esc(h.effect)}</span></div>
    <div class="kv"><b>用法用量</b><span>${esc(h.usage)}</span></div>
    <div class="kv"><b>禁忌</b><div class="kb-warn">${esc(h.warn)}</div></div>`);
}
function showFormula(name){
  const f = FORMULAS.find(x => x.name === name);
  openDetail(`<h3>${esc(f.name)}</h3><div class="kb-sub">${esc(f.source)} · 方剂知识库 V1.0</div>
    <div class="kv"><b>功用</b><span>${esc(f.treat)}</span></div>
    <div class="kv"><b>主治</b><span>${esc(f["主治"])}</span></div>
    <div class="kv"><b>组成（君臣佐使）</b>${f.herbs.map(([n, d, r]) => `<span style="display:inline-block;margin:2px 6px 2px 0;font-size:.85rem">${esc(n)} ${esc(d)} <small style="color:var(--ink-3)">[${esc(r)}]</small></span>`).join("")}</div>`);
}
function showSyndrome(i){
  const s = SYNDROMES[i];
  openDetail(`<h3>${esc(s.name)}</h3><div class="kb-sub">证型库 V1.0 · 覆盖内科/妇科/儿科高频病种</div>
    <div class="kv"><b>治法</b><span>${esc(s.treat)}</span></div>
    <div class="kv"><b>主症特征</b><span>${esc(Object.keys(s.feat).join("、"))}</span></div>
    <div class="kv"><b>舌脉参考</b><span>舌：${esc(s.tongue.join("/"))} ｜ 脉：${esc(s.pulse.join("/"))}</span></div>
    <div class="kv"><b>代表方剂</b><span>${esc(s.formula)}（${esc(s.source)}）</span></div>
    <div class="kv"><b>中成药</b><span>${esc(s.patent)}</span></div>`);
}

/* ================= 运营看板（SVG 图表） ================= */
function renderCharts(){
  // 周活跃医生折线
  const wau = OPS.wau, max = Math.max(...wau) * 1.15, min = Math.min(...wau) * 0.8;
  const W = 420, H = 200, PL = 36, PB = 26, PT = 12, PR = 12;
  const px = i => PL + i * (W - PL - PR) / (wau.length - 1);
  const py = v => PT + (H - PT - PB) * (1 - (v - min) / (max - min));
  const pts = wau.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  let area = `M ${px(0)},${py(wau[0])} ` + wau.map((v, i) => `L ${px(i)},${py(v)}`).join(" ") + ` L ${px(wau.length-1)},${H-PB} L ${px(0)},${H-PB} Z`;
  $("chart-wau").innerHTML = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7C3AED" stop-opacity=".28"/><stop offset="1" stop-color="#7C3AED" stop-opacity="0"/></linearGradient></defs>
    ${[0,1,2,3].map(i => `<line x1="${PL}" x2="${W-PR}" y1="${PT + i*(H-PT-PB)/3}" y2="${PT + i*(H-PT-PB)/3}" stroke="#E8E6F2" stroke-dasharray="4 4"/>`).join("")}
    <path d="${area}" fill="url(#g1)"/>
    <polyline points="${pts}" fill="none" stroke="#7C3AED" stroke-width="2.5" stroke-linejoin="round"/>
    ${wau.map((v,i) => `<circle cx="${px(i)}" cy="${py(v)}" r="3.5" fill="#fff" stroke="#7C3AED" stroke-width="2"/><text x="${px(i)}" y="${py(v)-9}" font-size="9" text-anchor="middle" fill="#4B465E">${v}</text>`).join("")}
    ${wau.map((_,i) => i % 2 === 0 ? `<text x="${px(i)}" y="${H-8}" font-size="9" text-anchor="middle" fill="#8B87A0">W${i+1}</text>` : "").join("")}
  </svg>`;

  // 采纳分布环形图
  const total = OPS.adopt.reduce((n, x) => n + x[1], 0);
  let acc = 0, arcs = "";
  const cx = 100, cy = 100, r = 70, r2 = 46;
  OPS.adopt.forEach(([label, v, color]) => {
    const a0 = acc / total * Math.PI * 2 - Math.PI / 2, a1 = (acc + v) / total * Math.PI * 2 - Math.PI / 2;
    acc += v;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    arcs += `<path d="M ${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A ${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} L ${cx + r2 * Math.cos(a1)},${cy + r2 * Math.sin(a1)} A ${r2},${r2} 0 ${large} 0 ${cx + r2 * Math.cos(a0)},${cy + r2 * Math.sin(a0)} Z" fill="${color}"/>`;
  });
  $("chart-adopt").innerHTML = `<svg class="chart-svg" viewBox="0 0 420 200">
    ${arcs}<text x="100" y="96" font-size="20" font-weight="700" text-anchor="middle" fill="#1E1B2E">58%</text>
    <text x="100" y="114" font-size="10" text-anchor="middle" fill="#8B87A0">直接采纳</text>
    ${OPS.adopt.map(([label, v, color], i) => `<rect x="215" y="${58 + i * 28}" width="12" height="12" rx="3" fill="${color}"/><text x="234" y="${68 + i * 28}" font-size="11" fill="#4B465E">${label} ${v}%</text>`).join("")}
  </svg>`;

  // 横向条形图（Top 证型）
  const ts = OPS.topSyn, tsMax = Math.max(...ts.map(x => x[1]));
  $("chart-syndrome").innerHTML = `<svg class="chart-svg" viewBox="0 0 420 ${ts.length * 30 + 10}">
    ${ts.map(([n, v], i) => `
      <text x="0" y="${i * 30 + 20}" font-size="10.5" fill="#4B465E">${esc(n)}</text>
      <rect x="92" y="${i * 30 + 9}" width="${(v / tsMax) * 240}" height="14" rx="7" fill="${i === 0 ? "#7C3AED" : "#2563EB"}" opacity="${1 - i * 0.12}"/>
      <text x="${92 + (v / tsMax) * 240 + 8}" y="${i * 30 + 20}" font-size="10" fill="#8B87A0">${v}</text>`).join("")}
  </svg>`;

  // 置信度分布
  const cf = OPS.conf, cfMax = Math.max(...cf.map(x => x[1]));
  $("chart-conf").innerHTML = `<svg class="chart-svg" viewBox="0 0 420 ${cf.length * 30 + 10}">
    ${cf.map(([n, v], i) => `
      <text x="0" y="${i * 30 + 20}" font-size="10.5" fill="#4B465E">${esc(n)}</text>
      <rect x="110" y="${i * 30 + 9}" width="${(v / cfMax) * 230}" height="14" rx="7" fill="${n.includes("存疑") ? "#DC2626" : "#7C3AED"}" opacity="${1 - i * 0.13}"/>
      <text x="${110 + (v / cfMax) * 230 + 8}" y="${i * 30 + 20}" font-size="10" fill="#8B87A0">${v}%</text>`).join("")}
  </svg>`;
}

/* ================= 初始化 ================= */
(function init(){
  renderDash();
  renderDxPatient();
  renderDxTags();
  updateDxCount();
})();
