#!/usr/bin/env node
// ─── Modellstufen „bisher“ gegen „neu“ vergleichen (09.10.2026, Paket 6a) ──────────────────────────────────────────────────
// Kevin 08.10. (Antwort 20): „Haiku 5.5 / Sonnet 5.5 / Opus 5.5 nach Test“. Fragt POST /api/heads/eval mit `vergleich: true` am laufenden
// MAKE OS: dieselben gespeicherten Fälle der Heads (Replay, `heads-replay-<head>`) mit beiden Sätzen, je Prüfung pass^k, Kosten, Empfehlung
// (lib/ki/stufen-vergleich.ts). Gibt NUR Zahlen und Prüfungsnamen aus — keine Inhalte, keine Namen.
//
//   Auf dem Server:  docker compose exec app node scripts/ki-stufen-vergleich.mjs --url http://localhost:3000 --person <inhaber> --ja
//   Lokal:           node scripts/ki-stufen-vergleich.mjs [--url http://localhost:3001] [--person <inhaber>] [--head sales] [--n 5] [--k 3] --ja
//
// Kostet Modell-Aufrufe: zwei Sätze × n Fälle × k Wiederholungen je Head (Vorgabe 5 × 3). Ohne --ja nur die Übersicht, was laufen würde.
// Der Dienstschlüssel kommt aus der Umgebung bzw. .env.local (MAKE_OS_KEY) und wird nie ausgegeben. Umgestellt wird NICHT — das macht Kevin
// (Umgebung MAKE_OS_KI_STUFEN=neu oder System › Datenschutz › KI › Modellstufen).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, standard) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : standard; };
const url = arg('url', 'http://localhost:3001').replace(/\/$/, '');
const person = arg('person', '');
const heads = arg('head', 'sales,marketing,event').split(',').map(h => h.trim()).filter(h => /^(sales|marketing|event)$/.test(h));
const n = Math.max(1, Math.min(10, Number(arg('n', '5')) || 5));
const k = Math.max(1, Math.min(3, Number(arg('k', '3')) || 3));

function schluessel() {
  if (process.env.MAKE_OS_KEY) return process.env.MAKE_OS_KEY;
  const datei = path.join(wurzel, '.env.local');
  if (!existsSync(datei)) return null;
  const zeile = readFileSync(datei, 'utf8').split('\n').find(z => /^\s*MAKE_OS_KEY\s*=/.test(z));
  return zeile ? zeile.replace(/^\s*MAKE_OS_KEY\s*=\s*/, '').trim().replace(/^["']|["']$/g, '') : null;
}

console.log(`Vergleich der Modellstufen: Heads ${heads.join(', ')} · je ${n} Fälle × ${k} Wiederholungen × 2 Sätze`);
if (!process.argv.includes('--ja')) { console.log('Kostet Modell-Aufrufe — mit --ja starten.'); process.exit(0); }
const key = schluessel();
if (!key) { console.error('MAKE_OS_KEY fehlt (Umgebung oder .env.local).'); process.exit(1); }
if (person && !/^[a-z0-9-]{1,40}$/.test(person)) { console.error('--person: Speichername.'); process.exit(1); }

const prozent = x => `${String(x).padStart(3)} %`;
for (const head of heads) {
  const r = await fetch(`${url}/api/heads/eval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-make-key': key, ...(person ? { 'x-make-person': person } : {}) },
    body: JSON.stringify({ head, n, k, vergleich: true }),
    signal: AbortSignal.timeout(60 * 60_000),
  }).catch(e => ({ ok: false, status: 0, json: async () => ({ fehler: e instanceof Error ? e.message : 'Netz' }) }));
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.vergleich) { console.log(`\n${head}: ${d.fehler ?? d.error ?? `HTTP ${r.status}`}`); continue; }
  const v = d.vergleich;
  console.log(`\n── Head ${head} ── bisher ${JSON.stringify(d.modelle.bisher)} · neu ${JSON.stringify(d.modelle.neu)}`);
  for (const p of v.je_pruefung) console.log(`  ${p.label.padEnd(44)} bisher ${prozent(p.bisher)}  neu ${prozent(p.neu)}  (${p.delta >= 0 ? '+' : ''}${p.delta})`);
  console.log(`  Mittel: bisher ${prozent(v.bisher.quote)} (${(v.bisher.kostenCent / 100).toFixed(2)} $) · neu ${prozent(v.neu.quote)} (${(v.neu.kostenCent / 100).toFixed(2)} $) · Fälle ${v.bisher.faelle}/${v.neu.faelle} · Fehler ${v.bisher.fehler}/${v.neu.fehler}`);
  console.log(`  Empfehlung: ${v.empfehlung} — ${v.grund}`);
}
