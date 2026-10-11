// ─── Unternehmen › „Bereit für Kanzlei und Steuerbüro“ (rein, client-sicher, 11.10.) ───────────────────────────────────────────────
// Kevin 11.10.: „denk immer 2–3 Schritte weiter.“ Je Gesellschaft EIN Status: was für den Jahresabschluss und die Steuer des letzten Geschäftsjahres
// schon vorliegt (Unterlagen, Beschlüsse, Profil) und was fehlt — als Haken-Liste mit Weg. Aus den offenen Punkten werden die Fragen der Anwalts-Mappe
// (lib/recht/mappe.ts über POST /api/gesellschaften/recht — vorhandener Weg, nichts doppelt). Gerechnet aus der Lage (./ampel.ts) und dem Register
// (Beschluss-Buch) — nichts gespeichert. Hinweis, keine Steuer- oder Rechtsberatung.

import { aktiveEintraege, type RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import { WEG } from '@/lib/wege';
import type { GesellschaftLage } from './ampel';
import { dokTon } from './blick';
import { geschaeftsjahresEnden, gjLabel, tagePlus } from './zeit';

export type KanzleiStatus = 'bereit' | 'fast' | 'offen';
export const KANZLEI_TEXT: Record<KanzleiStatus, string> = { bereit: 'bereit', fast: 'fast bereit', offen: 'es fehlt noch einiges' };
export interface KanzleiPunkt { id: string; text: string; da: boolean; weg: string; hinweis?: string }
export interface KanzleiBereit {
  /** Stichtag des letzten abgeschlossenen Geschäftsjahres. */
  stichtag?: string;
  gj?: string;
  punkte: KanzleiPunkt[];
  da: number;
  gesamt: number;
  status: KanzleiStatus;
  /** Offene Punkte als Fragen für die Anwalts-Mappe. */
  fragen: string[];
}

/** Ist ein Dokument der Soll-Liste in Ordnung (vorhanden, nicht nötig, noch nicht fällig)? Fehlt es auf der Liste, gilt es als nicht da. */
const dokDa = (g: GesellschaftLage, art: string) => { const d = g.dokumente.find(x => x.katalog.art === art); return !!d && !dokTon(d); };

export function kanzleiBereit(g: GesellschaftLage, reg: RegisterGesellschaft | undefined, heute: string): KanzleiBereit {
  const k = g.kontext;
  const enden = geschaeftsjahresEnden(k.gjBeginn, tagePlus(heute, -800), heute, k.gegruendet).filter(e => e < heute);
  const stichtag = enden[enden.length - 1];
  const dok = WEG.schild('dokumente', g.id), pfl = WEG.schild('pflichten', g.id);
  const punkte: KanzleiPunkt[] = [];
  const p = (id: string, text: string, da: boolean, weg: string, hinweis?: string) => punkte.push({ id, text, da, weg, ...(hinweis ? { hinweis } : {}) });

  if (k.hgbKapital) {
    p('groesse', 'Größenklasse im Profil', !!k.profil.groessenklasse, pfl, 'Bestimmt Fristen und Erleichterungen (§§ 267, 267a HGB).');
    p('zahlen', 'Umsatz und Bilanzsumme des Vorjahres im Profil', typeof k.profil.umsatzVorjahrCent === 'number' && typeof k.profil.bilanzsummeCent === 'number', pfl);
  }
  if (k.einzel) p('euer', `Einnahmenüberschussrechnung${stichtag ? ` ${gjLabel(stichtag)}` : ''}`, dokDa(g, 'euer'), dok);
  if (k.hgbKapital && stichtag) {
    const jahr = Number(stichtag.slice(0, 4));
    const aufgestellt = g.pflichten.some(x => x.regelId === 'ja-aufstellen' && x.periode === stichtag && x.status === 'erledigt')
      || g.dokumente.some(d => d.katalog.art === 'jahresabschluss' && d.alle.some(x => x.status === 'vorhanden' && (x.geschaeftsjahr ?? Number((x.fassungVom ?? '').slice(0, 4))) >= jahr));
    p('abschluss', `Jahresabschluss ${gjLabel(stichtag)} aufgestellt`, aufgestellt, pfl, 'Vermerk „erledigt“ in den Pflichten oder der Abschluss unter Dokumente.');
    if (k.kapital) {
      const beschlossen = g.pflichten.some(x => x.regelId === 'ja-feststellen' && x.periode === stichtag && x.status === 'erledigt')
        || aktiveEintraege(reg?.beschluesse).some(b => (b.art === 'jahresabschluss' || b.art === 'gewinnverwendung') && b.status !== 'entwurf' && b.status !== 'aufgehoben' && b.datum > stichtag);
      p('feststellung', `Feststellung und Gewinnverwendung ${gjLabel(stichtag)} beschlossen`, beschlossen, WEG.beschluss(g.id), 'Im Beschluss-Buch (Vorlage „Feststellung Jahresabschluss“) oder als Vermerk in den Pflichten.');
    }
  }
  p('stammdaten', 'Steuer-Stammdaten (Steuernummer, USt-IdNr.)', dokDa(g, 'steuer-stammdaten'), dok);
  p('elster', 'ELSTER-Zertifikat gültig', dokDa(g, 'elster-zertifikat'), dok);
  p('verfahrensdoku', 'Verfahrensdokumentation (GoBD)', dokDa(g, 'verfahrensdoku'), dok);
  if (k.kapital) {
    p('liste', 'Gesellschafterliste aktuell', dokDa(g, 'gesellschafterliste'), dok);
    p('liquiditaet', 'Liquiditätsplanung fortgeschrieben', dokDa(g, 'krisenfrueherkennung'), dok, 'Krisenfrüherkennung nach § 1 StaRUG — die Finanzplanung kann der Nachweis sein.');
  }
  const da = punkte.filter(x => x.da).length;
  const fehlt = punkte.length - da;
  return {
    ...(stichtag ? { stichtag, gj: gjLabel(stichtag) } : {}), punkte, da, gesamt: punkte.length,
    status: !fehlt ? 'bereit' : fehlt <= 2 ? 'fast' : 'offen',
    fragen: punkte.filter(x => !x.da).map(x => `Noch offen: ${x.text} — was braucht ihr dazu von uns?`),
  };
}
