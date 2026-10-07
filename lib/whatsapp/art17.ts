// ─── WhatsApp — Art. 15/17 für eine Person der Kartei (rein, 07.10.2026) ───────────────────────────────────────────────
// Der Spiegel der Business-Nummer (`whatsapp-spiegel`) nennt Dritte über ihre Nummer (wa_id), ihren Profilnamen und Texte.
// Art. 17 (lib/crm/person-weitere.ts → `WEITERE_SPEICHER`): alle Nachrichten mit einer Nummer der Person (Telefon/Mobil der Akte,
// `PersonMerkmale.telefone`) und alle Nachrichten, die sie sonst nennen (Name, Adresse, Kennung) fallen weg, ebenso der Eintrag der
// Nummer. Die abgelegten Medien dieser Nachrichten löscht der nächste Takt (Dateien ohne Nachricht, lib/whatsapp/medien.ts).
// Art. 15 zählt dieselben Einträge (`waZaehlen`). Bei Meta liegen Nachrichten höchstens 30 Tage (Faktendatei A4) — nichts zu tun.

import type { PersonMerkmale } from '@/lib/crm/person-weitere';
import type { WaKontakt, WaNachricht } from './typen';

type Obj = Record<string, unknown>;
/** `nenntPerson` aus person-weitere.ts (als Argument — kein Import im Kreis). */
export type Nennt = (wert: unknown, m: PersonMerkmale) => boolean;

const nummernVon = (m: PersonMerkmale): Set<string> => new Set((m.telefone ?? []).filter(Boolean));

function teile(cur: Obj): { nachrichten: Record<string, WaNachricht>; kontakte: Record<string, WaKontakt> } {
  const n = cur?.nachrichten && typeof cur.nachrichten === 'object' && !Array.isArray(cur.nachrichten) ? cur.nachrichten as Record<string, WaNachricht> : {};
  const k = cur?.kontakte && typeof cur.kontakte === 'object' && !Array.isArray(cur.kontakte) ? cur.kontakte as Record<string, WaKontakt> : {};
  return { nachrichten: n, kontakte: k };
}

/** Wirkung für Art. 17 (rein): Nachrichten und Gesprächspartner der Person raus. */
export function waOhnePerson(cur: Obj, m: PersonMerkmale, nenntPerson: Nennt): { neu: Obj; n: number } {
  const { nachrichten, kontakte } = teile(cur);
  const nummern = nummernVon(m);
  // Eine Nummer gehört der Person, wenn sie in der Akte steht — oder der Profilname sie nennt.
  for (const [nr, k] of Object.entries(kontakte)) if (nenntPerson({ name: k.name }, m)) nummern.add(nr);
  let n = 0;
  const restN: Record<string, WaNachricht> = {};
  for (const [id, x] of Object.entries(nachrichten)) { if (nummern.has(x.nummer) || nenntPerson(x, m)) { n++; continue; } restN[id] = x; }
  const restK: Record<string, WaKontakt> = {};
  for (const [nr, k] of Object.entries(kontakte)) { if (nummern.has(nr)) { n++; continue; } restK[nr] = k; }
  return { neu: n ? { ...cur, nachrichten: restN, kontakte: restK } : cur, n };
}

/** Art. 15: wie viele Einträge nennen die Person (rein)? */
export const waZaehlen = (cur: Obj, m: PersonMerkmale, nenntPerson: Nennt): number => waOhnePerson(cur, m, nenntPerson).n;
