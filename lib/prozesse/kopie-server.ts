// ─── Prozesse — Kopieren und eigene Vorlagen: die Aktionen der Werkstatt-Route (Server, 22.10.) ───────────────────────────────────────────────────────
// POST /api/prozesse/werkstatt mit `aktion`:
//   kopieren { id }                              → neuer Prozess aus dem Entwurf (neue Kennungen), Version 1 im Probelauf bzw. Entwurf (Bestand `prozesse--<h>`)
//   als-vorlage { id, titel?, beschreibung? }    → eigene Vorlage ohne Personen und Fall-Daten (Bestand `prozess-vorlagen--<h>`)
//   aus-vorlage { vorlageId: ev-…, eigner? }     → neuer Prozess aus einer eigenen Vorlage
//   vorlage-loeschen { vorlageId }               → eigene Vorlage löschen (nur volle Mitglieder)
// Regeln rein in ./kopie.ts; hier nur lesen, die EINE Sperre je Bestand und die Antwort in der Form der Werkstatt (Eintrag mit Stand, Versionen kurz).
// Das Tor (Sitzung, Bau-Kennung, Haushalt, Sicht Business) und `einmalig` macht die Route.

import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import type { ProzessRechte } from './rollen';
import type { ProzessEintrag } from './definition';
import { prozesseAendern, prozesseLesen, pruefKontextFuer, standVon } from './werkstatt-server';
import { eigeneVorlagenAendern, eigeneVorlagenLesen } from './eigene-vorlagen-server';
import { alsEigeneVorlage, ausEigenerVorlage, eigeneVorlageKurz, eigeneVorlageLoeschen, prozessKopieren, type AnlegenErgebnis } from './kopie';
import { entwurfGeaendert, versionKurz } from './versionen';

export interface KopieUmfeld { person: string; rechte: ProzessRechte; haushalt: string; wer: Wer }
type Antwort = { status: number; body: Record<string, unknown> };
const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}): Antwort => ({ status, body: { ok: false, fehler, ...extra } });
const ansicht = (e: ProzessEintrag) => ({ eintrag: { ...e, versionen: e.versionen.map(versionKurz) }, stand: standVon(e), entwurfGeaendert: entwurfGeaendert(e) });

export async function kopieAktion(aktion: string, b: Record<string, unknown>, u: KopieUmfeld): Promise<Antwort> {
  const jetzt = new Date().toISOString();
  const kx = { person: u.person, jetzt, rechte: u.rechte, neueKennung: (p: 'pz' | 'fk' | 'ev') => neueKennung(p) };
  if (aktion === 'kopieren') {
    const pruef = await pruefKontextFuer(u.haushalt, u.person);
    const r = await prozesseAendern<Omit<Extract<AnlegenErgebnis, { ok: true }>, 'ok' | 'datei'>>(dd => prozessKopieren(dd, b.id, { ...kx, pruef }) as never, u.wer, u.haushalt) as AnlegenErgebnis;
    if (!r.ok) return nein(r.status, r.fehler, r.befunde ? { befunde: r.befunde } : {});
    return { status: 200, body: { ok: true, ...ansicht(r.eintrag), befunde: r.befunde, probelauf: r.probelauf, hinweise: r.hinweise } };
  }
  if (aktion === 'als-vorlage') {
    const prozesse = await prozesseLesen(u.haushalt);
    const r = await eigeneVorlagenAendern<{ vorlage: import('./kopie').EigeneVorlage; hinweise: string[] }>(u.haushalt, d => alsEigeneVorlage(d, prozesse, { id: b.id, titel: b.titel, beschreibung: b.beschreibung }, kx), u.wer);
    if (!r.ok) return nein(r.status, r.fehler);
    return { status: 200, body: { ok: true, vorlage: eigeneVorlageKurz(r.vorlage), hinweise: r.hinweise } };
  }
  if (aktion === 'vorlage-loeschen') {
    const r = await eigeneVorlagenAendern<object>(u.haushalt, d => eigeneVorlageLoeschen(d, b.vorlageId, u.rechte), u.wer);
    return r.ok ? { status: 200, body: { ok: true } } : nein(r.status, r.fehler);
  }
  if (aktion === 'aus-vorlage') {
    const pruef = await pruefKontextFuer(u.haushalt, u.person);
    const eigner = typeof b.eigner === 'string' && b.eigner ? b.eigner : undefined;
    if (eigner && pruef.team && !pruef.team.some(t => t.id === eigner && t.aktiv)) return nein(400, 'Eigner: eine aktive Person aus dem Team.');
    const v = (await eigeneVorlagenLesen(u.haushalt)).vorlagen.find(x => x.id === b.vorlageId) ?? null;
    const r = await prozesseAendern<Omit<Extract<AnlegenErgebnis, { ok: true }>, 'ok' | 'datei'>>(dd => ausEigenerVorlage(dd, v, { ...kx, pruef, ...(eigner ? { eigner } : {}) }) as never, u.wer, u.haushalt) as AnlegenErgebnis;
    if (!r.ok) return nein(r.status, r.fehler, r.befunde ? { befunde: r.befunde } : {});
    return { status: 200, body: { ok: true, ...ansicht(r.eintrag), teile: [], befunde: r.befunde, hinweise: r.hinweise, probelauf: r.probelauf } };
  }
  return nein(400, 'Unbekannte Aktion.');
}
