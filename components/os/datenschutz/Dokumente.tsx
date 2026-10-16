'use client';

// ─── System › Datenschutz · Dokumente (05.10.) ──────────────────────────────
// Die Datenschutz-Dokumente liegen im Repository unter datenschutz/ (Entwürfe, anwaltlich zu prüfen; keine Daten). Die App kann sie
// nicht ausliefern (sie gehören nicht in public/) — hier stehen Ort und Zweck, damit niemand sucht.
// 15.10. (Abnahme 2 A2, Kevin: „Betreiber-Inhalte nur in der eigenen Instanz“): Dateinamen und „Repository“ nur in der Betreiber-Instanz
// (`useBetreiber`, der Server entscheidet) — eine Kunden-Instanz liest, welche Unterlagen es gibt und dass der Betreiber sie gibt.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile } from '../ui';
import { BETREIBER_UNTERLAGEN } from '@/lib/betrieb/betreiber';
import { useBetreiber } from '../useInhaber';

const DOKUMENTE: { datei: string; was: string }[] = [
  { datei: 'datenschutz/README.md', was: 'Überblick, Kernaussagen, offene Punkte' },
  { datei: 'datenschutz/TOM.md', was: 'Technische und organisatorische Maßnahmen (Art. 32), Lücken-Liste' },
  { datei: 'datenschutz/LOESCHKONZEPT.md', was: 'Datenart → Frist → Auslöser → Nachweis, Sicherungen und Grabsteine' },
  { datei: 'datenschutz/DATENPANNEN.md', was: 'Prozess Art. 33/34, Risiko-Matrix, 72-Stunden-Ablauf, Vorlagen' },
  { datei: 'datenschutz/DSFA.md', was: 'Schwellwertanalyse und Datenschutz-Folgenabschätzungen' },
  { datei: 'datenschutz/AVV_VORLAGE.md', was: 'AVV-Vorlage für Kunden-Instanzen (MAKE als Auftragsverarbeiter)' },
  { datei: 'datenschutz/KUNDEN_ONBOARDING_DATENSCHUTZ.md', was: 'Checkliste je Kunden-Instanz' },
  { datei: 'datenschutz/KI_VO.md', was: 'Einordnung nach der KI-Verordnung' },
  { datei: 'DATENSCHUTZ_APP.md', was: 'Datenschutz in der Anwendung, Entwurf des Hinweises' },
];
/** Was eine Kunden-Instanz sieht: die Unterlagen ohne Dateinamen (der Vertrag statt der Vorlage, ohne „Kunden-Instanzen“). */
const NEUTRAL: { titel: string; was: string }[] = [
  { titel: 'Technische und organisatorische Maßnahmen', was: 'Was die Instanz schützt (Art. 32 DSGVO)' },
  { titel: 'Löschkonzept', was: 'Welche Daten wann gelöscht werden — auch in Sicherungen' },
  { titel: 'Ablauf bei Datenpannen', was: 'Wer was binnen 72 Stunden tut (Art. 33/34 DSGVO)' },
  { titel: 'Datenschutz-Folgenabschätzung', was: 'Wo ein hohes Risiko geprüft wurde' },
  { titel: 'Vertrag zur Auftragsverarbeitung', was: 'Euer Vertrag mit dem Betreiber eurer Instanz' },
  { titel: 'Einordnung nach der KI-Verordnung', was: 'Wie die KI-Funktionen eingeordnet sind' },
];

export function DokumenteKarte({ i = 5 }: { i?: number }) {
  const betreiber = useBetreiber() === true;
  return (
    <Karte i={i} id="dokumente">
      <Ueberschrift erklaerung="datenschutz.dokumente">Dokumente</Ueberschrift>
      {betreiber ? <>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8 }}>Im Repository (Entwürfe — anwaltlich prüfen). Sie beschreiben, was diese Seite und der Code umsetzen.</div>
        <Liste>{DOKUMENTE.map(d => <Zeile key={d.datei} titel={<code style={{ fontSize: TYP.bedien }}>{d.datei}</code>} unter={d.was} umbrechen />)}</Liste>
      </> : <>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8 }}>{BETREIBER_UNTERLAGEN} Sie beschreiben, was diese Seite umsetzt.</div>
        <Liste>{NEUTRAL.map(d => <Zeile key={d.titel} titel={d.titel} unter={d.was} umbrechen />)}</Liste>
      </>}
    </Karte>
  );
}
