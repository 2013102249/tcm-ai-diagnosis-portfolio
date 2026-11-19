/**
 * 云诊中医大脑 · 辨证评测跑分脚本
 * 用途：在自建 [仿真] 评测集上复刻 Demo 的辨证评分逻辑，产出可复现的真实跑分数字。
 * 运行：node eval/run-eval.js
 * 说明：本脚本评的是 Demo 内置规则引擎，不代表真实临床 AI 模型效果。
 */
const fs = require("fs");
const path = require("path");

// 从 Demo 的 data.js 加载真实证型库与禁忌规则（不复制数据，保证评测对象与 Demo 一致）
let code = fs.readFileSync(path.join(__dirname, "..", "demo", "js", "data.js"), "utf8");
code += "\nmodule.exports={SYNDROMES,CONTRA_RULES,PREGNANCY_FORBIDDEN};";
const mod = { exports: {} };
new Function("module", "exports", code)(mod, mod.exports);
const { SYNDROMES, CONTRA_RULES, PREGNANCY_FORBIDDEN } = mod.exports;

// ===== 复刻 app.js runDiagnosis 的评分逻辑（保持一致，保证跑分对应 Demo 行为）=====
function scoreOne(sy, symptoms, tongueAll, pulseAll) {
  let score = 0, evidence = [];
  for (const [feat, w] of Object.entries(sy.feat)) {
    let hit = symptoms.has(feat);
    if (!hit) for (const s2 of symptoms) { if (s2.includes(feat) || feat.includes(s2)) { hit = true; break; } }
    if (hit) { score += w; evidence.push(feat); }
  }
  const tHits = sy.tongue.filter(t => tongueAll.some(x => x.includes(t) || t.includes(x)));
  const pHits = sy.pulse.filter(t => pulseAll.includes(t));
  score += tHits.length * 2 + pHits.length * 2.5;
  return { score, evidence };
}
function diagnose(symptoms, tongueAll, pulseAll) {
  const ranked = SYNDROMES.map(sy => ({ name: sy.name, ...scoreOne(sy, symptoms, tongueAll, pulseAll) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return ranked;
}

// ===== 构造 60 条 [仿真] 评测集（确定性，可复现）=====
const cases = [];
let id = 0;
// A. 正常集 40 条：每证型 5 条变体，取高权重症状 + 舌脉
SYNDROMES.forEach((sy, i) => {
  const feats = Object.keys(sy.feat); // data.js 中按权重从高到低书写
  const variants = [
    [feats.slice(0, 3), [sy.tongue[0], sy.tongue[1] || sy.tongue[0]], [sy.pulse[0]]],
    [feats.slice(0, 4), [sy.tongue[0]], [sy.pulse[0]]],
    [[feats[0], feats[1], feats[2], feats[4] || feats[0]], [sy.tongue[1] || sy.tongue[0]], [sy.pulse[0]]],
    [feats.slice(0, 5), [sy.tongue[0]], [sy.pulse[1] || sy.pulse[0]]],
    [[feats[0], feats[2], feats[3] || feats[0]], [sy.tongue[0]], [sy.pulse[0]]]
  ];
  variants.forEach(([sym, tg, pl], v) => cases.push({
    id: ++id, dim: "正常", gold: sy.name, symptoms: sym, tongue: tg, pulse: pl, tag: sy.name.slice(0, 4) + "-v" + (v + 1)
  }));
});
// B. 边界集 10 条：仅 2 个症状、无舌脉（信息不足）
for (let k = 0; k < 10; k++) {
  const sy = SYNDROMES[k % SYNDROMES.length];
  const feats = Object.keys(sy.feat);
  cases.push({ id: ++id, dim: "边界", gold: sy.name, symptoms: feats.slice(0, 2), tongue: [], pulse: [], tag: "低信息量-" + (k + 1) });
}
// C. 混淆/对抗集 10 条：取主证型 1 个高权重特征 + 2 个跨证型共用症状
const shared = ["纳呆", "神疲乏力", "头晕", "耳鸣", "失眠", "急躁易怒", "胸胁胀痛", "腰膝酸软"];
for (let k = 0; k < 10; k++) {
  const sy = SYNDROMES[(k * 3) % SYNDROMES.length];
  const feats = Object.keys(sy.feat);
  const sym = [feats[0], shared[(k * 2) % shared.length], shared[(k * 2 + 3) % shared.length]];
  cases.push({ id: ++id, dim: "混淆", gold: sy.name, symptoms: [...new Set(sym)], tongue: [sy.tongue[0]], pulse: [], tag: "近似证型-" + (k + 1) });
}

// ===== 跑分 =====
const byDim = { 正常: [], 边界: [], 混淆: [] };
cases.forEach(c => {
  const ranked = diagnose(new Set(c.symptoms), c.tongue, c.pulse);
  const top1 = ranked[0] ? ranked[0].name : null;
  const top3 = ranked.slice(0, 3).map(r => r.name);
  c.top1 = top1; c.hit1 = top1 === c.gold; c.hit3 = top3.includes(c.gold);
  byDim[c.dim].push(c);
});
function rate(arr, key) { return arr.length ? Math.round(arr.filter(x => x[key]).length / arr.length * 100) : 0; }
const overall1 = rate(cases, "hit1"), overall3 = rate(cases, "hit3");

// ===== 禁忌召回测试 =====
// 正例：应命中（18 条）；反例：不应命中（7 条）
function contraHit(names, { pregnant = false, hypertension = false, licoriceDose = 6 } = {}) {
  const hits = [];
  for (const r of CONTRA_RULES) if (names.includes(r.a) && names.includes(r.b)) hits.push(r.type);
  if (pregnant) for (const n of names) if (PREGNANCY_FORBIDDEN.includes(n)) hits.push("妊娠禁忌");
  if (hypertension && names.includes("甘草") && licoriceDose >= 10) hits.push("既往史冲突");
  return hits;
}
const contraPos = [
  [["甘草", "海藻"], {}], [["半夏", "附子"], {}], [["人参", "藜芦"], {}],
  [["人参", "五灵脂"], {}], [["丁香", "郁金"], {}], [["甘草", "甘遂"], {}],
  [["藜芦", "白芍"], {}], [["附子", "瓜蒌"], {}],
  [["附子"], { pregnant: true }], [["三棱"], { pregnant: true }],
  [["麝香"], { pregnant: true }], [["水蛭"], { pregnant: true }],
  [["甘草"], { hypertension: true, licoriceDose: 12 }], [["甘草"], { hypertension: true, licoriceDose: 15 }]
];
const contraNeg = [
  [["柴胡", "当归", "白芍", "白术", "茯苓", "甘草"], {}],
  [["天麻", "钩藤", "石决明", "栀子", "牛膝"], {}],
  [["黄芪", "人参", "白术", "当归", "茯苓", "酸枣仁"], {}],
  [["黄连", "黄芩", "白芍", "阿胶"], {}],
  [["补骨脂", "肉豆蔻", "五味子"], {}],
  [["柴胡", "陈皮", "川芎", "枳壳", "香附"], {}],
  [["甘草"], { hypertension: true, licoriceDose: 6 }]
];
const recallHit = contraPos.filter(([n, o]) => contraHit(n, o).length > 0).length;
const fpHit = contraNeg.filter(([n, o]) => contraHit(n, o).length > 0).length;

// ===== 时延（规则引擎纯计算，Node 环境，微秒级；不代表线上 AI P95）=====
const t0 = process.hrtime.bigint();
for (let i = 0; i < 1000; i++) diagnose(new Set(["眩晕", "头痛", "耳鸣"]), ["红"], ["弦数"]);
const t1 = process.hrtime.bigint();
const perCallMs = Number(t1 - t0) / 1e6 / 1000; // 单次毫秒

// ===== 输出 =====
const result = {
  evaluatedAt: new Date().toISOString(),
  engine: "Demo 内置规则引擎（复刻 app.js 评分逻辑，非真实临床模型）",
  dataset: { size: cases.length, source: "仿真构造", dims: { 正常: byDim.正常.length, 边界: byDim.边界.length, 混淆: byDim.混淆.length } },
  top1: { overall: overall1, 正常: rate(byDim.正常, "hit1"), 边界: rate(byDim.边界, "hit1"), 混淆: rate(byDim.混淆, "hit1") },
  top3: { overall: overall3, 正常: rate(byDim.正常, "hit3"), 边界: rate(byDim.边界, "hit3"), 混淆: rate(byDim.混淆, "hit3") },
  contraindication: { posCases: contraPos.length, recallHit, recallRate: Math.round(recallHit / contraPos.length * 100), negCases: contraNeg.length, falsePositive: fpHit, falsePositiveRate: Math.round(fpHit / contraNeg.length * 100) },
  latencyMsRuleEngine: Number(perCallMs.toFixed(4)),
  misCases: cases.filter(c => !c.hit1).slice(0, 8).map(c => ({ tag: c.tag, dim: c.dim, gold: c.gold, top1: c.top1, symptoms: c.symptoms }))
};
console.log(JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(__dirname, "result.json"), JSON.stringify(result, null, 2));
