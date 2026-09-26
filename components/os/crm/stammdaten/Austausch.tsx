'use client';

// ─── Stammdaten › Import & Export ───────────────────────────────────────────
// Masterdatei abgleichen (CSV hochladen oder vom Mac-Schreibtisch) und fünf
// Exporte als CSV: Kontakte · Firmen · Deals · Follow-ups · Mandate
// (app/api/crm/export?was=…, Aufbau in lib/crm/export.ts). Privatnotizen
// verlassen die Kartei nie.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Liste, Zeile, LEUCHT } from '../../schlank';
import { EXPORTE, EXPORT_INFO } from '@/lib/crm/export';
import { type CrmApi, datum } from '../daten';
import type { StammdatenDaten } from './typen';

export function Austausch({ d, api, laeuft, setLaeuft, setMeldung, laden }: { d: StammdatenDaten; api: CrmApi; laeuft: boolean; setLaeuft: (v: boolean) => void; setMeldung: (t: string) => void; laden: () => void }) {
  const importieren = async (body: string, name?: string) => {
    setLaeuft(true);
    const r = await fetch('/api/crm/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setLaeuft(false);
    setMeldung(r.error ? r.error : `${name ? `${name}: ` : ''}${r.zeilen} Zeilen — ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert · Firmen: ${r.firmen?.neu ?? 0} neu.`);
    laden(); void api.laden();
  };
  return (
    <>
      <Karte i={0}>
        <Ueberschrift>Masterdatei abgleichen</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Die Masterliste als CSV (Semikolon oder Komma, UTF-8 oder Excel-Export) hochladen — wiederholbar: neue Zeilen kommen dazu, Stammdaten werden aufgefrischt, die Arbeit im CRM (Stufe, Verlauf, Kreis, Einwilligungen, Werbesperre) bleibt unberührt. Danach laufen der Firmen-Abgleich und die Dublettenprüfung.</div>
        {d.letzterImport && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 8 }}>Zuletzt: {datum(d.letzterImport.zeit)} — {d.letzterImport.text}</div>}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="fassbar" style={{ display: 'inline-block' }}>
            <span style={{ display: 'inline-block', padding: '9px 15px', borderRadius: 11, fontSize: TYP.bedien, fontWeight: 700, cursor: laeuft ? 'default' : 'pointer', background: `${LEUCHT.gut}22`, color: LEUCHT.gut, border: `1px solid ${LEUCHT.gut}55` }}>{laeuft ? 'Gleicht ab …' : 'CSV-Datei wählen und abgleichen'}</span>
            <input type="file" accept=".csv,text/csv,text/plain" disabled={laeuft} style={{ display: 'none' }} onChange={async e => {
              const datei = e.target.files?.[0]; e.target.value = '';
              if (!datei) return;
              // Excel schreibt oft Windows-1252: erst als UTF-8 versuchen, sonst umkodieren — so bleiben Umlaute heil.
              const roh = await datei.arrayBuffer();
              let csv: string;
              try { csv = new TextDecoder('utf-8', { fatal: true }).decode(roh); } catch { csv = new TextDecoder('windows-1252').decode(roh); }
              await importieren(JSON.stringify({ csv, name: datei.name }), datei.name);
            }} />
          </label>
          <Knopf leise aus={laeuft} onClick={() => void importieren('{}')}>Vom Mac-Schreibtisch (CRM Leadordner)</Knopf>
        </div>
      </Karte>
      <Karte i={1}>
        <Ueberschrift>Export</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Fünf Tabellen als CSV (Semikolon, UTF-8 mit BOM, Datum ISO) — für Excel, den Steuerberater oder ein Versandwerkzeug. Nie mit Privatnotiz oder Verlauf; gesperrte Personen sind markiert, damit keine Werbeliste sie trifft.</div>
        <Liste>
          {EXPORTE.map(was => (
            <Zeile key={was} titel={EXPORT_INFO[was].label} unter={<span style={{ whiteSpace: 'normal' }}>{EXPORT_INFO[was].text}</span>}
              rechts={<Knopf leise onClick={() => { window.location.href = `/api/crm/export?was=${was}`; }}>{EXPORT_INFO[was].label} als CSV</Knopf>} />
          ))}
        </Liste>
      </Karte>
    </>
  );
}
