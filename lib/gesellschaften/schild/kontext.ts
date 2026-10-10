// ─── Unternehmen › Schild: was über eine Gesellschaft feststeht (rein, client-sicher, 10.10.) ────────────────────────
// Aus dem Gesellschafts-Register (Rechtsform, Rolle, Status, Gründung, Geschäftsjahr, Gesellschafter) und dem Profil des Schilds
// (Beschäftigte, Umsatz, Größenklasse …) — die eine Grundlage, nach der Soll-Dokumente, Pflichten und Schwellen gelten.
// Rechtsformen nach der Recherche: K = GmbH/UG, H = Holding (Rolle im Steckbrief), EG = Einzelunternehmen; Jahresabschluss und
// Offenlegung nach HGB gelten auch für AG und GmbH & Co. KG (§ 264a HGB).

import { anzeigeName, anteile, type RegisterGesellschaft, type Rechtsform, type GesStatus } from '@/lib/gesellschaften/modell';
import type { GesellschaftId } from '@/lib/einheiten';
import type { SchildGesellschaft, SchildProfil } from './typen';

export interface SchildKontext {
  id: GesellschaftId;
  name: string;
  rechtsform?: Rechtsform;
  status?: GesStatus;
  /** GmbH oder UG (Gesellschafterliste, Transparenzregister, GmbHG-Pflichten). */
  kapital: boolean;
  gmbh: boolean;
  ug: boolean;
  /** Kapitalgesellschaft nach HGB (Jahresabschluss, Offenlegung): GmbH, UG, AG, GmbH & Co. KG. */
  hgbKapital: boolean;
  einzel: boolean;
  holding: boolean;
  /** Aktive Gesellschafter (nicht ausgeschieden). */
  gesellschafter: number;
  /** Genau ein Gesellschafter (Einpersonen-Gesellschaft: Niederschrift § 48 Abs. 3, Insichgeschäfte § 35 Abs. 3). */
  einpersonen: boolean;
  beschaeftigte?: number;
  profil: SchildProfil;
  gegruendet?: string;
  gjBeginn?: number;
  /** Laufend, ruhend — in Gründung zählt ab Eintragung/Gründungsdatum; geplant und aufgelöst haben keine laufenden Pflichten. */
  aktiv: boolean;
}

export function kontextVon(g: RegisterGesellschaft, s?: SchildGesellschaft | null): SchildKontext {
  const rf = g.rechtsform;
  const gmbh = rf === 'gmbh', ug = rf === 'ug';
  const n = anteile(g).zeilen.length;
  const profil = s?.profil ?? {};
  const gegruendet = g.eingetragenAm ?? g.gegruendetAm;
  return {
    id: g.id, name: anzeigeName(g), ...(rf ? { rechtsform: rf } : {}), ...(g.status ? { status: g.status } : {}),
    kapital: gmbh || ug, gmbh, ug, hgbKapital: gmbh || ug || rf === 'ag' || rf === 'gmbh-co-kg', einzel: rf === 'einzel',
    holding: g.rolle === 'holding', gesellschafter: n, einpersonen: n === 1,
    ...(typeof profil.beschaeftigte === 'number' ? { beschaeftigte: profil.beschaeftigte } : {}),
    profil, ...(gegruendet ? { gegruendet } : {}), ...(g.geschaeftsjahrBeginn ? { gjBeginn: g.geschaeftsjahrBeginn } : {}),
    aktiv: g.status !== 'geplant' && g.status !== 'aufgeloest',
  };
}
