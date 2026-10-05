// ─── Pannen-Register (Art. 33 Abs. 5 DSGVO) — rein, getestet (05.10., Zusatz zum Paket „DSGVO-Grundlagen im Code“) ──
// Jede Datenpanne wird dokumentiert — auch die, die nicht gemeldet werden muss. Prozess und Risiko-Matrix: datenschutz/DATENPANNEN.md.
// Bestand `datenschutz-pannen` (verschlüsselt, nicht im Repo), nur der Inhaber liest und schreibt (Route /api/datenschutz/pannen).
// Bewusst ohne Namen Betroffener: Kategorien und Anzahl genügen (Datenminimierung). Löschfrist „pannen“ ab Abschluss.

export const PANNEN_SPEICHER = 'datenschutz-pannen';
export type PannenArt = 'vertraulichkeit' | 'integritaet' | 'verfuegbarkeit';
export const PANNEN_ARTEN: { id: PannenArt; label: string }[] = [
  { id: 'vertraulichkeit', label: 'Vertraulichkeit (Offenlegung, unbefugter Zugang)' },
  { id: 'integritaet', label: 'Integrität (Veränderung)' },
  { id: 'verfuegbarkeit', label: 'Verfügbarkeit (Verlust, Vernichtung)' },
];
export type PannenRisiko = 'kein' | 'risiko' | 'hoch';
export const PANNEN_RISIKO: { id: PannenRisiko; label: string; pflicht: string }[] = [
  { id: 'kein', label: 'kein Risiko', pflicht: 'nur dokumentieren, Begründung festhalten' },
  { id: 'risiko', label: 'Risiko', pflicht: 'Meldung an die Aufsichtsbehörde binnen 72 Stunden (Art. 33)' },
  { id: 'hoch', label: 'hohes Risiko', pflicht: 'zusätzlich Betroffene unverzüglich benachrichtigen (Art. 34)' },
];

export interface Panne {
  id: string;
  /** Kenntnis (ISO-Zeit) — ab hier laufen die 72 Stunden. */
  kenntnisAm: string;
  beschreibung: string;
  arten: PannenArt[];
  /** Betroffene: Kategorien und (geschätzte) Zahl — keine Namen. */
  betroffene: string;
  anzahl?: number;
  daten: string;
  verschluesselt?: boolean;
  risiko: PannenRisiko;
  begruendung: string;
  /** Meldung an die Behörde: Tag + Aktenzeichen, oder Grund der Nichtmeldung. */
  behoerde: { gemeldet: boolean; am?: string; zeichen?: string; grund?: string };
  /** Betroffene benachrichtigt (Art. 34): Tag + Weg, oder Grund. */
  benachrichtigt: { ja: boolean; am?: string; weg?: string; grund?: string };
  /** Kunde informiert (Kunden-Instanz, MAKE als Auftragsverarbeiter). */
  kundeInformiertAm?: string;
  massnahmen: string;
  abgeschlossenAm?: string;
  angelegt: string;
  von: string;
  geaendert?: string;
}
export interface PannenDatei { pannen: Panne[] }

const zeile = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u0009\u000B-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n + 1);
const text = (v: unknown, n: number) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F]/g, ' ').trim().slice(0, n + 1);
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const zeit = (v: unknown): string | null => { const t = String(v ?? ''); return t && Number.isFinite(Date.parse(t)) ? new Date(t).toISOString() : null; };

/** Eingabe prüfen und säubern; `jetzt`/`von` setzt der Server. */
export function panneSaeubern(roh: unknown, o: { id: string; jetzt: string; von: string; alt?: Panne }): { ok: true; p: Panne } | { ok: false; fehler: string } {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, fehler: 'Panne: Objekt erwartet.' };
  const r = roh as Record<string, unknown>;
  const kenntnisAm = zeit(r.kenntnisAm);
  if (!kenntnisAm) return { ok: false, fehler: 'Wann wurde die Panne bekannt? (Datum und Uhrzeit)' };
  const beschreibung = text(r.beschreibung, 2000);
  if (beschreibung.length < 5) return { ok: false, fehler: 'Beschreibung fehlt (was ist passiert, Ursache).' };
  const arten = Array.isArray(r.arten) ? PANNEN_ARTEN.map(a => a.id).filter(a => (r.arten as unknown[]).includes(a)) : [];
  if (!arten.length) return { ok: false, fehler: 'Art wählen (Vertraulichkeit, Integrität, Verfügbarkeit).' };
  const risiko = PANNEN_RISIKO.find(x => x.id === r.risiko)?.id;
  if (!risiko) return { ok: false, fehler: 'Risiko wählen (kein, Risiko, hoch).' };
  const begruendung = text(r.begruendung, 2000), betroffene = zeile(r.betroffene, 300), daten = zeile(r.daten, 300), massnahmen = text(r.massnahmen, 2000);
  if (beschreibung.length > 2000 || begruendung.length > 2000 || massnahmen.length > 2000 || betroffene.length > 300 || daten.length > 300) return { ok: false, fehler: 'Ein Text ist zu lang.' };
  const anzahl = r.anzahl === '' || r.anzahl == null ? undefined : Math.max(0, Math.round(Number(r.anzahl)));
  if (anzahl !== undefined && !Number.isFinite(anzahl)) return { ok: false, fehler: 'Anzahl als Zahl.' };
  const b = (r.behoerde && typeof r.behoerde === 'object' ? r.behoerde : {}) as Record<string, unknown>;
  const n = (r.benachrichtigt && typeof r.benachrichtigt === 'object' ? r.benachrichtigt : {}) as Record<string, unknown>;
  const tag = (v: unknown) => { const t = zeile(v, 10); return TAG.test(t) ? t : undefined; };
  const behoerde = { gemeldet: b.gemeldet === true, ...(tag(b.am) ? { am: tag(b.am) } : {}), ...(zeile(b.zeichen, 80) ? { zeichen: zeile(b.zeichen, 80) } : {}), ...(zeile(b.grund, 500) ? { grund: zeile(b.grund, 500) } : {}) };
  const benachrichtigt = { ja: n.ja === true, ...(tag(n.am) ? { am: tag(n.am) } : {}), ...(zeile(n.weg, 200) ? { weg: zeile(n.weg, 200) } : {}), ...(zeile(n.grund, 500) ? { grund: zeile(n.grund, 500) } : {}) };
  if (behoerde.gemeldet && !behoerde.am) return { ok: false, fehler: 'Gemeldet: Tag der Meldung fehlt.' };
  if (benachrichtigt.ja && !benachrichtigt.am) return { ok: false, fehler: 'Benachrichtigt: Tag fehlt.' };
  const abgeschlossenAm = tag(r.abgeschlossenAm), kundeInformiertAm = tag(r.kundeInformiertAm);
  return { ok: true, p: {
    id: o.id, kenntnisAm, beschreibung, arten, betroffene, ...(anzahl !== undefined ? { anzahl } : {}), daten, ...(r.verschluesselt === true ? { verschluesselt: true } : {}),
    risiko, begruendung, behoerde, benachrichtigt, ...(kundeInformiertAm ? { kundeInformiertAm } : {}), massnahmen, ...(abgeschlossenAm ? { abgeschlossenAm } : {}),
    angelegt: o.alt?.angelegt ?? o.jetzt, von: o.alt?.von ?? o.von, ...(o.alt ? { geaendert: o.jetzt } : {}),
  } };
}

/** Was ist noch zu tun? (72-Stunden-Frist der Meldung, Benachrichtigung bei hohem Risiko, Abschluss) — für Anzeige und Selbstprüfung. */
export function panneOffen(p: Panne, jetzt: string): { text: string; dringend: boolean }[] {
  const raus: { text: string; dringend: boolean }[] = [];
  const frist = Date.parse(p.kenntnisAm) + 72 * 3_600_000;
  if (p.risiko !== 'kein' && !p.behoerde.gemeldet && !p.behoerde.grund) raus.push({ text: Date.parse(jetzt) > frist ? 'Meldung an die Behörde überfällig (72 Stunden vorbei) — nachholen und Verzögerung begründen' : `Meldung an die Behörde bis ${new Date(frist).toISOString().slice(0, 16).replace('T', ' ')} UTC`, dringend: true });
  if (p.risiko === 'kein' && !p.begruendung) raus.push({ text: 'Begründung für „kein Risiko“ festhalten', dringend: false });
  if (p.risiko === 'hoch' && !p.benachrichtigt.ja && !p.benachrichtigt.grund) raus.push({ text: 'Betroffene benachrichtigen (Art. 34) oder Grund festhalten', dringend: true });
  if (!p.abgeschlossenAm) raus.push({ text: 'Abschluss eintragen, wenn alle Maßnahmen umgesetzt sind', dringend: false });
  return raus;
}

/** Löschfrist: abgeschlossene Pannen, deren Abschluss vor `grenze` (JJJJ-MM-TT) liegt, fallen weg; offene bleiben. */
export function pannenUeberFrist(d: PannenDatei | null | undefined, grenze: string): { datei: PannenDatei; n: number } {
  const alle = d?.pannen ?? [];
  const bleibt = alle.filter(p => !p.abgeschlossenAm || p.abgeschlossenAm >= grenze);
  return { datei: { pannen: bleibt }, n: alle.length - bleibt.length };
}
