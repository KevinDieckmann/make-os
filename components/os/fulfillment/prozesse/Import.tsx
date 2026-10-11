'use client';

// ─── Fulfillment › Bausteine › Import (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 2.6, 2.7) ──────────────────────────────────────────────
// Datei wählen (JSON: Bausteine `vorlagen: […]` oder Abläufe) → Vorschau vom Server (schreibt nichts) → je Eintrag Marken setzen/lösen
// („vor Einsatz rechtlich prüfen“, „vor Verkauf prüfen“), bei abweichenden Bausteinen „Import nehmen“, je Paket-Schlüssel eine Paket-Vorlage
// zum Einsortieren → Übernehmen (409, wenn sich die Bibliothek seit der Vorschau geändert hat) → Rückgängig (30 Tage, nur Unverändertes).
// Die Datei verlässt den Browser nur Richtung eigener Server; Quellenverzeichnis, Links und Preise übernimmt der Server nie.

import { useRef, useState } from 'react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Chip, LEUCHT, useRueckfrage, Erklaert } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import type { ImportVorschau, ImportWahl } from '@/lib/fulfillment/prozesse/import';
import { holeJson, fehlerText, geaendert, tagLang, type Uebersicht } from './daten';
import { klein, Leiste } from './teile';

const STATUS_TEXT: Record<string, string> = { neu: 'neu', gleich: 'unverändert', ergaenzt: 'ergänzt leere Felder', abweichend: 'weicht ab', konflikt: 'von Hand geändert', aktualisiert: 'wird aktualisiert' };
const STATUS_FARBE: Record<string, string> = { neu: LEUCHT.gut, gleich: C.inkLeise, ergaenzt: LEUCHT.planung, abweichend: LEUCHT.achtung, konflikt: LEUCHT.kritisch, aktualisiert: LEUCHT.planung };

function Haken({ an, onChange, children }: { an: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim }}>
      <input type="checkbox" checked={an} onChange={e => onChange(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.aktiv }} />{children}
    </label>
  );
}

export function Import({ daten }: { daten: Uebersicht }) {
  const datei = useRef<HTMLInputElement>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [v, setV] = useState<{ vorschau: ImportVorschau; vorschauId: string } | null>(null);
  const [wahl, setWahl] = useState<ImportWahl>({});
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' } | null>(null);
  const pakete = daten.prozesse.filter(p => p.art === 'paket');
  const lesen = async (f: File) => {
    setMeldung(null); setV(null); setWahl({});
    if (f.size > 4 * 1024 * 1024) { setMeldung({ text: 'Die Datei ist größer als 4 MB — bitte teilen.', art: 'kritisch' }); return; }
    const t = await f.text();
    setText(t); setName(f.name);
    const a = await holeJson<{ vorschau: ImportVorschau; vorschauId: string }>('/api/fulfillment/import', { method: 'POST', body: JSON.stringify({ aktion: 'vorschau', datei: f.name, inhalt: t }) });
    if (a.ok) setV({ vorschau: a.j.vorschau, vorschauId: a.j.vorschauId }); else setMeldung({ text: fehlerText(a), art: 'kritisch' });
  };
  const uebernehmen = async () => {
    if (!text || !v) return;
    const a = await holeJson<{ laufId: string | null; neu: number; geaendert: number }>('/api/fulfillment/import', { method: 'POST', body: JSON.stringify({ aktion: 'uebernehmen', datei: name, inhalt: text, vorschauId: v.vorschauId, wahl }) });
    if (a.ok) { setMeldung({ text: `Übernommen: ${a.j.neu} neu, ${a.j.geaendert} geändert.`, art: 'gut' }); setV(null); setText(null); geaendert(); if (datei.current) datei.current.value = ''; }
    else setMeldung({ text: fehlerText(a), art: 'kritisch' });
  };
  const rueckgaengig = async (id: string) => {
    if (!(await bestaetigen({ titel: 'Import rückgängig machen?', text: 'Zurückgenommen wird nur, was seit dem Import unverändert ist — von Hand geänderte Einträge bleiben.', ja: 'Rückgängig', gefahr: true }))) return;
    const a = await holeJson<{ bericht?: { entfernt: number; zurueck: number; geblieben: number } }>('/api/fulfillment/import', { method: 'POST', body: JSON.stringify({ aktion: 'rueckgaengig', laufId: id }) });
    if (a.ok) { const b = a.j.bericht; setMeldung({ text: `Rückgängig: ${b?.entfernt ?? 0} entfernt, ${b?.zurueck ?? 0} zurückgesetzt${b?.geblieben ? `, ${b.geblieben} geblieben (inzwischen geändert)` : ''}.`, art: 'gut' }); geaendert(); }
    else setMeldung({ text: fehlerText(a), art: 'kritisch' });
  };
  const setze = <K extends keyof ImportWahl>(k: K, id: string, wert: NonNullable<ImportWahl[K]>[string]) => setWahl(w => ({ ...w, [k]: { ...(w[k] ?? {}), [id]: wert } }));
  const vs = v?.vorschau;
  return (
    <Karte i={2}>
      <Ueberschrift erklaerung="fulfillment.importRechtPruefen">Import</Ueberschrift>
      <div style={klein}>Bausteine (Format „vorlagen“) oder gezeichnete Abläufe (je Ablauf „stufen“ und „uebergaenge“) — erst kommt eine Vorschau, geschrieben wird erst mit „Übernehmen“.</div>
      <Leiste>
        <input ref={datei} type="file" accept="application/json,.json" aria-label="Datei wählen" onChange={e => { const f = e.target.files?.[0]; if (f) void lesen(f); }} style={{ fontSize: TYP.bedien, color: C.inkDim, minHeight: 44 }} />
      </Leiste>
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
      {vs && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(vs.zaehler).filter(([, n]) => n > 0).map(([s, n]) => <Chip key={s} farbe={STATUS_FARBE[s] ?? C.inkDim}>{n} {STATUS_TEXT[s] ?? s}</Chip>)}
          </div>
          {vs.fehler.length > 0 && <Hinweis art="achtung" titel={`${vs.fehler.length} Einträge werden nicht übernommen`}>{vs.fehler.slice(0, 12).join(' · ')}{vs.fehler.length > 12 ? ` · und ${vs.fehler.length - 12} weitere` : ''}</Hinweis>}
          {vs.hinweise.map(h => <Hinweis key={h} art="info">{h}</Hinweis>)}
          {(vs.pakete.length > 0 || vs.giltFuer.length > 0) && pakete.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={MIKRO}>Einsortieren (optional) — je Schlüssel eine Paket-Vorlage</span>
              {(vs.pakete.length ? vs.pakete.map(k => ['pakete', k] as const) : vs.giltFuer.map(k => ['giltFuer', k] as const)).map(([art, k]) => (
                <div key={`${art}:${k}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Chip farbe={LEUCHT.planung}>{k}</Chip>
                  <Wahl label="Paket-Vorlage" liste={pakete.map(p => ({ id: p.id, label: p.titel }))} wert={wahl[art]?.[k] ?? null} onWahl={id => setze(art, k, id)} onLeeren={() => setWahl(w => { const x = { ...(w[art] ?? {}) }; delete x[k]; return { ...w, [art]: x }; })} leerenLabel="nur Bibliothek" />
                </div>
              ))}
            </div>
          )}
          {vs.bausteine.length > 0 && (
            <div style={{ display: 'grid', gap: 2, maxHeight: 520, overflowY: 'auto' }}>
              {vs.bausteine.map(b => (
                <div key={b.id} style={{ display: 'grid', gap: 2, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <b style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 600 }}>{b.titel}</b>
                    <Chip farbe={STATUS_FARBE[b.status]}>{STATUS_TEXT[b.status]}</Chip>
                    <Chip farbe={C.inkDim}>{b.art}</Chip>
                    {b.nurIntern && <Chip farbe={LEUCHT.agenten}>nur intern</Chip>}
                    {b.preis && <Chip farbe={C.inkLeise}>Preise → Produktkatalog</Chip>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <Haken an={wahl.recht?.[b.quelle] ?? !!b.recht} onChange={x => setze('recht', b.quelle, x)}>vor Einsatz rechtlich prüfen</Haken>
                    <Haken an={wahl.urheber?.[b.quelle] ?? !!b.urheber} onChange={x => setze('urheber', b.quelle, x)}>vor Verkauf prüfen</Haken>
                    {(b.status === 'abweichend' || b.status === 'konflikt') && <Haken an={wahl.nehmen?.[b.id] === true} onChange={x => setze('nehmen', b.id, x)}>Import nehmen (sonst meine Fassung behalten)</Haken>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {vs.ablaeufe.map(a => (
            <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <b style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 600 }}>{a.titel}</b>
              <Chip farbe={STATUS_FARBE[a.status]}>{STATUS_TEXT[a.status]}</Chip>
              <span style={klein}>{a.form} · {a.stufen} Stufen · {a.uebergaenge} Übergänge{a.ergaenzungen ? ` · ${a.ergaenzungen} ergänzt (gestrichelt)` : ''}</span>
              {a.status === 'konflikt' && <Haken an={wahl.nehmen?.[a.id] === true} onChange={x => setze('nehmen', a.id, x)}>Import nehmen</Haken>}
            </div>
          ))}
          <Leiste>
            <Knopf leise onClick={() => { setV(null); setText(null); if (datei.current) datei.current.value = ''; }}>Verwerfen</Knopf>
            <Erklaert erklaerung="fulfillment.urheberPruefen" name="Übernehmen"><Knopf haupt onClick={uebernehmen}>Übernehmen</Knopf></Erklaert>
          </Leiste>
        </div>
      )}
      {daten.importLaeufe.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={MIKRO}>Letzte Importe (30 Tage rückgängig)</span>
          {[...daten.importLaeufe].reverse().map(l => (
            <div key={l.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
              <span style={klein}>{tagLang(l.am)} · {l.datei} · {l.neu} neu · {l.geaendert} geändert</span>
              <Knopf leise onClick={() => rueckgaengig(l.id)}>Rückgängig</Knopf>
            </div>
          ))}
        </div>
      )}
      {dialog}
    </Karte>
  );
}
