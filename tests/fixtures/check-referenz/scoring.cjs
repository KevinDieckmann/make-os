// Referenz-Implementierung der Auswertung des MAKE Innovations-Checks.
// Reines JavaScript ohne Abhängigkeiten, läuft in Node und im Browser.
// Die verbindlichen Regeln stehen in data/scoring.json; diese Datei setzt sie um.

const DIM_BY_SECTION = { B: 'strategie', C: 'ki', D: 'automatisierung', E: 'daten', F: 'robotik', G: 'team' };

function loadCatalog(catalog) {
  const byId = {};
  for (const sec of catalog.abschnitte) for (const q of sec.fragen) byId[q.id] = { ...q, abschnitt: sec.id };
  return byId;
}

// Punkte einer einzelnen Antwort (0 bis 4) oder null, wenn sie nicht zählt.
// answer: { optionIds: [...] } für einfach/mehrfach, { belegScore: 0..4 } für Beleg-Fragen.
function pointsFor(q, answer) {
  if (!answer) return null;
  if (q.typ === 'beleg') return Number.isInteger(answer.belegScore) ? answer.belegScore : null;
  if (q.typ === 'einfach') {
    const opt = q.optionen.find(o => o.id === answer.optionIds?.[0]);
    return opt && typeof opt.punkte === 'number' ? opt.punkte : null;
  }
  if (q.typ === 'mehrfach') {
    const ids = answer.optionIds || [];
    if (ids.some(id => id.endsWith('_keine'))) return 0;
    const n = ids.length;
    if (n === 0) return null;
    return n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
  }
  return null; // offen, Profil und Branchen-Module zählen nicht
}

function isRoboticsRelevant(profile, rules) {
  return rules.robotik.relevante_branchen.includes(profile.branche) || profile.logistik === true;
}

function score(catalog, rules, profile, answers) {
  const byId = loadCatalog(catalog);
  const sums = {}, counts = {};
  for (const [qid, ans] of Object.entries(answers)) {
    const q = byId[qid];
    if (!q) continue;
    const dim = DIM_BY_SECTION[q.abschnitt];
    if (!dim) continue;
    const p = pointsFor(q, ans);
    if (p === null) continue;
    sums[dim] = (sums[dim] || 0) + p;
    counts[dim] = (counts[dim] || 0) + 1;
  }
  const dims = {};
  for (const d of Object.keys(sums)) dims[d] = Math.round((sums[d] / (4 * counts[d])) * 100);

  // Plausibilitätsregel: ohne konkreten Beleg keine hohen Werte (Vorschlag, der Inhaber bestätigt)
  const c5 = answers.C5?.belegScore;
  if (dims.ki !== undefined && (c5 === 0 || c5 === 1)) dims.ki = Math.min(dims.ki, 60);
  const d6 = answers.D6?.belegScore;
  if (dims.automatisierung !== undefined && d6 === 0) dims.automatisierung = Math.min(dims.automatisierung, 60);

  const robotik = isRoboticsRelevant(profile, rules) && counts.robotik > 0;
  const weights = { strategie: 15, ki: 30, automatisierung: 30, daten: 10, robotik: robotik ? 5 : 0, team: robotik ? 10 : 15 };
  if (!robotik) delete dims.robotik;

  let wsum = 0, total = 0;
  for (const [d, w] of Object.entries(weights)) {
    if (dims[d] === undefined || w === 0) continue;
    total += dims[d] * w; wsum += w;
  }
  const gesamt = wsum ? Math.round(total / wsum) : 0;
  const stufe = rules.stufen.find(s => gesamt >= s.von && gesamt <= s.bis);

  // Genauigkeit: 80 % der Fragen aus B bis E und G beantwortet
  const core = Object.values(byId).filter(q => 'BCDEG'.includes(q.abschnitt));
  const answeredCore = core.filter(q => pointsFor(q, answers[q.id]) !== null).length;
  const genauigkeit = answeredCore / core.length >= 0.8 ? 'genau' : 'vorlaeufig';

  return { dimensionen: dims, gewichte: weights, gesamt, stufe: stufe.stufe, stufe_name: stufe.name, genauigkeit, robotik_gewertet: robotik };
}

function gaps(result, benchmarks, branche) {
  const bm = benchmarks.dimension_benchmark_start.werte_0_100[branche] || benchmarks.dimension_benchmark_start.werte_0_100.default;
  return Object.entries(result.dimensionen)
    .map(([d, v]) => ({ dimension: d, wert: v, branche: bm[d], abstand: bm[d] - v }))
    .sort((a, b) => b.abstand - a.abstand || a.wert - b.wert)
    .slice(0, 3);
}

function leadScore(ls, profile, result, behaviour) {
  const get = (key, val, fallback = 1) => (val in key ? key[val] : fallback);
  const t = ls.automatisch_aus_dem_check;
  let p = 0;
  p += get(t[0].werte, profile.groesse);
  p += get(t[1].werte, profile.umsatz ?? 'keine_angabe', 2);
  p += get(t[2].werte, profile.rolle);
  p += profile.budgetPunkte === undefined ? t[3].fehlt : t[3].werte_nach_punkten[String(profile.budgetPunkte)];
  p += t[4].werte[String(result.stufe)];
  p += behaviour.gespraechGebucht ? 5 : behaviour.berichtGeoeffnet ? 3 : 1;
  p += behaviour.gratisProdukte >= 2 ? 5 : behaviour.gratisProdukte === 1 ? 3 : 1;
  let klasse = p >= 26 ? 'A' : p >= 18 ? 'B' : 'C';
  if (profile.branche === 'tech' && profile.startup && profile.phase === 0 && klasse === 'A') klasse = 'B';
  return { punkte: p, klasse };
}

module.exports = { score, gaps, leadScore, pointsFor };
