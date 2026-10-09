// ─── MAKE OS — Eine Planungs-Vorlage anlegen: nur über die bestehenden Schreibwege (client-sicher, 09.10.) ──────────────────────────────
// Ziel (Ziele-PATCH, Horizont Jahr), Meilensteine (Meilensteine-PATCH) und Aufgaben (/api/tasks/create mit `meilensteinId`) — nacheinander, mit
// den festen Kennungen der Vorlage: Vorhandenes wird erkannt und nie doppelt angelegt (Ziel und Meilensteine über die Kennung, Aufgaben über
// den gleichen Titel in derselben Meilenstein-Liste — das prüft der Server). Ein zweiter Lauf ergänzt nur, was fehlt. Was schon steht, bleibt
// auch bei einem Fehler stehen. Die Abfrage ist austauschbar (`holen`), damit ein Test die echten Routen im Prozess ansprechen kann.
// Genutzt vom Plan „Business online“ in der Einrichtung (components/os/BusinessOnlineVorlage.tsx).

import type { Fahrplan } from '@/lib/gesellschaften/fahrplan';

export type Holen = (pfad: string, init?: RequestInit) => Promise<Response>;
export interface VorlageErgebnis { ziel: boolean; meilensteine: number; aufgaben: number; schonDa: number }

const json = async (r: Response): Promise<Record<string, unknown>> => {
  const d = await r.json().catch(() => null) as Record<string, unknown> | null;
  if (!r.ok || !d || d.ok === false || (typeof d.error === 'string' && d.error)) throw new Error(typeof d?.error === 'string' ? d.error : `Antwort ${r.status}.`);
  return d;
};
const PATCH = (body: unknown): RequestInit => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Legt an, was von der Vorlage fehlt. `schritt` meldet den Fortschritt („Meilensteine …“). Wirft mit dem Grund des Servers. */
export async function planVorlageAnlegen(f: Fahrplan, holen: Holen = (p, i) => fetch(p, i), schritt: (text: string) => void = () => {}): Promise<VorlageErgebnis> {
  const aus: VorlageErgebnis = { ziel: false, meilensteine: 0, aufgaben: 0, schonDa: 0 };
  schritt('Ziel …');
  const ziele = await json(await holen('/api/state/ziele', { cache: 'no-store' }));
  if (!((ziele.jahr ?? []) as { id: string }[]).some(z => z?.id === f.ziel.id)) {
    await json(await holen('/api/state/ziele', PATCH({ horizont: 'jahr', ops: [{ op: 'upsert', eintrag: f.ziel }] })));
    aus.ziel = true;
  }
  schritt('Meilensteine …');
  const ms = await json(await holen('/api/state/meilensteine', { cache: 'no-store' }));
  const vorhanden = new Set(((ms.meilensteine ?? []) as { id: string }[]).map(m => m?.id));
  const neu = f.meilensteine.filter(m => !vorhanden.has(m.id));
  if (neu.length) {
    await json(await holen('/api/state/meilensteine', PATCH({ ops: neu.map(m => ({ op: 'upsert', eintrag: m })) })));
    aus.meilensteine = neu.length;
  }
  let i = 0;
  for (const a of f.aufgaben) {
    schritt(`Aufgaben ${++i}/${f.aufgaben.length} …`);
    const r = await json(await holen('/api/tasks/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: a.titel, meilensteinId: a.meilensteinId }) }));
    if (r.duplikat) aus.schonDa++; else aus.aufgaben++;
  }
  return aus;
}
