#!/usr/bin/env node
// ─── MAKE OS — Prüfmodell: eine nachgebaute Messages-API für lokale Prüfungen (09.10.2026, „Agenten live durchgeklickt“) ─────────────
// Kevin 09.10.: „Das muss perfekt laufen. Schau, dass alles verbunden ist und die Agents sauber laufen.“ Damit man die Agenten-Oberfläche mit
// ANTWORTENDEN Agenten bedienen kann, ohne echten KI-Aufruf und ohne Schlüssel, beantwortet dieses Skript `POST /v1/messages` regelbasiert und
// mit erfundenen Texten — als JSON oder als Strom (Server-Sent Events: message_start · content_block_start/_delta/_stop · message_delta ·
// message_stop, mit `usage`), inklusive Werkzeug-Aufrufen (`tool_use`): ZOE fragt bzw. beauftragt Heads (`head_fragen`, `an_head`), ein Head
// delegiert an einen Mitarbeiter (`an_mitarbeiter`) und legt Vorschläge an (`create_task` → Freigabe-Stapel), Mitarbeiter lesen und berichten.
// Die App spricht es NUR über MAKE_OS_KI_PRUEFENDPUNKT an (lib/ki/pruefendpunkt.ts: nur loopback, nur Demo/Entwicklung, fester Platzhalter-Schlüssel).
//
// Start:   node scripts/ki-pruefmodell.mjs [--port 4599] [--tempo 12]     (--port 0 = freier Port; die erste Zeile nennt die Adresse)
// App:     MAKE_OS_KI_PRUEFENDPUNKT=http://127.0.0.1:4599  (dazu MAKE_OS_DEMO=1 bzw. Entwicklung)
// Steuern (nur für Prüfskripte, nur 127.0.0.1):
//   GET  /_lage                          → { anfragen, modus, letzte: [kurze Zusammenfassungen ohne Inhalte Dritter] }
//   POST /_modus {"fehler":"529"|"abbruch"|"401"|"429"|"aus","anzahl":n}  → die nächsten n Anfragen (ohne anzahl: bis „aus“) scheitern so
//   In einer Nachricht wirkt auch „[pruef:529]“ bzw. „[pruef:abbruch]“ nur für diese eine Antwort.
// Keine Pakete, kein Netz nach draußen, lauscht nur auf 127.0.0.1. Antworten sind ERFUNDEN — nie für echte Entscheidungen.

import http from 'node:http';

const arg = (name, vorgabe) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : vorgabe; };
const PORT = Number(arg('port', process.env.PRUEFMODELL_PORT ?? '4599'));
const TEMPO = Math.max(0, Number(arg('tempo', '12'))); // ms zwischen zwei Strom-Stücken — damit man den Text entstehen sieht

let anzahl = 0;
let modus = { fehler: 'aus', rest: Infinity };
const letzte = [];

// ── Lesen der Anfrage ───────────────────────────────────────────────────────────────────────────────────────────────────────

const systemText = b => (Array.isArray(b.system) ? b.system.map(x => (typeof x === 'string' ? x : x?.text ?? '')).join('\n') : String(b.system ?? ''));
const blocke = c => (typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : []);
const textVon = c => blocke(c).filter(x => x?.type === 'text').map(x => x.text ?? '').join('\n');
const ergebnisText = r => (typeof r.content === 'string' ? r.content : blocke(r.content).map(x => x.text ?? '').join('\n'));

function lies(b) {
  const msgs = Array.isArray(b.messages) ? b.messages : [];
  const letzteN = msgs[msgs.length - 1];
  const ergebnisse = letzteN?.role === 'user' ? blocke(letzteN.content).filter(x => x?.type === 'tool_result') : [];
  // Die eigentliche Frage: der jüngste Text einer Person (nicht ein Werkzeug-Ergebnis).
  let frage = '';
  for (let i = msgs.length - 1; i >= 0 && !frage; i--) if (msgs[i].role === 'user') frage = textVon(msgs[i].content).trim();
  const gerufen = msgs.filter(m => m.role === 'assistant').flatMap(m => blocke(m.content)).filter(x => x?.type === 'tool_use').map(x => x.name);
  const tools = new Map((Array.isArray(b.tools) ? b.tools : []).filter(t => t?.name).map(t => [t.name, t]));
  return { system: systemText(b), frage, ergebnisse: ergebnisse.map(ergebnisText), gerufen, tools, nachWerkzeug: ergebnisse.length > 0 };
}

// ── Antworten bauen ─────────────────────────────────────────────────────────────────────────────────────────────────────────

let toolNr = 0;
const text = t => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });
const werkzeug = (name, input, vorweg) => ({ content: [...(vorweg ? [{ type: 'text', text: vorweg }] : []), { type: 'tool_use', id: `toolu_pruef_${++toolNr}`, name, input }], stop_reason: 'tool_use' });
const zahlDe = n => n.toLocaleString('de-DE');
const kurz = (t, n) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/** Heads aus dem ZOE-Prompt („- sales · Head of Sales (Business) — …“) bzw. aus dem Werkzeug-Schema. */
function headsAus(system) {
  const r = [];
  for (const z of system.split('\n')) { const m = /^- ([a-z0-9-]+) · ([^(]+?) \((Business|Privat)\)/.exec(z.trim()); if (m) r.push({ id: m[1], name: m[2].trim() }); }
  return r;
}
function headFinden(wort, heads) {
  const w = String(wort ?? '').toLowerCase().replace(/[^a-zäöüß0-9-]/g, '');
  if (!w) return null;
  return heads.find(h => h.id === w || h.name.toLowerCase() === w || h.name.toLowerCase().endsWith(` ${w}`) || h.name.toLowerCase().includes(w)) ?? (heads.length ? null : { id: w, name: w });
}

/** Ein Wort hinter „frag“/„@“/„an“ — der gemeinte Head. */
function gemeinterHead(frage, heads) {
  const kandidaten = [];
  const at = /@([A-Za-zÄÖÜäöüß-]+)/.exec(frage); if (at) kandidaten.push(at[1]);
  const fr = /\bfrag\w*\s+(?:mal\s+)?(?:den\s+|die\s+|das\s+)?(?:head\s+of\s+)?([A-Za-zÄÖÜäöüß-]+)/i.exec(frage); if (fr) kandidaten.push(fr[1]);
  const an = /\ban\s+(?:den\s+|die\s+)?(?:head\s+of\s+)?([A-Za-zÄÖÜäöüß-]+)/i.exec(frage); if (an) kandidaten.push(an[1]);
  for (const h of heads) if (new RegExp(`\\b${h.name.replace(/^Head of /, '').toLowerCase()}\\b`, 'i').test(frage)) kandidaten.push(h.id);
  for (const k of kandidaten) { const h = headFinden(k, heads); if (h) return h; }
  return null;
}

/** Ein Aufgabentitel aus der Frage: was hinter dem Doppelpunkt steht, sonst ein plausibler Titel. */
function titelAus(frage) {
  const nach = frage.split(/:\s*/).slice(1).join(': ').trim();
  if (nach) return kurz(nach.replace(/[.!?]+$/, ''), 90);
  const m = /aufgabe\s+(?:an(?:legen)?|für|zu[mr]?)\s+(.+)/i.exec(frage);
  return m ? kurz(m[1].replace(/[.!?]+$/, ''), 90) : 'Offene Angebote durchsehen und nachfassen';
}

/** Zeilen aus einem Abschnitt des System-Texts (best effort) — damit eine Antwort echte Demo-Daten nennt. */
function zeilenAus(system, muster, n) {
  const zeilen = system.split('\n');
  const r = [];
  for (let i = 0; i < zeilen.length && r.length < n; i++) {
    if (!muster.test(zeilen[i])) continue;
    for (let j = i + 1; j < zeilen.length && r.length < n; j++) {
      const z = zeilen[j].trim();
      if (!z) { if (r.length) break; continue; }
      // Nur Zeilen, die nach Daten aussehen (Frist, Datum, Uhrzeit, Klammer) — keine Regeln des System-Texts.
      if (/^[-•·*]|^\d+[.)]/.test(z) && /fällig|\d{4}-\d{2}-\d{2}|\b\d{1,2}:\d{2}\b|\[/.test(z)) r.push(kurz(z.replace(/^[-•·*]\s*|^\d+[.)]\s*/, '').replace(/\s*\[[^\]]*\]/g, ''), 110));
      else if (r.length) break;
    }
  }
  return r;
}

/** Hüllen (`<fremde_daten …>`, `<daten …>`) aus einem Werkzeug-Ergebnis nehmen — ein Modell gibt die Kapselung nicht wörtlich zurück. */
const ohneHuelle = t => t.replace(/<\/?(fremde_daten|daten)[^>]*>/g, '');
/** Erste Zeilen eines Werkzeug-Ergebnisses ohne Kopf- und Hülle-Zeilen. */
function kern(ergebnis, n) {
  return ohneHuelle(ergebnis).split('\n').map(z => z.trim()).filter(z => z && !/^(ANTWORT von|KOPF|TEIL )/.test(z) && !/^(Ich sehe in den Daten nach|Ich lese zuerst|Hier ist, was ich gefunden habe)/.test(z)).slice(0, n);
}

/** Antwort nach einem Werkzeug-Ergebnis: zusammenfassen, was das Werkzeug gemeldet hat. */
function nachWerkzeug(l, rolle) {
  const alle = l.ergebnisse.join('\n');
  // Mitarbeiter: nach dem Lesen EINEN Vorschlag anlegen (wenn er darf und noch keinen gemacht hat), danach berichten.
  if (rolle.art === 'mitarbeiter' && l.tools.has('crm_vorschlag') && !l.gerufen.includes('crm_vorschlag') && !/PROBELAUF/.test(l.system)) {
    const kontakt = /\b(c-[0-9a-f]{8}-[0-9a-f-]{27})\b/.exec(alle)?.[1];
    const deal = /\b(ch-[a-z0-9-]{4,60})\b/.exec(alle)?.[1];
    if (kontakt || deal) {
      const tag = new Date(Date.now() + 2 * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
      return werkzeug('crm_vorschlag', { art: 'followup', ...(kontakt ? { kontakt } : { deal }), text: 'Zum offenen Angebot nachfassen', faellig: tag, followup_art: 'anruf' }, 'Ich lege dazu einen Nachfass-Vorschlag an.');
    }
  }
  const antwort = /ANTWORT von ([^(\n]+?)\s*\(/.exec(alle);
  if (antwort) {
    const punkte = kern(alle, 4).map(z => `• ${kurz(z.replace(/^[•·-]\s*/, ''), 150)}`);
    return text(`Ich habe bei ${antwort[1].trim()} nachgefragt:\n${punkte.join('\n') || '• Keine Auffälligkeiten.'}\n\nSoll ich daraus etwas anstoßen — zum Beispiel ${antwort[1].includes('Sales') ? 'die überfälligen Deals nachfassen lassen' : 'einen Auftrag an den Head geben'}?`);
  }
  if (/gesendet/i.test(alle)) return text(`Erledigt: ${kurz(ohneHuelle(alle), 260)}\n\nDer Bericht kommt hierher zurück, sobald er fertig ist.`);
  if (/VORGESCHLAGEN|Freigabe-Stapel|Stapel/i.test(alle)) {
    const was = /— ([^:]+: [^.]*?)\. Das liegt/.exec(alle)?.[1];
    return text(`Ich habe das als Vorschlag in den Freigabe-Stapel gelegt${was ? ` (${kurz(was, 140)})` : ''} — übernommen wird es erst per Klick.`);
  }
  if (/TROCKENLAUF/.test(alle)) return text(`Probelauf: ${kurz(alle, 200)} Ergebnis: Anleitung befolgt, nichts gespeichert.`);
  const zeilen = kern(alle, 5);
  if (rolle.art === 'mitarbeiter') {
    return text(`Bericht: Ich habe die Daten durchgesehen.\n${zeilen.length ? zeilen.map(z => `• ${kurz(z, 120)}`).join('\n') : '• Keine Auffälligkeiten.'}\n\nOffen: nichts. Im Stapel: ${l.gerufen.includes('crm_vorschlag') ? 'ein Nachfass-Vorschlag' : 'nichts'}.`);
  }
  return text(`Hier ist, was ich gefunden habe:\n${zeilen.length ? zeilen.map(z => `• ${kurz(z, 140)}`).join('\n') : '• Dazu gibt es gerade nichts.'}`);
}

/** Wer spricht? (aus dem System-Text) */
function rolleVon(system) {
  const m = /Du bist „([^“]+)“, Mitarbeiter im Team von ([^.\n]+)/.exec(system);
  if (m) return { art: 'mitarbeiter', name: m[1], head: m[2] };
  if (/Du bist ZOE/.test(system)) return { art: 'zoe', name: 'ZOE' };
  const h = /Du bist (Head of [A-Za-zÄÖÜäöüß-]+|CEO-Office|[A-ZÄÖÜ][\wäöüß-]+(?: [A-ZÄÖÜ&][\wäöüß-]*)*)\. Dein Auftrag/.exec(system);
  if (h) return { art: 'head', name: h[1] };
  return { art: 'sonst', name: '' };
}

const LESER = ['pipeline', 'sales_lage', 'crm_suche', 'angebote_lage', 'qualifizierung_lage', 'mandate_lage', 'kennzahlen', 'datenqualitaet', 'meine_aufgaben', 'business_index', 'haushalt_stand'];

function frischeAntwort(l, rolle) {
  const f = l.frage;
  if (rolle.art === 'zoe') {
    const heads = headsAus(l.system);
    const head = gemeinterHead(f, heads);
    if (head && l.tools.has('an_head') && /\b(gib|übergib|beauftrag\w*|schick\w*|delegier\w*|auftrag)\b/i.test(f)) return werkzeug('an_head', { head: head.id, auftrag: kurz(f, 300) }, `Ich gebe das an ${head.name}.`);
    if (head && l.tools.has('head_fragen') && (/\bfrag\w*\b|@/i.test(f) || /\bwie steht\b/i.test(f))) return werkzeug('head_fragen', { head: head.id, frage: kurz(f.replace(/@\S+\s*/, ''), 400) }, `Ich frage bei ${head.name} nach.`);
    if (l.tools.has('create_task') && /\baufgabe\b|\btodo\b|\berinner/i.test(f)) return werkzeug('create_task', { title: titelAus(f), priority: 'medium', why: 'Aus dem Gespräch mit ZOE (Prüfmodell)' });
    if (/heute|ansteht|steht an|überblick|lage/i.test(f)) {
      const auf = zeilenAus(l.system, /AUFGABE|Aufgaben/i, 3);
      const ter = zeilenAus(l.system, /TERMIN|Termine|Kalender/i, 2);
      const teile = ['Guten Tag! Kurz zu heute:'];
      teile.push(auf.length ? `Aufgaben:\n${auf.map(a => `• ${a}`).join('\n')}` : '• Drei Aufgaben sind heute fällig — die wichtigste zuerst, danach die Nachfass-Liste.');
      teile.push(ter.length ? `Termine:\n${ter.map(a => `• ${a}`).join('\n')}` : '• Ein Termin am Nachmittag; davor ist ein Fokusblock von 90 Minuten frei.');
      teile.push('Mein Vorschlag: zuerst die überfälligen Deals, dann die Freigaben im Stapel. Soll ich Sales nach der Pipeline fragen?');
      return text(teile.join('\n\n'));
    }
    return text(`Verstanden. ${kurz(f, 120) ? `Zu „${kurz(f, 80)}“: ` : ''}Ich habe mir die Lage angesehen — nichts Dringendes offen. Sag mir, ob ich einen Head fragen oder eine Aufgabe vorschlagen soll.`);
  }
  if (rolle.art === 'head') {
    const ma = l.tools.get('an_mitarbeiter');
    if (ma && /mitarbeiter|delegier|prüfen lassen|lass\b.*\b(prüfen|durchsehen|recherchieren)/i.test(f)) {
      const liste = ma.input_schema?.properties?.mitarbeiter?.enum ?? [];
      const passend = liste.find(id => /angebot/i.test(f) && /angebot/.test(id)) ?? liste.find(id => /nachfass|power/i.test(f) && /nachfass/.test(id)) ?? liste.find(id => /qualifi/i.test(f) && /qualifi/.test(id)) ?? liste.find(id => /recherch/i.test(f) && /recherch/.test(id)) ?? liste.find(id => /nachfass/.test(id)) ?? liste[0];
      if (passend) return werkzeug('an_mitarbeiter', { mitarbeiter: passend, auftrag: { ziel: kurz(f, 200), format: 'Kurzer Bericht mit Belegen und höchstens einem Vorschlag im Stapel', grenzen: 'Nichts senden, nur Vorschläge, keine privaten Daten', quellen: 'Pipeline, Angebote und Kontakte des Bereichs' } }, 'Das gebe ich an einen Mitarbeiter.');
    }
    if (l.tools.has('create_task') && /\baufgabe\b|follow-?up|vorschlag|leg\w*\b.*\ban\b/i.test(f)) return werkzeug('create_task', { title: titelAus(f), priority: 'high', why: `Vorschlag von ${rolle.name} (Prüfmodell)` }, 'Ich lege das als Vorschlag an.');
    const leser = LESER.find(w => l.tools.has(w));
    if (leser && /pipeline|lage|wie steht|zahlen|überblick|offen/i.test(f) && !l.gerufen.length) return werkzeug(leser, {}, 'Ich sehe in den Daten nach.');
    return text(`${rolle.name} hier. ${kurz(f, 80) ? `Zu „${kurz(f, 70)}“: ` : ''}In meinem Bereich ist alles im Plan — 2 Punkte brauchen diese Woche Aufmerksamkeit, beide liegen als Vorschlag bereit, sobald du sie freigibst.`);
  }
  if (rolle.art === 'mitarbeiter') {
    if (/PROBELAUF/.test(l.system)) return text(`Probelauf nach Anleitung: ich würde ${[...l.tools.keys()].filter(w => LESER.includes(w)).slice(0, 2).join(' und ') || 'die Daten'} lesen und das Ergebnis knapp zusammenfassen. Nichts gespeichert.`);
    // Mitarbeiter lesen bevorzugt, was Kennungen trägt (Personen, Deals) — damit sie danach einen Vorschlag mit echtem Bezug machen können.
    const leser = ['crm_suche', 'sales_lage', 'angebote_lage', ...LESER].find(w => l.tools.has(w));
    if (leser && !l.gerufen.length) return werkzeug(leser, {}, 'Ich lese zuerst die Daten.');
    return text(`Bericht: Auftrag erledigt.\n• Durchgesehen: Pipeline und offene Angebote.\n• Auffällig: ein Angebot wartet seit über einer Woche.\nOffen: nichts. Im Stapel: nichts.`);
  }
  return text(`Kurzer Überblick: alles im Plan. ${zahlDe(3)} Punkte sind diese Woche wichtig — Fokus auf die überfälligen, dann Pause einplanen.`);
}

// ── JSON (strukturierte Ausgabe) ────────────────────────────────────────────────────────────────────────────────────────────

function ausSchema(s, name = '', tiefe = 0) {
  if (!s || typeof s !== 'object' || tiefe > 6) return null;
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
  const typ = Array.isArray(s.type) ? s.type.find(t => t !== 'null') : s.type;
  if (typ === 'object' || s.properties) return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, ausSchema(v, k, tiefe + 1)]));
  if (typ === 'array') return s.maxItems === 0 ? [] : [ausSchema(s.items, name, tiefe + 1)];
  if (typ === 'number' || typ === 'integer') return typeof s.minimum === 'number' ? s.minimum : 1;
  if (typ === 'boolean') return true;
  return `${name ? `${name}: ` : ''}Hinweis aus dem Prüfmodell`;
}

/** „Antworte NUR mit JSON: {"a": string, "b": boolean[] …}“ — die Felder aus dem Muster im Text lesen und füllen. */
function ausMuster(system, user) {
  const i = system.search(/JSON/);
  const ab = i >= 0 ? system.slice(i) : system;
  const n = (user.match(/<erwartungen>([\s\S]*?)<\/erwartungen>/)?.[1] ?? '').split('\n').filter(z => /^\s*\d+\.\s/.test(z)).length || 1;
  const o = {};
  for (const m of ab.matchAll(/"([A-Za-z_]\w*)"\s*:\s*(boolean\[\]|string\[\]|number\[\]|boolean|string|number|true|false|\[|\{|"[^"]*"|\d+)/g)) {
    const [, k, t] = m;
    if (k in o) continue;
    o[k] = t === 'boolean[]' ? Array.from({ length: n }, () => true) : t === 'string[]' || t === '[' ? [] : t === 'number[]' ? [] : t === 'boolean' || t === 'true' ? true : t === 'false' ? false
      : t === 'number' || /^\d+$/.test(t) ? 1 : t === '{' ? {} : k === 'notiz' ? 'Alle Erwartungen erfüllt (Prüfmodell).' : `${k}: Hinweis aus dem Prüfmodell`;
  }
  return o;
}

function antworte(b) {
  const l = lies(b);
  const rolle = rolleVon(l.system);
  const schema = b.output_config?.format?.schema;
  if (schema) return { ...text(JSON.stringify(ausSchema(schema))), art: 'json-schema', rolle };
  if (/Antworte NUR mit JSON|nur mit JSON|ausschließlich (?:mit )?JSON|NUR JSON/i.test(l.system) && !l.tools.size) return { ...text(JSON.stringify(ausMuster(l.system, l.frage))), art: 'json-muster', rolle };
  if (l.nachWerkzeug) return { ...nachWerkzeug(l, rolle), art: 'nach-werkzeug', rolle };
  return { ...frischeAntwort(l, rolle), art: 'frisch', rolle };
}

// ── Leitung ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const zeile = (name, d) => `event: ${name}\ndata: ${JSON.stringify(d)}\n\n`;
const stueckeVon = (t, n) => { const r = []; for (let i = 0; i < t.length; i += n) r.push(t.slice(i, i + n)); return r; };
const warte = ms => new Promise(r => setTimeout(r, ms));
const tokenAus = s => Math.max(1, Math.round(String(s).length / 4));

function fehlerAntwort(res, code) {
  const typ = code === 529 ? 'overloaded_error' : code === 429 ? 'rate_limit_error' : code === 401 ? 'authentication_error' : 'api_error';
  res.writeHead(code, { 'content-type': 'application/json', 'request-id': `req_pruef_${anzahl}` });
  res.end(JSON.stringify({ type: 'error', error: { type: typ, message: code === 529 ? 'Overloaded' : `Prüfmodell: Fehler ${code}` } }));
}

async function messages(req, res, roh) {
  anzahl++;
  let b;
  try { b = JSON.parse(roh); } catch { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'kein JSON' } })); return; }
  const magie = /\[pruef:(529|abbruch|401|429|500)\]/.exec(JSON.stringify(b.messages ?? ''))?.[1];
  const fehler = magie ?? (modus.fehler !== 'aus' && modus.rest > 0 ? modus.fehler : null);
  if (!magie && fehler) { modus.rest--; if (modus.rest <= 0) modus = { fehler: 'aus', rest: Infinity }; }
  const a = antworte(b);
  const ein = tokenAus(roh);
  const ausgabe = a.content.map(c => c.text ?? JSON.stringify(c.input ?? {})).join('');
  const usage = { input_tokens: ein, output_tokens: tokenAus(ausgabe) };
  letzte.push({ nr: anzahl, zeit: new Date().toISOString(), modell: b.model, strom: b.stream === true, rolle: a.rolle?.art, art: a.art, werkzeuge: (b.tools ?? []).length,
    antwort: a.content.map(c => (c.type === 'tool_use' ? `tool_use:${c.name}` : 'text')).join('+'), fehler: fehler ?? undefined });
  if (letzte.length > 60) letzte.shift();
  if (fehler && fehler !== 'abbruch') return fehlerAntwort(res, Number(fehler));
  if (b.stream !== true) {
    if (fehler === 'abbruch') { req.socket.destroy(); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'request-id': `req_pruef_${anzahl}` });
    res.end(JSON.stringify({ id: `msg_pruef_${anzahl}`, type: 'message', role: 'assistant', model: b.model, content: a.content, stop_reason: a.stop_reason, stop_sequence: null, usage }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'request-id': `req_pruef_${anzahl}` });
  const schreib = async s => { if (!res.destroyed) res.write(s); if (TEMPO) await warte(TEMPO); };
  await schreib(zeile('message_start', { type: 'message_start', message: { id: `msg_pruef_${anzahl}`, type: 'message', role: 'assistant', model: b.model, content: [], stop_reason: null, usage: { input_tokens: ein, output_tokens: 1 } } }));
  for (let i = 0; i < a.content.length; i++) {
    const c = a.content[i];
    if (c.type === 'text') {
      await schreib(zeile('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }));
      const teile = stueckeVon(c.text, 9);
      for (let k = 0; k < teile.length; k++) {
        // Fehler-Modus „abbruch“: nach einem Drittel des Textes reißt die Leitung (wie ein abgebrochener Strom).
        if (fehler === 'abbruch' && k >= Math.max(1, Math.floor(teile.length / 3))) { res.destroy(); return; }
        await schreib(zeile('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: teile[k] } }));
      }
    } else if (c.type === 'tool_use') {
      await schreib(zeile('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: c.id, name: c.name, input: {} } }));
      for (const t of stueckeVon(JSON.stringify(c.input ?? {}), 14)) await schreib(zeile('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: t } }));
    }
    await schreib(zeile('content_block_stop', { type: 'content_block_stop', index: i }));
  }
  if (fehler === 'abbruch') { res.destroy(); return; }
  await schreib(zeile('message_delta', { type: 'message_delta', delta: { stop_reason: a.stop_reason, stop_sequence: null }, usage: { output_tokens: usage.output_tokens } }));
  await schreib(zeile('message_stop', { type: 'message_stop' }));
  res.end();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  let roh = '';
  req.setEncoding('utf8');
  req.on('data', d => { roh += d; if (roh.length > 8_000_000) req.destroy(); });
  req.on('end', () => {
    if (req.method === 'POST' && url.pathname === '/v1/messages') { messages(req, res, roh).catch(e => { if (!res.headersSent) fehlerAntwort(res, 500); console.error('[Prüfmodell]', e?.message ?? e); }); return; }
    if (req.method === 'GET' && url.pathname === '/_lage') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ anfragen: anzahl, modus: { fehler: modus.fehler, rest: Number.isFinite(modus.rest) ? modus.rest : null }, letzte })); return; }
    if (req.method === 'POST' && url.pathname === '/_modus') {
      let j = {}; try { j = JSON.parse(roh || '{}'); } catch { /* leer */ }
      const f = String(j.fehler ?? 'aus');
      modus = ['529', 'abbruch', '401', '429', '500'].includes(f) ? { fehler: f, rest: Number(j.anzahl) > 0 ? Number(j.anzahl) : Infinity } : { fehler: 'aus', rest: Infinity };
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, modus: modus.fehler })); return;
    }
    res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'Prüfmodell kennt nur POST /v1/messages' } }));
  });
});
server.listen(PORT, '127.0.0.1', () => {
  const adr = server.address();
  console.log(`Prüfmodell bereit auf http://127.0.0.1:${typeof adr === 'object' && adr ? adr.port : PORT} — Antworten sind erfunden, kein echter KI-Aufruf.`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
