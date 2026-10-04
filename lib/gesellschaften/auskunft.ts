// ─── MAKE OS — Gesellschafts-Register: Art. 15 für einen CRM-Kontakt (rein, DSGVO-Prüfung 04.10.) ─────────────────
// Ein Kontakt kann im Register stehen als Gesellschafter (Nennbetrag, Einlage, Stimmrecht, Klauseln), als Organ
// (Geschäftsführung, Beirat …) und als Vertragspartei. Vorher zählte die Auskunft nur „n Treffer in gesellschaften--…“ —
// jetzt steht dort die KOPIE dieser Angaben (Art. 15 Abs. 3), auch für Papierkorb- und Archiv-Einträge (mit Marke).
// Nicht in der Kopie: interne Notizen/Beschlussinhalte (Wortlaut über Dritte) — sie zählt `weitereSpeicher` weiter mit.

import { anzeigeName, organLabel, vertragArtLabel, vertragStatusLabel, euroText, type RegisterDatei, type Bezug } from './modell';

export interface RegisterAuskunft {
  gesellschaft: string;
  rolle: 'Gesellschafter' | 'Organ' | 'Vertragspartei';
  angaben: string;
  seit?: string;
  bis?: string;
  /** Eintrag liegt im Papierkorb (fällt nach 30 Tagen weg) bzw. ist archiviert (ausgeschieden/beendet). */
  papierkorb?: true;
  archiv?: true;
}

const istKontakt = (b: Bezug | undefined, id: string) => !!b && b.art === 'kontakt' && b.id === id;

/** Alle Register-Angaben zu diesem Kontakt — über alle Gesellschaften, auch Papierkorb/Archiv (markiert). */
export function registerAuskunft(d: RegisterDatei | null | undefined, kontaktId: string): RegisterAuskunft[] {
  const raus: RegisterAuskunft[] = [];
  for (const g of Array.isArray(d?.gesellschaften) ? d!.gesellschaften : []) {
    const name = anzeigeName(g);
    const imKorb = (x: { geloeschtAm?: string }) => !!(x.geloeschtAm || g.geloeschtAm);
    for (const s of g.gesellschafter ?? []) {
      if (!istKontakt(s.wer, kontaktId)) continue;
      const teile = [`Nennbetrag ${euroText(s.nennbetragCent ?? 0)}`, `Einlage ${s.einlage === 'ja' ? 'voll eingezahlt' : s.einlage === 'teil' ? `teilweise (${euroText(s.eingezahltCent ?? 0)})` : 'offen'}`,
        s.ohneStimmrecht ? 'ohne Stimmrecht' : 'mit Stimmrecht', ...(s.klauseln ? [`Klauseln: ${s.klauseln}`] : [])];
      raus.push({ gesellschaft: name, rolle: 'Gesellschafter', angaben: teile.join(' · '), ...(s.eingetretenAm ? { seit: s.eingetretenAm } : {}),
        ...(s.ausgeschiedenAm ? { bis: s.ausgeschiedenAm, archiv: true as const } : {}), ...(imKorb(s) ? { papierkorb: true as const } : {}) });
    }
    for (const o of g.organe ?? []) {
      if (!istKontakt(o.wer, kontaktId)) continue;
      raus.push({ gesellschaft: name, rolle: 'Organ', angaben: organLabel(o.funktion), ...(o.seit ? { seit: o.seit } : {}),
        ...(o.bis ? { bis: o.bis, archiv: true as const } : {}), ...(imKorb(o) ? { papierkorb: true as const } : {}) });
    }
    for (const v of g.vertraege ?? []) {
      if (!(v.parteien ?? []).some(p => istKontakt(p, kontaktId))) continue;
      raus.push({ gesellschaft: name, rolle: 'Vertragspartei', angaben: `${vertragArtLabel(v.art)}${v.titel ? ` „${v.titel}“` : ''} · ${vertragStatusLabel(v.status)}`,
        ...(v.beginn ? { seit: v.beginn } : {}), ...(v.ende ? { bis: v.ende } : {}), ...(v.status === 'beendet' ? { archiv: true as const } : {}), ...(imKorb(v) ? { papierkorb: true as const } : {}) });
    }
  }
  return raus;
}
