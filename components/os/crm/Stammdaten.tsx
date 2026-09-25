'use client';

// ─── Markttraktion · Stammdaten — sauber halten, was alles andere trägt ───────────────
// Übersicht (Selbstprüfung + was zu tun ist) · Datenqualität (Vollständigkeit,
// Dubletten, Firmen-Abgleich) · Wertelisten (Stufen mit Wahrscheinlichkeit,
// Verlustgründe, Herkunft, Rechtsgrundlagen) · Datenschutz (Pflichtangaben,
// Löschkonzept, Betroffenenanträge, Verzeichnis nach Art. 30) · Import & Export.
// Grundkonzept aus den Stammdaten von KEMARIS Operations, eigener Code.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, Zahl, Raster, Fortschritt, Liste, Zeile, Punkt, LEUCHT } from '../schlank';
import { HERKUNFT, RECHTSGRUNDLAGEN, ERGEBNISSE } from '@/lib/make-one/crm';
import type { Antrag, AntragArt, Verarbeitung } from '@/lib/crm/typen';
import type { Kpi } from '@/lib/crm/kennzahlen';
import type { Befund } from '@/lib/crm/befunde';
import type { Pruefpunkt } from '@/lib/crm/datenschutz';
import { type CrmApi, neueId, datum } from './daten';
import { Pillen, Feld, Feldzeile } from './teile';

type Unter = 'uebersicht' | 'qualitaet' | 'wertelisten' | 'datenschutz' | 'austausch';
const UNTER: { id: Unter; label: string }[] = [{ id: 'uebersicht', label: 'Übersicht' }, { id: 'qualitaet', label: 'Datenqualität' }, { id: 'wertelisten', label: 'Wertelisten' }, { id: 'datenschutz', label: 'Datenschutz' }, { id: 'austausch', label: 'Import & Export' }];
const P_FARBE = { erfuellt: LEUCHT.gut, teilweise: LEUCHT.achtung, offen: LEUCHT.kritisch } as const;
const ANTRAG_ART: { id: AntragArt; label: string }[] = [{ id: 'auskunft', label: 'Auskunft (Art. 15)' }, { id: 'berichtigung', label: 'Berichtigung (16)' }, { id: 'loeschung', label: 'Löschung (17)' }, { id: 'einschraenkung', label: 'Einschränkung (18)' }, { id: 'uebertragbarkeit', label: 'Übertragbarkeit (20)' }, { id: 'widerspruch', label: 'Widerspruch (21)' }];
const ERG_LABEL: Record<string, string> = { gespraech: 'Gespräch', termin: 'Termin', mailbox: 'Mailbox', nicht_erreicht: 'nicht erreicht', rueckruf: 'Rückruf', kein_bedarf: 'kein Bedarf', sperre: 'Sperre (Widerspruch)' };

interface Daten {
  heute: string; kennzahlen: Kpi[]; befunde: Befund[]; selbstpruefung: Pruefpunkt[];
  qualitaet: { kontakte: number; firmen: number; vollstaendigkeit: { feld: string; label: string; anzahl: number; anteil: number }[]; dublettenPersonen: number; dublettenFirmen: number; ohneFirmenverweis: number; art14: number; speicherbegrenzung: number; werbesperren: { id: string; seit: string }[] };
  wertelisten: { stufen: { id: string; label: string; standard: number; p: number; vonHand: boolean; weiterWenn: string; offen: boolean }[]; verlustgruende: { grund: string; anzahl: number }[] };
  letzterImport: { zeit: string; text: string } | null;
  pflichtangaben: { anzahl: number; herkunft: Record<string, number>; rechtsgrundlage: Record<string, number>; fremddaten: number; beispiele: { name: string; herkunft?: string; rechtsgrundlage?: string; fremddaten: boolean; grund: string }[] };
  loeschregeln: { id: string; titel: string; frist: string; aktion: string; norm: string }[];
  speicherbegrenzung: { id: string; name: string; seit: string }[];
  antraege: Antrag[]; verarbeitungen: Verarbeitung[]; loeschprotokoll: { id: string; datum: string; grund: string; von: string }[];
}

export function Stammdaten({ api, zuBereich, zuKontakt, start }: { api: CrmApi; zuBereich: (b: string, ansicht?: string) => void; zuKontakt: (id: string) => void; start?: string }) {
  const [unter, setUnter] = useState<Unter>((UNTER.find(u => u.id === start)?.id) ?? 'uebersicht');
  const [d, setD] = useState<Daten | null>(null);
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const laden = useCallback(() => fetch('/api/crm/stammdaten', { cache: 'no-store' }).then(r => r.json()).then(x => x.ok && setD(x)).catch(() => {}), []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { if (start && UNTER.some(u => u.id === start)) setUnter(start as Unter); }, [start]);
  const post = async (body: Record<string, unknown>) => {
    setLaeuft(true);
    const r = await fetch('/api/crm/stammdaten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false }));
    setLaeuft(false); await laden(); void api.laden();
    return r;
  };
  if (!d) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const offenePruefung = d.selbstpruefung.filter(p => p.status !== 'erfuellt').length;

  return (
    <>
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={UNTER} aktiv={unter} onWahl={setUnter} /></div>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}

      {unter === 'uebersicht' && (
        <>
          <Karte i={0}>
            <Ueberschrift rechts={<Chip farbe={offenePruefung ? LEUCHT.achtung : LEUCHT.gut}>{d.selbstpruefung.length - offenePruefung} von {d.selbstpruefung.length} erfüllt</Chip>}>Selbstprüfung</Ueberschrift>
            <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 8 }}>Aus den echten Beständen gerechnet, nicht abgehakt. Keine Rechtsberatung.</div>
            <Liste>
              {d.selbstpruefung.map(p => (
                <Zeile key={p.id} links={<Punkt farbe={P_FARBE[p.status]} />} titel={p.titel} unter={`${p.befund} · ${p.norm}`}
                  rechts={p.status !== 'erfuellt' && (p.id === 'rechtsgrundlage' || p.id === 'herkunft' || p.id === 'art14' || p.id === 'antraege') ? <Knopf leise onClick={() => setUnter('datenschutz')}>Beheben</Knopf> : <Chip farbe={P_FARBE[p.status]}>{p.status === 'erfuellt' ? 'erfüllt' : p.status}</Chip>} />
              ))}
            </Liste>
          </Karte>
          <Karte i={1}>
            <Ueberschrift>Was jetzt zu tun ist</Ueberschrift>
            <Befunde liste={d.befunde} zuBereich={(b, a) => (b === 'stammdaten' && a ? setUnter(a as Unter) : zuBereich(b, a))} />
          </Karte>
          <Karte i={2}>
            <Ueberschrift>Bestand</Ueberschrift>
            <Raster min={140}>
              <Zahl wert={String(d.qualitaet.kontakte)} label="Personen" /><Zahl wert={String(d.qualitaet.firmen)} label="Firmen" />
              <Zahl wert={String(d.qualitaet.dublettenPersonen + d.qualitaet.dublettenFirmen)} label="Dubletten" farbe={d.qualitaet.dublettenPersonen + d.qualitaet.dublettenFirmen ? LEUCHT.achtung : undefined} />
              <Zahl wert={String(d.qualitaet.werbesperren.length)} label="Werbesperren" /><Zahl wert={d.kennzahlen.find(k => k.id === 'reife')?.anzeige ?? '—'} label="Datenreife" />
            </Raster>
          </Karte>
        </>
      )}

      {unter === 'qualitaet' && (
        <>
          <Karte i={0}>
            <Ueberschrift rechts={`${d.qualitaet.kontakte} Personen`}>Vollständigkeit</Ueberschrift>
            <div style={{ display: 'grid', gap: 9 }}>
              {d.qualitaet.vollstaendigkeit.map(f => (
                <div key={f.feld} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,140px) 1fr 70px', gap: 12, alignItems: 'center', fontSize: TYP.bedien }}>
                  <span style={{ color: C.inkDim }}>{f.label}</span>
                  <Fortschritt anteil={Math.max(0.02, f.anteil)} farbe={f.anteil >= 0.6 ? LEUCHT.gut : f.anteil >= 0.3 ? LEUCHT.achtung : LEUCHT.kritisch} />
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(f.anteil * 100)} %</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10 }}>Kreis, Anrede und Lebensphase pflegst du in der Karteikarte — sie steuern Power Hour und Entwürfe.</div>
          </Karte>
          <Karte i={1}>
            <Ueberschrift rechts={<Knopf leise aus={laeuft} onClick={async () => { const r = await post({ aktion: 'firmen-abgleich' }); setMeldung(r.ok ? `Firmen-Abgleich: ${r.neu} neu, ${r.verknuepft} Personen verknüpft, ${r.ergaenzt} ergänzt.` : 'Abgleich fehlgeschlagen.'); }}>Firmen abgleichen</Knopf>}>Firmen</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
              {d.qualitaet.firmen} Firmen · {d.qualitaet.ohneFirmenverweis} Personen mit Firmenname, aber ohne Verknüpfung · {d.qualitaet.dublettenFirmen} Firmen-Dubletten.
              Der Abgleich legt fehlende Firmen an, verknüpft Personen und füllt nur leere Felder — Gepflegtes bleibt.
            </div>
          </Karte>
          <Karte i={2}>
            <Ueberschrift>Dubletten</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>{d.qualitaet.dublettenPersonen} Personen-Paare (gleicher Name und ein zweites Merkmal). Zusammenführen in der Kartei, Ansicht „Dubletten“ — Verlauf, Einwilligungen und zweite Mailadresse bleiben erhalten, eine Sperre gilt weiter.</div>
            <div style={{ marginTop: 10 }}><Knopf leise onClick={() => zuBereich('kontakte', 'dubletten')}>Dubletten öffnen</Knopf></div>
          </Karte>
        </>
      )}

      {unter === 'wertelisten' && (
        <>
          <Karte i={0}>
            <Ueberschrift>Pipeline-Stufen</Ueberschrift>
            <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 8 }}>Die Wahrscheinlichkeiten sind vorsichtige Startwerte. Sobald je Stufe genug Abschlüsse da sind, ersetzt du sie durch gemessene Quoten — von Hand gesetzte Werte sind markiert.</div>
            <Liste>
              {d.wertelisten.stufen.map(s => (
                <Zeile key={s.id} titel={s.label} unter={s.offen ? `Weiter, wenn: ${s.weiterWenn}` : 'Endzustand'}
                  rechts={s.offen ? <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {s.vonHand && <Chip farbe={LEUCHT.achtung}>von Hand</Chip>}
                    <Feld typ="number" breite={80} wert={String(s.p)} platzhalter="%" onFertig={x => void post({ aktion: 'wahrscheinlichkeit', stufe: s.id, p: x === '' ? null : Number(x) })} />
                    <span style={{ fontSize: 12, color: C.inkLeise }}>%</span>
                    {s.vonHand && <button onClick={() => void post({ aktion: 'wahrscheinlichkeit', stufe: s.id, p: null })} title={`Zurück auf ${s.standard} %`} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>↺ {s.standard}</button>}
                  </span> : <Chip farbe={C.inkDim}>{s.p} %</Chip>} />
              ))}
            </Liste>
          </Karte>
          <Karte i={1}>
            <Ueberschrift>Verlustgründe</Ueberschrift>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{d.wertelisten.verlustgruende.map(v => <Chip key={v.grund} farbe={v.anzahl ? LEUCHT.kritisch : C.inkDim}>{v.grund}{v.anzahl ? ` · ${v.anzahl}` : ''}</Chip>)}</div>
            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Pflicht beim Verlieren einer Chance — daraus lernt die Pipeline (Win/Loss).</div>
          </Karte>
          <Karte i={2}>
            <Ueberschrift>Gesprächsergebnisse</Ueberschrift>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{ERGEBNISSE.map(e => <Chip key={e} farbe={C.inkDim}>{ERG_LABEL[e]}</Chip>)}</div>
            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Jedes Ergebnis setzt per Regel den nächsten Schritt (nicht erreicht → 2 Werktage, Mailbox → 3, Sperre → Werbesperre).</div>
          </Karte>
          <Karte i={3}>
            <Ueberschrift>Herkunft & Rechtsgrundlage</Ueberschrift>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{HERKUNFT.map(h => <Chip key={h.id} farbe={h.fremd ? LEUCHT.achtung : C.inkDim}>{h.label}{h.fremd ? ' · Art. 14' : ''}</Chip>)}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{RECHTSGRUNDLAGEN.map(r => <Chip key={r.id} farbe={C.inkDim}>{r.label} · {r.norm}</Chip>)}</div>
            </div>
          </Karte>
        </>
      )}

      {unter === 'datenschutz' && (
        <>
          <Karte i={0} akzent={d.pflichtangaben.anzahl ? LEUCHT.achtung : undefined}>
            <Ueberschrift rechts={d.pflichtangaben.anzahl ? <Knopf aus={laeuft} onClick={async () => { const r = await post({ aktion: 'pflichtangaben' }); setMeldung(r.ok ? `${r.gesetzt} Kontakte ergänzt.` : 'Nicht übernommen.'); }}>{d.pflichtangaben.anzahl} übernehmen</Knopf> : undefined}>Pflichtangaben</Ueberschrift>
            {d.pflichtangaben.anzahl ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Herkunft (Art. 14) und Rechtsgrundlage (Art. 6) per Regel vorgeschlagen — erste passende Regel, im Zweifel die schwächere Grundlage, nie geratene Einwilligung. Übernommen werden nur leere Felder.</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(d.pflichtangaben.herkunft).map(([h, n]) => <Chip key={h} farbe={C.inkDim}>{HERKUNFT.find(x => x.id === h)?.label ?? h} · {n}</Chip>)}
                  {Object.entries(d.pflichtangaben.rechtsgrundlage).map(([r, n]) => <Chip key={r} farbe={C.inkDim}>{RECHTSGRUNDLAGEN.find(x => x.id === r)?.label ?? r} · {n}</Chip>)}
                  {d.pflichtangaben.fremddaten > 0 && <Chip farbe={LEUCHT.achtung}>Art.-14-Uhr startet für {d.pflichtangaben.fremddaten}</Chip>}
                </div>
                <div style={{ display: 'grid', gap: 3 }}>{d.pflichtangaben.beispiele.map((b, i) => <div key={i} style={{ fontSize: 12.5, color: C.inkLeise }}>z. B. {b.name}: {HERKUNFT.find(x => x.id === b.herkunft)?.label ?? '—'} · {RECHTSGRUNDLAGEN.find(x => x.id === b.rechtsgrundlage)?.label ?? '—'} ({b.grund})</div>)}</div>
              </div>
            ) : <Leer>Alle Personen haben Herkunft und Rechtsgrundlage.</Leer>}
          </Karte>
          <Antraege d={d} api={api} laden={laden} zuKontakt={zuKontakt} />
          <Karte i={2}>
            <Ueberschrift>Löschkonzept</Ueberschrift>
            <Liste>{d.loeschregeln.map(r => <Zeile key={r.id} titel={r.titel} unter={`${r.frist} · ${r.norm}`} rechts={<Chip farbe={r.aktion.startsWith('Löschen') ? LEUCHT.kritisch : r.aktion.startsWith('Sperren') ? LEUCHT.achtung : C.inkDim}>{r.aktion}</Chip>} />)}</Liste>
            <div style={{ marginTop: 10, fontSize: TYP.bedien, color: d.speicherbegrenzung.length ? LEUCHT.achtung : C.inkLeise }}>{d.speicherbegrenzung.length ? `${d.speicherbegrenzung.length} Interessenten über 24 Monate ohne Interaktion — löschen (Karteikarte › Recht) oder Grund notieren.` : 'Heute ist nichts über der Frist. Gelöscht wird nie automatisch, nur nach deiner Entscheidung.'}</div>
            {d.speicherbegrenzung.slice(0, 8).map(k => <button key={k.id} onClick={() => zuKontakt(k.id)} style={{ display: 'block', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '2px 0' }}>{k.name} — seit {datum(k.seit)}</button>)}
          </Karte>
          <Verzeichnis liste={d.verarbeitungen} api={api} laden={laden} />
          {d.loeschprotokoll.length > 0 && (
            <Karte i={4}>
              <Ueberschrift>Löschprotokoll</Ueberschrift>
              <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Nur Kennung, Datum, Grund — keine Personendaten.</div>
              {d.loeschprotokoll.map((e, i) => <div key={i} style={{ fontSize: 12.5, color: C.inkDim, padding: '2px 0' }}>{datum(e.datum)} · {e.id} · {e.grund} · {e.von}</div>)}
            </Karte>
          )}
        </>
      )}

      {unter === 'austausch' && (
        <>
          <Karte i={0}>
            <Ueberschrift>Masterdatei abgleichen</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Quelle: <b style={{ color: C.ink }}>Schreibtisch › CRM Leadordner › CRM_MASTER_Hauptdatei.csv</b>. Wiederholbar: neue Zeilen kommen dazu, Stammdaten werden aufgefrischt, die Arbeit im CRM (Stufe, Verlauf, Kreis, Einwilligungen, Werbesperre) bleibt unberührt. Danach laufen der Firmen-Abgleich und die Dublettenprüfung.</div>
            {d.letzterImport && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 8 }}>Zuletzt: {datum(d.letzterImport.zeit)} — {d.letzterImport.text}</div>}
            <div style={{ marginTop: 12 }}><Knopf aus={laeuft} onClick={async () => {
              setLaeuft(true);
              const r = await fetch('/api/crm/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
              setLaeuft(false); setMeldung(r.error ? r.error : `${r.zeilen} Zeilen: ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert · Firmen: ${r.firmen?.neu ?? 0} neu.`);
              void laden(); void api.laden();
            }}>Jetzt abgleichen</Knopf></div>
          </Karte>
          <Karte i={1}>
            <Ueberschrift>Export</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Die Kartei als CSV (Semikolon, UTF-8) mit Firma, Kreis, Phase, Stufe, nächstem Schritt und der Kanal-Freigabe je Person. Ohne Privatnotiz und Verlauf; gesperrte Personen sind markiert, damit keine Werbeliste sie trifft.</div>
            <div style={{ marginTop: 12 }}><Knopf leise onClick={() => { window.location.href = '/api/crm/export'; }}>Kartei als CSV</Knopf></div>
          </Karte>
        </>
      )}
    </>
  );
}

export function Befunde({ liste, zuBereich }: { liste: Befund[]; zuBereich: (b: string, ansicht?: string) => void }) {
  if (!liste.length) return <Leer>Nichts Rotes — alles im Rahmen.</Leer>;
  const F = { 1: LEUCHT.kritisch, 2: LEUCHT.achtung, 3: LEUCHT.puls, 4: C.inkDim, 5: C.inkLeise } as const;
  return (
    <Liste>
      {liste.map((b, i) => <Zeile key={i} onClick={() => zuBereich(b.bereich, b.ansicht)} links={<Punkt farbe={F[b.prio]} />} titel={<span style={{ whiteSpace: 'normal' }}>{b.titel}</span>} unter={b.grund} rechts={<span style={{ color: C.inkLeise }}>›</span>} />)}
    </Liste>
  );
}

function Antraege({ d, api, laden, zuKontakt }: { d: Daten; api: CrmApi; laden: () => void; zuKontakt: (id: string) => void }) {
  const [neu, setNeu] = useState<{ art: AntragArt; name: string; email: string; eingang: string } | null>(null);
  const offen = d.antraege.filter(a => a.status === 'offen').sort((a, b) => a.frist.localeCompare(b.frist));
  const erledigt = d.antraege.filter(a => a.status === 'erledigt').slice(-5).reverse();
  const setze = async (a: Partial<Antrag> & { id: string }) => { await api.setze('antraege', a as unknown as { id: string } & Record<string, unknown>); laden(); };
  const tage = (f: string) => Math.round((Date.parse(`${f}T12:00:00Z`) - Date.parse(`${d.heute}T12:00:00Z`)) / 864e5);
  const passend = (name: string) => (api.kontakte ?? []).find(k => `${k.vorname} ${k.nachname}`.trim().toLowerCase() === name.trim().toLowerCase());
  return (
    <Karte i={1}>
      <Ueberschrift rechts={!neu ? <Knopf leise onClick={() => setNeu({ art: 'auskunft', name: '', email: '', eingang: d.heute })}>+ Antrag</Knopf> : undefined}>Betroffenenrechte · {offen.length} offen</Ueberschrift>
      {neu && (
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 10 }}>
          <Pillen liste={ANTRAG_ART} aktiv={neu.art} onWahl={art => setNeu({ ...neu, art })} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}><Feld wert={neu.name} platzhalter="Name*" onFertig={name => setNeu({ ...neu, name })} /></div>
            <div style={{ flex: 1, minWidth: 160 }}><Feld wert={neu.email} platzhalter="E-Mail" onFertig={email => setNeu({ ...neu, email })} /></div>
            <Feld typ="date" breite={150} wert={neu.eingang} platzhalter="Eingang" onFertig={eingang => setNeu({ ...neu, eingang })} />
          </div>
          {neu.name && passend(neu.name) && <div style={{ fontSize: 12, color: LEUCHT.gut }}>In der Kartei gefunden — wird verknüpft.</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Knopf aus={!neu.name.trim()} onClick={() => { const k = passend(neu.name); void setze({ id: neueId('ant'), art: neu.art, name: neu.name.trim(), ...(neu.email ? { email: neu.email } : {}), ...(k ? { kontaktId: k.id } : {}), eingang: neu.eingang, status: 'offen' }); setNeu(null); }}>Anlegen</Knopf>
            <Knopf leise onClick={() => setNeu(null)}>Abbrechen</Knopf>
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise }}>Frist: ein Monat ab Eingang (Art. 12 Abs. 3 DSGVO).</div>
        </div>
      )}
      <Liste>
        {offen.map(a => {
          const t = tage(a.frist);
          return (
            <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontWeight: 600 }}>{ANTRAG_ART.find(x => x.id === a.art)?.label}</b><span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{a.name}{a.email ? ` · ${a.email}` : ''} · Eingang {datum(a.eingang)}</span>
                <Chip farbe={t < 0 ? LEUCHT.kritisch : t < 7 ? LEUCHT.achtung : C.inkDim}>{t < 0 ? `${-t} Tage überfällig` : `noch ${t} Tage`}</Chip>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {a.kontaktId && <Knopf leise onClick={() => { window.location.href = `/api/crm/datenschutz?id=${a.kontaktId}`; }}>Datenkopie (JSON)</Knopf>}
                {a.kontaktId && <Knopf leise onClick={() => zuKontakt(a.kontaktId!)}>Zur Person</Knopf>}
                <Knopf onClick={() => { const e = window.prompt('Ergebnis (z. B. „Auskunft am … per Mail übermittelt“)') ?? ''; if (e.trim()) void setze({ ...a, status: 'erledigt', ergebnis: e.trim(), erledigtAm: d.heute }); }}>Erledigt</Knopf>
              </div>
            </div>
          );
        })}
      </Liste>
      {!offen.length && !neu && <Leer>Kein offener Antrag.</Leer>}
      {erledigt.map(a => <div key={a.id} style={{ fontSize: 12.5, color: C.inkLeise, padding: '2px 0' }}>{ANTRAG_ART.find(x => x.id === a.art)?.label} · {a.name} — {a.ergebnis} · {datum(a.erledigtAm)}</div>)}
    </Karte>
  );
}

function Verzeichnis({ liste, api, laden }: { liste: Verarbeitung[]; api: CrmApi; laden: () => void }) {
  const [offen, setOffen] = useState<string | null>(null);
  const setze = async (v: Verarbeitung) => { await api.setze('verarbeitungen', v as unknown as { id: string } & Record<string, unknown>); laden(); };
  const FELDER: [keyof Verarbeitung, string][] = [['zweck', 'Zweck'], ['personen', 'Betroffene'], ['daten', 'Datenkategorien'], ['rechtsgrundlage', 'Rechtsgrundlage'], ['empfaenger', 'Empfänger'], ['drittland', 'Drittland'], ['loeschfrist', 'Löschfrist'], ['toms', 'Schutzmaßnahmen'], ['verantwortlich', 'Verantwortlich']];
  return (
    <Karte i={3}>
      <Ueberschrift rechts={<Knopf leise onClick={() => { const id = neueId('vv'); void setze({ id, name: 'Neue Verarbeitung', zweck: '', personen: '', daten: '', rechtsgrundlage: '', empfaenger: '', drittland: '', loeschfrist: '', toms: '', verantwortlich: 'Kevin Dieckmann', stand: '' }); setOffen(id); }}>+ Verarbeitung</Knopf>}>Verzeichnis der Verarbeitungen (Art. 30)</Ueberschrift>
      <Liste>
        {liste.map(v => (
          <div key={v.id}>
            <Zeile onClick={() => setOffen(offen === v.id ? null : v.id)} aktiv={offen === v.id} titel={v.name} unter={`${v.zweck.slice(0, 90)} · Stand ${datum(v.stand)}`} />
            {offen === v.id && (
              <div style={{ padding: '8px 2px 14px' }}>
                <Feldzeile label="Bezeichnung"><Feld wert={v.name} onFertig={name => name.trim() && setze({ ...v, name: name.trim() })} /></Feldzeile>
                {FELDER.map(([f, l]) => <Feldzeile key={f} label={l}><Feld wert={String(v[f] ?? '')} onFertig={x => setze({ ...v, [f]: x })} /></Feldzeile>)}
              </div>
            )}
          </div>
        ))}
      </Liste>
    </Karte>
  );
}
