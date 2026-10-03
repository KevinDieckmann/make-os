'use client';

// ─── Events · An Kunden übergeben — Vorschau und Übergabe (03.10., Paket „netz-recht“) ───
// Die Kontakte eines Kunden-Events gehören auch uns (eigener Verantwortlicher, berechtigtes Interesse); die Weitergabe an den Kunden ist
// eine Übermittlung an einen Dritten. Deshalb eine Vorschau vor dem Export: an diesem Event NEU angelegte Personen gehen mit, Bestandspersonen
// (vorher bekannt, angehängt) nur mit ausdrücklichem Haken je Person; wer den Datenschutzhinweis noch nicht bekam, ist markiert („noch nicht
// informiert“) — die Übergabe bleibt möglich, aber bewusst. Gesperrte Personen (Art. 18, Werbesperre) gehen nie mit. Der Haken „Rolle und
// Vertrag mit dem Kunden geklärt“ steht im Protokoll (`avvBzwHinweisBestaetigt`). Regeln: lib/crm/besuche.ts, Server: /api/crm/events.

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Chip, Haken, Zeile, Leer, LEUCHT, Hinweis } from '../../ui';
import { UEBERGABE_HINWEIS, ROLLE_HINWEIS, DATEI_LOESCHEN_HINWEIS } from '@/lib/crm/netzwerken-recht';
import type { UebergabeZeile } from '@/lib/crm/besuche';
import type { Event } from '@/lib/crm/typen';
import type { CrmApi } from '../daten';
import { Fenster } from '../../Fenster';
import { eventsPost } from '../events/gemeinsam';
import { AvvHinweis } from './gemeinsam';

interface Vorschau { kunde: { id: string; name: string }; zeilen: UebergabeZeile[]; fehlend: number }

export function UebergabeDialog({ e, api, onZu }: { e: Event; api: CrmApi; onZu: () => void }) {
  const [v, setV] = useState<Vorschau | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [haken, setHaken] = useState<Set<string>>(new Set());
  const [bestaetigt, setBestaetigt] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState<{ anzahl: number; gesperrt: number; bestand: number } | null>(null);

  useEffect(() => {
    let weg = false;
    void eventsPost(e.id, { aktion: 'kunden-vorschau' }).then(r => {
      if (weg) return;
      if (r.ok && Array.isArray(r.zeilen)) setV({ kunde: r.kunde as Vorschau['kunde'], zeilen: r.zeilen as UebergabeZeile[], fehlend: Number(r.fehlend ?? 0) });
      else setFehler(typeof r.fehler === 'string' ? r.fehler : 'Die Vorschau ließ sich nicht laden.');
    });
    return () => { weg = true; };
  }, [e.id]);

  const neue = useMemo(() => (v?.zeilen ?? []).filter(z => z.neu && !z.gesperrt), [v]);
  const bestand = useMemo(() => (v?.zeilen ?? []).filter(z => !z.neu && !z.gesperrt), [v]);
  const gesperrt = (v?.zeilen ?? []).filter(z => z.gesperrt).length;
  const mit = neue.length + bestand.filter(z => haken.has(z.kontaktId)).length;
  const ohneInfo = [...neue, ...bestand.filter(z => haken.has(z.kontaktId))].filter(z => !z.informiert).length;
  const umschalten = (id: string) => setHaken(h => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const uebergeben = async () => {
    if (laeuft || !v || !mit || !bestaetigt) return;
    setLaeuft(true); setFehler(null);
    const r = await eventsPost(e.id, { aktion: 'kunden-uebergabe', hinweisBestaetigt: true, bestandIds: bestand.filter(z => haken.has(z.kontaktId)).map(z => z.kontaktId) });
    setLaeuft(false);
    if (!r.ok || typeof r.csv !== 'string') { setFehler(typeof r.fehler === 'string' ? r.fehler : 'Nicht übergeben.'); return; }
    const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
    const l = document.createElement('a');
    l.href = url; l.download = String(r.dateiname ?? 'kontakte.csv');
    document.body.appendChild(l); l.click(); l.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const aus = (r.ausgelassen ?? {}) as { gesperrt?: number; bestand?: number };
    setFertig({ anzahl: Number(r.anzahl ?? 0), gesperrt: aus.gesperrt ?? 0, bestand: aus.bestand ?? 0 });
    api.setHinweis(`${r.anzahl} ${r.anzahl === 1 ? 'Kontakt' : 'Kontakte'} exportiert. Die Übergabe steht mit Empfänger im Protokoll.`);
    await api.laden();
  };

  const zeile = (z: UebergabeZeile, haeklich: boolean) => (
    <Zeile key={z.kontaktId}
      links={haeklich ? <Haken an={haken.has(z.kontaktId)} label={`${z.name} mitgeben`} onChange={() => umschalten(z.kontaktId)} /> : undefined}
      titel={z.name}
      unter={[z.firma, z.herkunft].filter(Boolean).join(' · ')}
      umbrechen
      rechts={!z.informiert ? <Chip farbe={LEUCHT.achtung} umbrechen>noch nicht informiert</Chip> : undefined} />
  );

  return (
    <Fenster titel={`An ${v?.kunde.name ?? 'den Kunden'} übergeben`} onZu={onZu} breit={720}>
      <div className="bes-dialog" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12, minWidth: 0, overflowWrap: 'anywhere' }}>
        {!v && !fehler && <Leer>Die Vorschau wird geladen …</Leer>}
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        {v && !fertig && (
          <>
            <AvvHinweis text={UEBERGABE_HINWEIS} />
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>{ROLLE_HINWEIS}</div>
            <div>
              <Ueberschrift>Gehen mit — an diesem Event neu angelegt ({neue.length})</Ueberschrift>
              {!neue.length ? <Leer>Niemand wurde an diesem Event neu angelegt.</Leer> : neue.map(z => zeile(z, false))}
            </div>
            <div>
              <Ueberschrift>Schon bekannt — nur mit Haken ({bestand.length})</Ueberschrift>
              {!bestand.length ? <Leer>Keine Bestandspersonen.</Leer> : (
                <>
                  <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 4 }}>Diese Personen kannten wir vorher. Mitgegeben werden sie nur, wenn du sie ausdrücklich ankreuzt.</div>
                  {bestand.map(z => zeile(z, true))}
                </>
              )}
            </div>
            {(gesperrt > 0 || v.fehlend > 0) && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{gesperrt > 0 ? `${gesperrt} gesperrte Person${gesperrt === 1 ? '' : 'en'} (Art. 18 / Werbesperre) bleiben bewusst draußen.` : ''}{gesperrt > 0 && v.fehlend > 0 ? ' ' : ''}{v.fehlend > 0 ? `${v.fehlend} Teilnahme${v.fehlend === 1 ? '' : 'n'} ohne Person in der Kartei.` : ''}</div>}
            {ohneInfo > 0 && <div role="note" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, lineHeight: 1.5 }}>{ohneInfo} {ohneInfo === 1 ? 'Person ist' : 'Personen sind'} noch nicht über die Weitergabe informiert (Danke-Mail mit Datenschutzhinweis, Art. 13). Die Übergabe geht trotzdem — aber bewusst.</div>}
            <label className="bes-haken-zeile" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: TYP.bedien, color: C.ink, lineHeight: 1.45, cursor: 'pointer', minWidth: 0 }}>
              <input type="checkbox" checked={bestaetigt} onChange={x => setBestaetigt(x.target.checked)} style={{ width: 22, height: 22, marginTop: 1, flex: '0 0 auto' }} />
              <span style={{ minWidth: 0 }}>Rolle und Vertrag mit {v.kunde.name} sind geklärt (steht im Protokoll).</span>
            </label>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Exportiert werden nur Felder (Name, Firma, Position, E-Mail, Telefon, LinkedIn, Webseite) mit Herkunft je Zeile — keine Fotos, keine Sprachnotizen, keine Gesprächsnotizen.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', minWidth: 0 }}>
              <Knopf leise onClick={onZu}>Abbrechen</Knopf>
              <Knopf onClick={uebergeben} aus={laeuft || !mit || !bestaetigt} farbe={LEUCHT.business}>{laeuft ? 'bereitet vor …' : `${mit} ${mit === 1 ? 'Kontakt' : 'Kontakte'} übergeben (CSV)`}</Knopf>
            </div>
          </>
        )}
        {fertig && (
          <>
            <div role="status" style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>✓ {fertig.anzahl} {fertig.anzahl === 1 ? 'Kontakt' : 'Kontakte'} exportiert{fertig.gesperrt ? ` · ${fertig.gesperrt} gesperrte Person${fertig.gesperrt === 1 ? '' : 'en'} bewusst nicht dabei` : ''}{fertig.bestand ? ` · ${fertig.bestand} Bestandsperson${fertig.bestand === 1 ? '' : 'en'} ohne Haken nicht dabei` : ''}. Die Übergabe steht mit Empfänger im Protokoll.</div>
            <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, fontWeight: 600 }}>{DATEI_LOESCHEN_HINWEIS}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Knopf onClick={onZu}>Schließen</Knopf></div>
          </>
        )}
      </div>
    </Fenster>
  );
}
