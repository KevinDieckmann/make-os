// ─── Datenschutz-Umfeld für die Selbstprüfung (Server, 05.10.) ──────────────
// Sammelt, was `selbstpruefung` (lib/crm/datenschutz.ts) außerhalb des CRM braucht: Verantwortlicher und Empfänger aus der
// Einrichtung, zweiter Faktor der Konten im Haushalt des Inhabers, Verfahren der letzten Nachtsicherung (Statusdatei
// `system/sicherung.json`, geschrieben von deploy/sicherung.sh — fehlt sie, „unbekannt“), Agenten-Schalter. Nur Zahlen und
// Namen von Diensten — nie Personendaten. Wirft nie (im Zweifel der vorsichtige Wert).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { datenOrdner, loadJson } from '@/lib/store/local-db';
import { ladeKonten } from '@/lib/zugang/konten';
import { ALL_AGENTS } from '@/lib/make-one/agents-data';
import type { AgentConfigMap } from '@/lib/agent-config';
import type { DatenschutzUmfeld } from '@/lib/crm/datenschutz';
import { empfaengerWirksam, verantwortlicherWirksam } from './einrichtung';
import { ladeEinrichtung } from './einrichtung-server';
import { PANNEN_SPEICHER, panneOffen, type PannenDatei } from './pannen';

/** Die Statusdatei der Nachtsicherung (Klartext, nur Zahlen) — null, wenn es keine gibt. */
export async function sicherungsStatus(): Promise<DatenschutzUmfeld['sicherung']> {
  try {
    const j = JSON.parse(await fs.readFile(path.join(datenOrdner(), 'system', 'sicherung.json'), 'utf8')) as { verfahren?: unknown; zeit?: unknown };
    if (!j || typeof j !== 'object') return null;
    const verfahren = j.verfahren === 'age' || j.verfahren === 'openssl' ? j.verfahren : null;
    return { verfahren, ...(typeof j.zeit === 'string' ? { zeit: j.zeit } : {}) };
  } catch { return null; }
}

export async function datenschutzUmfeld(): Promise<DatenschutzUmfeld> {
  const e = await ladeEinrichtung().catch(() => ({}));
  const w = verantwortlicherWirksam(e);
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  const haushalt = konten.filter(k => k === inhaber || (!!inhaber?.haushalt && k.haushalt === inhaber.haushalt));
  const cfg = (await loadJson<AgentConfigMap>('agents-config').catch(() => null)) ?? {};
  return {
    verantwortlicher: { gesetzt: !!w.v, quelle: w.quelle, luecken: w.luecken },
    empfaenger: empfaengerWirksam(e),
    zweiterFaktor: { konten: haushalt.length, mit: haushalt.filter(k => !!k.zweiterFaktor).length },
    sicherung: await sicherungsStatus(),
    agenten: { aktiv: ALL_AGENTS.filter(a => cfg[a.id]?.enabled !== false).length, gesamt: ALL_AGENTS.length },
    pannen: await pannenLage(),
  };
}

/** Offene und dringende Pannen (nur Zahlen). */
async function pannenLage(): Promise<{ offen: number; dringend: number }> {
  const d = await loadJson<PannenDatei>(PANNEN_SPEICHER).catch(() => null);
  const jetzt = new Date().toISOString();
  const offen = (d?.pannen ?? []).filter(p => !p.abgeschlossenAm);
  return { offen: offen.length, dringend: (d?.pannen ?? []).filter(p => panneOffen(p, jetzt).some(x => x.dringend)).length };
}
