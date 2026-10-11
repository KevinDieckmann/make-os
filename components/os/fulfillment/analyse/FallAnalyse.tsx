'use client';

// ─── Fulfillment · Fall › Analyse (C3, 10.10.; FULFILLMENT_KONZEPT.md 4, Abschnitt 10) ────────────────────────────────────────────────────────
// Das Dossier eines Mandats: anlegen (Vorschlag aus der Firmenakte), Läufe je Welle mit Schätzung (jeder einzeln bestätigt — kein „alle starten“),
// Entwürfe abschnittsweise übernehmen, Abschnitte mit Quellen, Personenteil (nur mit Zugang), Recht & Freigaben (Interessenabwägung, F1, Prüfung,
// F2), Tiefenbericht (nur für dich). Die KI-Lage steht ehrlich oben — aus ist aus, nichts wird heimlich eingeschaltet.

import { useState } from 'react';
import Link from 'next/link';
import { FileSearch } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Hinweis, Knopf, Leerzustand, Leer, Segmente, Karte, Ueberschrift, Feldzeile, eingabe, useRueckfrage } from '../../ui';
import { useAnalyse, senden, fehlerVon } from './daten';
import { Laeufe } from './Laeufe';
import { DossierAnsicht } from './DossierAnsicht';
import { Recht } from './Recht';
import { Personen } from './Personen';
import { Tiefenbericht } from './Tiefenbericht';

type Teil = 'laeufe' | 'dossier' | 'personen' | 'recht' | 'tiefenbericht';

export function FallAnalyse({ mandatId }: { mandatId: string }) {
  const api = useAnalyse(mandatId);
  const rueck = useRueckfrage();
  const [teil, setTeil] = useState<Teil>('laeufe');
  const d = api.dossier;
  if (!d) return api.fehler ? <Hinweis art="kritisch">{api.fehler}</Hinweis> : <Leer>Analyse wird geladen …</Leer>;
  if (!d.dossier) return <DossierAnlegen mandatId={mandatId} vorschlag={d.vorschlag} neuLaden={api.laden} />;
  const lage = api.lage;
  const teile: { id: Teil; label: string }[] = [
    { id: 'laeufe', label: 'Läufe' }, { id: 'dossier', label: 'Dossier' },
    ...(d.personenteil ? [{ id: 'personen' as const, label: 'Personen' }] : []),
    { id: 'recht', label: 'Recht & Freigaben' }, { id: 'tiefenbericht', label: 'Tiefenbericht' },
  ];
  const ki = lage?.ki;
  const kiLuecken = ki ? (['kiZugang', 'bereichCrm', 'websuche'] as const).filter(k => !ki[k]) : [];
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {api.fehler && <Hinweis art="kritisch">{api.fehler}</Hinweis>}
      {kiLuecken.length > 0 && (
        <Hinweis art="achtung" titel="KI-Einstellungen" aktion={<Knopf leise href={WEG.datenschutz('ki')}>Zu den KI-Schaltern</Knopf>}>
          {kiLuecken.map(k => lage!.kiSaetze[k]).join(' ')}
        </Hinweis>
      )}
      <Segmente liste={teile} aktiv={teile.some(t => t.id === teil) ? teil : 'laeufe'} onWahl={setTeil} umbrechen />
      {teil === 'laeufe' && <Laeufe mandatId={mandatId} api={api} rueck={rueck} />}
      {teil === 'dossier' && <DossierAnsicht mandatId={mandatId} api={api} rueck={rueck} />}
      {teil === 'personen' && d.personenteil && <Personen mandatId={mandatId} firmaId={d.mandat.firmaId} rueck={rueck} />}
      {teil === 'recht' && <Recht mandatId={mandatId} api={api} rueck={rueck} />}
      {teil === 'tiefenbericht' && <Tiefenbericht mandatId={mandatId} api={api} rueck={rueck} />}
      {!d.personenteil && (
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Den Personenteil sehen nur der Inhaber und Mitglieder mit vollem Zugang. Hier: {d.deckblatt?.kartenAnzahl ?? 0} Karte(n).</div>
      )}
      {rueck.dialog}
    </div>
  );
}

function DossierAnlegen({ mandatId, vorschlag, neuLaden }: { mandatId: string; vorschlag?: { firma: string; domains: string[]; branche?: string; sitz?: string; registerNr?: string }; neuLaden: () => Promise<void> }) {
  const [firma, setFirma] = useState(vorschlag?.firma ?? '');
  const [domains, setDomains] = useState((vorschlag?.domains ?? []).join(', '));
  const [branche, setBranche] = useState(vorschlag?.branche ?? '');
  const [sitz, setSitz] = useState(vorschlag?.sitz ?? '');
  const [registerNr, setRegisterNr] = useState(vorschlag?.registerNr ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const anlegen = async () => {
    const r = await senden('/api/fulfillment/dossier', {
      aktion: 'anlegen', mandatId,
      eingaben: { firma, domains: domains.split(/[\s,;]+/).filter(Boolean), urls: [], ...(branche ? { branche } : {}), ...(sitz ? { sitz } : {}), ...(registerNr ? { registerNr } : {}) },
    });
    const f = fehlerVon(r);
    setFehler(f);
    if (!f) await neuLaden();
  };
  return (
    <Karte>
      <Leerzustand symbol={<FileSearch size={26} />} titel="Noch kein Dossier">
        Das Dossier sammelt die Analyse dieses Mandats — Aussage für Aussage mit Quelle und Datum. Vorbelegt aus der Firmenakte; es läuft noch nichts.
      </Leerzustand>
      <form onSubmit={e => { e.preventDefault(); void anlegen(); }} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <Ueberschrift>Eingaben</Ueberschrift>
        <Feldzeile label="Firma"><input style={eingabe} value={firma} onChange={e => setFirma(e.target.value)} maxLength={120} required /></Feldzeile>
        <Feldzeile label="Domain(s) — durch Komma getrennt"><input style={eingabe} value={domains} onChange={e => setDomains(e.target.value)} placeholder="beispiel.de" /></Feldzeile>
        <Feldzeile label="Branche"><input style={eingabe} value={branche} onChange={e => setBranche(e.target.value)} maxLength={120} /></Feldzeile>
        <Feldzeile label="Sitz"><input style={eingabe} value={sitz} onChange={e => setSitz(e.target.value)} maxLength={120} /></Feldzeile>
        <Feldzeile label="Registernummer (optional)"><input style={eingabe} value={registerNr} onChange={e => setRegisterNr(e.target.value)} maxLength={120} /></Feldzeile>
        {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
        <div><Knopf haupt typ="submit">Dossier anlegen</Knopf></div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Danach startet nichts von selbst. Der Start-Prüfer (ohne Kosten) legt das Gerüst an. <Link href={WEG.fall(mandatId)} style={{ color: C.aktiv }}>Zurück zum Überblick</Link></div>
      </form>
    </Karte>
  );
}
