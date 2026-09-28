'use client';

// ─── Stammdaten › Import & Export ───────────────────────────────────────────
// Masterdatei abgleichen in drei Schritten (27.09., „Online gewinnt“):
// Datei wählen → Vorschau (neu / aktualisiert / Konflikte / mögliche Dubletten /
// ohne Besitzer, nichts geschrieben) → Übernehmen. Danach die Konfliktliste zum
// Durchklicken: je Feld „Online behalten“ oder „Liste übernehmen“ — der Import
// selbst überschreibt nie, was online von Hand gepflegt wurde.
// K2 (28.09.): die Vorschau meldet verrutschte Zeilen, Excel-„E+“, verlorene PLZ-Nullen und unlesbare Daten
// (lib/crm/import-pruefung.ts) und wie viele Zeilen auf der Sperrliste stehen (werden nicht angelegt). Jeder
// Import ist ein Lauf mit „Rückgängig“ (30 Tage, nur unveränderte Kontakte — sonst Konflikt).
// Dazu fünf Exporte als CSV (app/api/crm/export?was=…, Aufbau in
// lib/crm/export.ts). Privatnotizen verlassen die Kartei nie.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Liste, Zeile, Zahl, LEUCHT } from '../../schlank';
import { EXPORTE, EXPORT_INFO } from '@/lib/crm/export';
import { anzeigename, type Konflikt } from '@/lib/make-one/crm';
import { leererKonfliktStand, type KonfliktStand } from '@/lib/crm/import-konflikte';
import { type CrmApi, datum } from '../daten';
import type { StammdatenDaten } from './typen';
import type { ImportWarnung, WarnArt } from '@/lib/crm/import-pruefung';
import type { LaufKurz, LaufKonflikt } from '@/lib/crm/import-lauf';

interface Vorschau {
  zeilen: number; neu: number; aktualisiert: number; unveraendert: number; konflikte: number; moeglicheDubletten: number; ohneBesitzer: number; abgelehnt: boolean;
  gesperrt?: number; uebergang?: number; warnungen?: ImportWarnung[]; pruefung?: Record<WarnArt, number>;
}
const WARN_LABEL: Record<WarnArt, string> = { spalten: 'verrutschte Zeilen', excel_zahl: 'Excel-Kurzform (E+)', plz_null: 'PLZ ohne führende Null', datum: 'unlesbares Datum' };
const LAUF_GRUND: Record<LaufKonflikt['grund'], string> = { 'seitdem geändert': 'seitdem geändert', 'nicht mehr da': 'nicht mehr da', 'inzwischen verknüpft': 'inzwischen an Deal/Mandat/Kampagne' };
/** Die gewählte Quelle: hochgeladene Datei oder der Mac-Schreibtisch (leer). */
type Quelle = { csv: string; name: string } | Record<string, never>;

const FELD_LABEL: Record<string, string> = {
  aufhaenger: 'Gesprächsaufhänger', notiz: 'Notiz', kategorie: 'Kategorie', typ: 'Kontakttyp', eignung: 'Vertriebseignung', prio: 'Priorität',
  email: 'E-Mail', telefon: 'Telefon', sms: 'Mobil', linkedin: 'LinkedIn', firma: 'Firma', position: 'Position', jobtitel: 'Jobtitel',
  firmaStadt: 'Stadt (Firma)', firmaBranche: 'Branche', quelle: 'Quelle', lifecycle: 'Lifecycle', owner: 'Owner (Liste)', recherche: 'Status Recherche',
};
const wert = (v: unknown) => { const t = typeof v === 'string' ? v : JSON.stringify(v) ?? ''; return t.length > 140 ? `${t.slice(0, 140)} …` : t || '—'; };

export function Austausch({ d, api, laeuft, setLaeuft, setMeldung, laden }: { d: StammdatenDaten; api: CrmApi; laeuft: boolean; setLaeuft: (v: boolean) => void; setMeldung: (t: string) => void; laden: () => void }) {
  const [quelle, setQuelle] = useState<Quelle | null>(null);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [stand, setStand] = useState<KonfliktStand>(leererKonfliktStand());
  const [zeigeDubletten, setZeigeDubletten] = useState(false);
  const [laeufe, setLaeufe] = useState<LaufKurz[]>([]);
  const name = useCallback((id: string) => { const k = (api.kontakte ?? []).find(x => x.id === id); return k ? anzeigename(k) : id; }, [api.kontakte]);

  const standLaden = useCallback(async () => {
    const r = await fetch('/api/crm/import').then(x => x.json()).catch(() => null) as (KonfliktStand & { ok: boolean }) | null;
    if (r?.ok) setStand({ konflikte: r.konflikte ?? [], moeglicheDubletten: r.moeglicheDubletten ?? [], ohneBesitzer: r.ohneBesitzer ?? 0, stand: r.stand ?? '', quelle: r.quelle ?? '' });
    if (r?.ok) setLaeufe(((r as unknown as { laeufe?: LaufKurz[] }).laeufe) ?? []);
  }, []);
  useEffect(() => { void standLaden(); }, [standLaden]);

  const post = async (body: Record<string, unknown>) => {
    setLaeuft(true);
    const r = await fetch('/api/crm/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setLaeuft(false);
    return r;
  };

  /** Schritt 2: Vorschau rechnen — nichts wird geschrieben. */
  const vorschauen = async (q: Quelle) => {
    setQuelle(q); setVorschau(null);
    const r = await post({ ...q, vorschau: true });
    if (r.error || r.fehler) { setMeldung(r.error ?? r.fehler); setQuelle(null); return; }
    setVorschau(r as Vorschau);
    setMeldung('');
  };
  /** Schritt 3: Übernehmen. Konflikte werden nicht angewandt, sondern unten aufgelistet. */
  const uebernehmen = async () => {
    if (!quelle) return;
    const r = await post(quelle);
    if (r.error || r.fehler) { setMeldung(r.error ?? r.fehler); return; }
    const kn = (r.konflikte as Konflikt[] | undefined)?.length ?? 0;
    setMeldung(`${'name' in quelle ? `${quelle.name}: ` : ''}${r.zeilen} Zeilen — ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert · ${kn} Konflikte zum Entscheiden · ${r.ohneBesitzer} ohne Besitzer${r.gesperrt ? ` · ${r.gesperrt} gesperrt übersprungen` : ''} · Firmen: ${r.firmen?.neu ?? 0} neu.${r.laufId ? ' Rückgängig: unten unter „Import-Läufe“.' : ''}`);
    setQuelle(null); setVorschau(null);
    await standLaden(); laden(); void api.laden();
  };
  const entscheiden = async (k: Konflikt, wahl: 'online' | 'liste') => {
    const r = await post({ aktion: 'konflikt', kontaktId: k.kontaktId, feld: k.feld, wahl });
    if (r.error || r.fehler) { setMeldung(r.error ?? r.fehler); return; }
    setStand(s => ({ ...s, konflikte: s.konflikte.filter(x => !(x.kontaktId === k.kontaktId && x.feld === k.feld)) }));
    void api.laden();
  };

  /** Import-Lauf zurücknehmen (K2 #25): nur unveränderte Kontakte, der Rest wird als Konflikt gemeldet. */
  const zuruecknehmen = async (l: LaufKurz) => {
    if (!window.confirm(`Import vom ${datum(l.am)} zurücknehmen? ${l.neu} neue Kontakte fallen weg, ${l.geaendert} geänderte bekommen ihren Stand von vorher — nur, wer seitdem nicht von Hand geändert wurde.`)) return;
    const r = await post({ aktion: 'rueckgaengig', laufId: l.id });
    if (r.error || r.fehler) { setMeldung(r.error ?? r.fehler); return; }
    const k = (r.konflikte as LaufKonflikt[] | undefined) ?? [];
    setMeldung(`Import zurückgenommen: ${r.zurueck} Kontakte zurückgesetzt${k.length ? ` · ${k.length} nicht angefasst (${k.slice(0, 5).map(x => `${name(x.id)}: ${LAUF_GRUND[x.grund]}`).join(', ')}${k.length > 5 ? ' …' : ''})` : ''}.`);
    await standLaden(); laden(); void api.laden();
  };

  const offen = stand.konflikte;
  return (
    <>
      <Karte i={0}>
        <Ueberschrift>Masterdatei abgleichen</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
          Die Masterliste als CSV (Semikolon oder Komma, UTF-8 oder Excel-Export) wählen — zuerst kommt eine Vorschau, geschrieben wird erst mit „Übernehmen“.
          <b style={{ color: C.ink }}> Online gewinnt:</b> die Liste füllt nur leere Felder; weicht sie von etwas ab, das hier von Hand gepflegt wurde, landet das in der Konfliktliste unten.
          Neue Zeilen kommen dazu, die Arbeit in der Markttraktion (Stufe, Verlauf, Besitzer, Kreis, Einwilligungen, Werbesperre) bleibt unberührt. Danach laufen der Firmen-Abgleich und die Dublettenprüfung.
        </div>
        {d.letzterImport && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 8 }}>Zuletzt: {datum(d.letzterImport.zeit)} — {d.letzterImport.text}</div>}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="fassbar" style={{ display: 'inline-block' }}>
            <span style={{ display: 'inline-block', padding: '9px 15px', borderRadius: 11, fontSize: TYP.bedien, fontWeight: 700, cursor: laeuft ? 'default' : 'pointer', background: `${LEUCHT.gut}22`, color: LEUCHT.gut, border: `1px solid ${LEUCHT.gut}55` }}>{laeuft ? 'Rechnet …' : '1 · CSV-Datei wählen'}</span>
            <input type="file" accept=".csv,text/csv,text/plain" disabled={laeuft} style={{ display: 'none' }} onChange={async e => {
              const datei = e.target.files?.[0]; e.target.value = '';
              if (!datei) return;
              // Excel schreibt oft Windows-1252: erst als UTF-8 versuchen, sonst umkodieren — so bleiben Umlaute heil.
              const roh = await datei.arrayBuffer();
              let csv: string;
              try { csv = new TextDecoder('utf-8', { fatal: true }).decode(roh); } catch { csv = new TextDecoder('windows-1252').decode(roh); }
              await vorschauen({ csv, name: datei.name });
            }} />
          </label>
          <Knopf leise aus={laeuft} onClick={() => void vorschauen({})}>Vom Mac-Schreibtisch (CRM Leadordner)</Knopf>
        </div>

        {vorschau && quelle && (
          <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 14, border: `1px solid ${C.linie}`, background: C.flaecheHoch }}>
            <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, marginBottom: 10 }}>2 · Vorschau{'name' in quelle ? ` — ${quelle.name}` : ' — Schreibtisch'} · {vorschau.zeilen} Zeilen · noch nichts geschrieben</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              <Zahl wert={String(vorschau.neu)} label="neu" farbe={LEUCHT.gut} />
              <Zahl wert={String(vorschau.aktualisiert)} label="aktualisiert" farbe={C.aktiv} />
              <Zahl wert={String(vorschau.unveraendert)} label="unverändert" />
              <Zahl wert={String(vorschau.konflikte)} label="Konflikte" farbe={vorschau.konflikte ? LEUCHT.achtung : undefined} />
              <Zahl wert={String(vorschau.moeglicheDubletten)} label="mögl. Dubletten" farbe={vorschau.moeglicheDubletten ? LEUCHT.achtung : undefined} />
              <Zahl wert={String(vorschau.ohneBesitzer)} label="ohne Besitzer" />
            </div>
            {(vorschau.gesperrt ?? 0) > 0 && <div style={{ marginTop: 10, fontSize: TYP.bedien, color: C.ink }}><b>{vorschau.gesperrt} gesperrt übersprungen</b> — stehen auf der Sperrliste (Werbesperre oder gelöscht) und werden nicht angelegt.</div>}
            {(vorschau.uebergang ?? 0) > 0 && <div style={{ marginTop: 6, fontSize: 12.5, color: C.inkLeise }}>{vorschau.uebergang} bestehende Kontakte über die frühere Schlüsselform wiedererkannt (keine Dubletten).</div>}
            {vorschau.pruefung && Object.values(vorschau.pruefung).some(n => n > 0) && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Datei prüfen: {(Object.keys(vorschau.pruefung) as WarnArt[]).filter(a => vorschau.pruefung![a] > 0).map(a => `${vorschau.pruefung![a]} × ${WARN_LABEL[a]}`).join(' · ')}</div>
                <Liste>
                  {(vorschau.warnungen ?? []).slice(0, 12).map((w, i) => <Zeile key={`${w.zeile}|${w.spalte ?? ''}|${i}`} titel={<>Zeile {w.zeile}{w.spalte ? <span style={{ color: C.inkLeise }}> · {w.spalte}</span> : null}</>} unter={<span style={{ whiteSpace: 'normal' }}>{w.text}</span>} />)}
                </Liste>
                {(vorschau.warnungen?.length ?? 0) > 12 && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 6 }}>… und weitere — am besten die Datei als CSV aus der Quelle neu speichern (Spalten als Text).</div>}
              </div>
            )}
            {vorschau.abgelehnt && <div style={{ marginTop: 10, fontSize: TYP.bedien, color: LEUCHT.kritisch }}>Diese Datei würde den Bestand halbieren — Übernehmen ist gesperrt.</div>}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf aus={laeuft || vorschau.abgelehnt} onClick={() => void uebernehmen()}>3 · Übernehmen</Knopf>
              <Knopf leise aus={laeuft} onClick={() => { setQuelle(null); setVorschau(null); }}>Abbrechen</Knopf>
            </div>
          </div>
        )}
      </Karte>

      {(offen.length > 0 || stand.moeglicheDubletten.length > 0 || stand.ohneBesitzer > 0) && (
        <Karte i={1} akzent={offen.length ? LEUCHT.achtung : undefined}>
          <Ueberschrift rechts={stand.stand ? <span style={{ fontSize: 12.5, color: C.inkLeise }}>Import {datum(stand.stand)}</span> : undefined}>Konflikte entscheiden {offen.length ? `· ${offen.length} offen` : '· alle entschieden'}</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Hier steht die Kartei anders als die Liste, und das Feld wurde online von Hand gepflegt. Nichts davon wurde überschrieben — je Zeile entscheiden. Was entschieden ist, fragt der nächste Import bei einer neuen Abweichung wieder.</div>
          {stand.ohneBesitzer > 0 && <div style={{ marginTop: 10, fontSize: TYP.bedien, color: C.ink }}><b>{stand.ohneBesitzer} ohne Besitzer</b> — in der Qualifizierungsrunde übernehmen.</div>}
          {offen.length > 0 && (
            <Liste>
              {offen.slice(0, 60).map(k => (
                <Zeile key={`${k.kontaktId}|${k.feld}`} titel={<>{name(k.kontaktId)} <span style={{ color: C.inkLeise }}>· {FELD_LABEL[k.feld] ?? k.feld}</span></>}
                  unter={<span style={{ whiteSpace: 'normal' }}><span style={{ color: C.aktiv }}>online:</span> {wert(k.online)} &nbsp;·&nbsp; <span style={{ color: LEUCHT.achtung }}>Liste:</span> {wert(k.liste)}</span>}
                  rechts={<div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Knopf leise aus={laeuft} onClick={() => void entscheiden(k, 'online')}>Online behalten</Knopf>
                    <Knopf leise aus={laeuft} onClick={() => void entscheiden(k, 'liste')}>Liste übernehmen</Knopf>
                  </div>} />
              ))}
            </Liste>
          )}
          {offen.length > 60 && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 8 }}>… und {offen.length - 60} weitere — nach dem Entscheiden rücken sie nach.</div>}
          {stand.moeglicheDubletten.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Mögliche Dubletten · {stand.moeglicheDubletten.length}</div>
                <Knopf leise onClick={() => setZeigeDubletten(v => !v)}>{zeigeDubletten ? 'Einklappen' : 'Anzeigen'}</Knopf>
              </div>
              {zeigeDubletten && (
                <>
                  <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 6 }}>Nur Vorschläge, nichts wurde verschmolzen. Sichere Paare stehen unter Kontakte › Dubletten.</div>
                  <Liste>
                    {stand.moeglicheDubletten.slice(0, 40).map((m, i) => (
                      <Zeile key={`${m.kontaktId}|${m.mitId ?? ''}|${i}`} titel={<>{name(m.kontaktId)}{m.mitId ? <span style={{ color: C.inkLeise }}> ↔ {name(m.mitId)}</span> : null}</>} unter={m.grund} />
                    ))}
                  </Liste>
                </>
              )}
            </div>
          )}
        </Karte>
      )}

      {laeufe.length > 0 && (
        <Karte i={2}>
          <Ueberschrift>Import-Läufe · 30 Tage</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Jeder Import lässt sich zurücknehmen: neue Kontakte fallen weg, geänderte bekommen ihren Stand von vorher. Wer seitdem von Hand geändert wurde, bleibt, wie er ist, und wird gemeldet.</div>
          <Liste>
            {laeufe.slice(0, 10).map(l => (
              <Zeile key={l.id} titel={<>{datum(l.am)} <span style={{ color: C.inkLeise }}>· {l.quelle}</span></>}
                unter={<span style={{ whiteSpace: 'normal' }}>{l.neu} neu · {l.geaendert} geändert{l.rueckgaengig ? ` · zurückgenommen ${datum(l.rueckgaengig.am)} (${l.rueckgaengig.zurueck} zurückgesetzt${l.rueckgaengig.konflikte.length ? `, ${l.rueckgaengig.konflikte.length} nicht angefasst` : ''})` : ''}</span>}
                rechts={l.rueckgaengig ? undefined : <Knopf leise aus={laeuft} onClick={() => void zuruecknehmen(l)}>Import rückgängig</Knopf>} />
            ))}
          </Liste>
        </Karte>
      )}

      <Karte i={3}>
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
