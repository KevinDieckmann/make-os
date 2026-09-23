// ─── MAKE OS — Der Bote ─────────────────────────────────────────────────────
// Holt Nachrichten von Telegram ab und gibt sie der App. Sonst nichts.
//
// Wie der Arbeiter (worker.mjs) ein eigener Prozess: stürzt die App ab,
// wartet der Bote; stirbt der Bote, läuft die App weiter. Er kennt keine
// Fachlogik — jede Nachricht geht an /api/telegram/eingang, und die App
// entscheidet, wer da schreibt und was damit passiert.
//
// Warum Abholen (long polling) statt Webhook: läuft auf Kevins Mac ohne
// öffentliche Adresse. Auf dem Server kann später ein Webhook dasselbe tun —
// die Route ist dieselbe.
//
// Start: node bote.mjs   (start.sh macht das, wenn TELEGRAM_BOT_TOKEN gesetzt ist)

import { readFileSync } from 'node:fs';

const ORT = process.env.MAKE_OS_URL ?? 'http://localhost:3001';

function ausEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const zeile = readFileSync(new URL('.env.local', import.meta.url), 'utf8')
      .split('\n').find(z => z.startsWith(`${name}=`));
    return zeile ? zeile.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const KEY = ausEnv('MAKE_OS_KEY');
const TOKEN = ausEnv('TELEGRAM_BOT_TOKEN');
if (!KEY || !TOKEN) {
  console.error('[Bote] MAKE_OS_KEY oder TELEGRAM_BOT_TOKEN fehlt — ohne beides bleibe ich stumm. Beende.');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const kopf = { 'Content-Type': 'application/json', 'x-make-key': KEY };
const zeit = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Wo weitermachen: die App merkt sich die letzte verarbeitete update_id. */
async function startOffset() {
  try {
    const r = await fetch(`${ORT}/api/telegram/eingang`, { headers: kopf, signal: AbortSignal.timeout(10_000) });
    const d = await r.json();
    return typeof d.letzteUpdate === 'number' ? d.letzteUpdate + 1 : 0;
  } catch { return 0; }
}

let offset = await startOffset();
let weiter = true;
let appWeg = 0;
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { console.log(`[${zeit()}] Bote hört auf.`); weiter = false; setTimeout(() => process.exit(0), 300); });
}

console.log(`[${zeit()}] Bote läuft. Ziel: ${ORT}, ab update ${offset}.`);

while (weiter) {
  try {
    // Telegram hält die Verbindung bis zu 25 Sekunden offen und antwortet
    // sofort, wenn etwas kommt. Das ist billiger als jede Sekunde zu fragen.
    const r = await fetch(`${API}/getUpdates?offset=${offset}&timeout=25&allowed_updates=%5B%22message%22%5D`, {
      signal: AbortSignal.timeout(35_000),
    });
    const d = await r.json();
    if (!d.ok) { console.log(`[${zeit()}] Telegram: ${d.description ?? r.status}`); await new Promise(x => setTimeout(x, 5000)); continue; }
    for (const u of d.result ?? []) {
      offset = u.update_id + 1;
      try {
        const a = await fetch(`${ORT}/api/telegram/eingang`, {
          method: 'POST', headers: kopf, body: JSON.stringify({ update: u }), signal: AbortSignal.timeout(180_000),
        });
        const e = await a.json();
        console.log(`[${zeit()}] ${e.person ?? 'unbekannt'} → ${e.was ?? (e.ok ? 'ok' : e.error ?? 'fehler')}`);
        appWeg = 0;
      } catch (err) {
        appWeg++;
        console.log(`[${zeit()}] App nicht erreichbar: ${String(err?.message ?? err).slice(0, 80)}`);
        if (appWeg >= 30) { console.log(`[${zeit()}] App seit Langem weg. Bote beendet sich.`); weiter = false; }
        await new Promise(x => setTimeout(x, 3000));
      }
    }
  } catch (err) {
    console.log(`[${zeit()}] Abholen fehlgeschlagen: ${String(err?.message ?? err).slice(0, 80)}`);
    await new Promise(x => setTimeout(x, 5000));
  }
}
