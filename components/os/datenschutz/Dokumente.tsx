'use client';

// ─── System › Datenschutz · Dokumente (05.10.) ──────────────────────────────
// Die Datenschutz-Dokumente liegen im Repository unter datenschutz/ (Entwürfe, anwaltlich zu prüfen; keine Daten). Die App kann sie
// nicht ausliefern (sie gehören nicht in public/) — hier stehen Ort und Zweck, damit niemand sucht.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile } from '../ui';

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

export function DokumenteKarte({ i = 5 }: { i?: number }) {
  return (
    <Karte i={i} id="dokumente">
      <Ueberschrift>Dokumente</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8 }}>Im Repository (Entwürfe — anwaltlich prüfen). Sie beschreiben, was diese Seite und der Code umsetzen.</div>
      <Liste>{DOKUMENTE.map(d => <Zeile key={d.datei} titel={<code style={{ fontSize: TYP.bedien }}>{d.datei}</code>} unter={d.was} umbrechen />)}</Liste>
    </Karte>
  );
}
