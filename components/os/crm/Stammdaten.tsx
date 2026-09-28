'use client';

// ─── Markttraktion · Stammdaten — sauber halten, was alles andere trägt ───────────────
// Übersicht (Selbstprüfung + was zu tun ist + Bestand + Verweise auf Produkte,
// Segmente, Team) · Datenqualität (Verbindungen, Vollständigkeit, Dubletten, Firmen-Abgleich)
// · Wertelisten (Stufen mit Wahrscheinlichkeit, Verlustgründe, Kadenz je Kreis,
// Gesprächsergebnisse, Ziele, Herkunft, Rechtsgrundlagen — stammdaten/Wertelisten.tsx)
// · Datenschutz (Pflichtangaben, Betroffenenanträge, Löschkonzept, Verzeichnis
// nach Art. 30) · Import & Export (stammdaten/Austausch.tsx).
// Adresse: /os/markttraktion?s=stammdaten&a=<Unter-Reiter> — der Unter-Reiter
// kommt als `start` herein und geht über `onAnsicht` zurück in den Link.
// Grundkonzept aus den Stammdaten von KEMARIS Operations, eigener Code.

import { useNachfrage } from './Nachfrage';
import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, Zahl, Raster, Fortschritt, Liste, Zeile, Punkt, LEUCHT } from '../schlank';
import { HERKUNFT, RECHTSGRUNDLAGEN } from '@/lib/make-one/crm';
import type { Antrag, AntragArt, Verarbeitung } from '@/lib/crm/typen';
import type { Befund } from '@/lib/crm/befunde';
import { type CrmApi, neueId, datum } from './daten';
import { Pillen, Feld, Feldzeile } from './teile';
import { Wahl } from './Wahl';
import type { StammdatenDaten as Daten, StammdatenPost } from './stammdaten/typen';
import { Laedt } from './stammdaten/Laden';
import { Wertelisten } from './stammdaten/Wertelisten';
import { Austausch } from './stammdaten/Austausch';
import { Verweise } from './stammdaten/Verweise';
import { Verbindungen } from './stammdaten/Verbindungen';

type Unter = 'uebersicht' | 'qualitaet' | 'wertelisten' | 'datenschutz' | 'austausch';
const UNTER: { id: Unter; label: string }[] = [{ id: 'uebersicht', label: 'Übersicht' }, { id: 'qualitaet', label: 'Datenqualität' }, { id: 'wertelisten', label: 'Wertelisten' }, { id: 'datenschutz', label: 'Datenschutz' }, { id: 'austausch', label: 'Import & Export' }];
const unterAus = (a?: string): Unter => UNTER.find(u => u.id === a)?.id ?? 'uebersicht';
const P_FARBE = { erfuellt: LEUCHT.gut, teilweise: LEUCHT.achtung, offen: LEUCHT.kritisch } as const;
const ANTRAG_ART: { id: AntragArt; label: string }[] = [{ id: 'auskunft', label: 'Auskunft (Art. 15)' }, { id: 'berichtigung', label: 'Berichtigung (16)' }, { id: 'loeschung', label: 'Löschung (17)' }, { id: 'einschraenkung', label: 'Einschränkung (18)' }, { id: 'uebertragbarkeit', label: 'Übertragbarkeit (20)' }, { id: 'widerspruch', label: 'Widerspruch (21)' }];

export function Stammdaten({ api, zuBereich, zuKontakt, start, onAnsicht }: { api: CrmApi; zuBereich: (b: string, ansicht?: string) => void; zuKontakt: (id: string) => void; start?: string; onAnsicht?: (a: string) => void }) {
  // Mit `onAnsicht` ist der Link die Wahrheit (Zurück führt zum vorigen Unter-Reiter); ohne läuft es lokal wie bisher.
  const [lokal, setLokal] = useState<Unter>(unterAus(start));
  const unter: Unter = onAnsicht ? unterAus(start) : lokal;
  const waehle = (u: Unter) => { setLokal(u); onAnsicht?.(u === 'uebersicht' ? '' : u); };
  useEffect(() => { if (start && UNTER.some(u => u.id === start)) setLokal(start as Unter); }, [start]);

  const [d, setD] = useState<Daten | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const laden = useCallback(async () => {
    setLadeFehler(null);
    try {
      const r = await fetch('/api/crm/stammdaten', { cache: 'no-store' });
      const x = await r.json().catch(() => null);
      if (x?.ok) setD(x); else setLadeFehler(x?.fehler ?? `Antwort ${r.status}.`);
    } catch { setLadeFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const post: StammdatenPost = async body => {
    setLaeuft(true);
    const r = await fetch('/api/crm/stammdaten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false); await laden(); void api.laden();
    return r;
  };
  if (!d) return <Karte i={0}><Laedt fehler={ladeFehler ?? api.fehler} nochEinmal={() => { void laden(); void api.laden(); }} /></Karte>;
  const offenePruefung = d.selbstpruefung.filter(p => p.status !== 'erfuellt').length;

  return (
    <>
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={UNTER} aktiv={unter} onWahl={waehle} /></div>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}

      {unter === 'uebersicht' && (
        <>
          <Karte i={0}>
            <Ueberschrift rechts={<Chip farbe={offenePruefung ? LEUCHT.achtung : LEUCHT.gut}>{d.selbstpruefung.length - offenePruefung} von {d.selbstpruefung.length} erfüllt</Chip>}>Selbstprüfung</Ueberschrift>
            <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 8 }}>Aus den echten Beständen gerechnet, nicht abgehakt. Keine Rechtsberatung.</div>
            <Liste>
              {d.selbstpruefung.map(p => (
                <Zeile key={p.id} links={<Punkt farbe={P_FARBE[p.status]} />} titel={p.titel} unter={`${p.befund} · ${p.norm}`}
                  rechts={p.status !== 'erfuellt' && (p.id === 'rechtsgrundlage' || p.id === 'herkunft' || p.id === 'art14' || p.id === 'antraege') ? <Knopf leise onClick={() => waehle('datenschutz')}>Beheben</Knopf> : <Chip farbe={P_FARBE[p.status]}>{p.status === 'erfuellt' ? 'erfüllt' : p.status}</Chip>} />
              ))}
            </Liste>
          </Karte>
          <Karte i={1}>
            <Ueberschrift>Was jetzt zu tun ist</Ueberschrift>
            <Befunde liste={d.befunde} zuBereich={(b, a) => (b === 'stammdaten' && a ? waehle(unterAus(a)) : zuBereich(b, a))} />
          </Karte>
          <Karte i={2}>
            <Ueberschrift>Bestand</Ueberschrift>
            <Raster min={140}>
              <Zahl wert={String(d.qualitaet.kontakte)} label="Personen" /><Zahl wert={String(d.qualitaet.firmen)} label="Firmen" />
              <Zahl wert={String(d.qualitaet.dublettenPersonen + d.qualitaet.dublettenFirmen)} label="Dubletten" farbe={d.qualitaet.dublettenPersonen + d.qualitaet.dublettenFirmen ? LEUCHT.achtung : undefined} />
              <Zahl wert={String(d.qualitaet.werbesperren.length)} label="Werbesperren" /><Zahl wert={d.kennzahlen.find(k => k.id === 'reife')?.anzeige ?? '—'} label="Datenreife" />
            </Raster>
          </Karte>
          <Verweise api={api} zuBereich={zuBereich} ab={3} />
        </>
      )}

      {unter === 'qualitaet' && (
        <>
          <Verbindungen i={0} onGeaendert={() => { void laden(); void api.laden(); }} />
          <Karte i={1}>
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
          <Karte i={2}>
            <Ueberschrift rechts={<Knopf leise aus={laeuft} onClick={async () => { const r = await post({ aktion: 'firmen-abgleich' }); setMeldung(r.ok ? `Firmen-Abgleich: ${r.neu} neu, ${r.verknuepft} Personen verknüpft, ${r.ergaenzt} ergänzt.` : `Abgleich fehlgeschlagen${r.fehler ? `: ${r.fehler}` : '.'}`); }}>Firmen abgleichen</Knopf>}>Firmen</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
              {d.qualitaet.firmen} Firmen · {d.qualitaet.ohneFirmenverweis} Personen mit Firmenname, aber ohne Verknüpfung · {d.qualitaet.dublettenFirmen} Firmen-Dubletten.
              Der Abgleich legt fehlende Firmen an, verknüpft Personen und füllt nur leere Felder — Gepflegtes bleibt.
            </div>
          </Karte>
          <Karte i={3}>
            <Ueberschrift>Dubletten</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>{d.qualitaet.dublettenPersonen} Personen-Paare (gleicher Name und ein zweites Merkmal). Zusammenführen in der Kartei, Ansicht „Dubletten“ — Verlauf, Einwilligungen und zweite Mailadresse bleiben erhalten, eine Sperre gilt weiter.</div>
            <div style={{ marginTop: 10 }}><Knopf leise onClick={() => zuBereich('kontakte', 'dubletten')}>Dubletten öffnen</Knopf></div>
          </Karte>
        </>
      )}

      {unter === 'wertelisten' && <Wertelisten w={d.wertelisten} post={post} laeuft={laeuft} zuBereich={zuBereich} />}

      {unter === 'datenschutz' && (
        <>
          <Karte i={0} akzent={d.pflichtangaben.anzahl ? LEUCHT.achtung : undefined}>
            <Ueberschrift rechts={d.pflichtangaben.anzahl ? <Knopf aus={laeuft} onClick={async () => { const r = await post({ aktion: 'pflichtangaben' }); setMeldung(r.ok ? `${r.gesetzt} Kontakte ergänzt.` : `Nicht übernommen${r.fehler ? `: ${r.fehler}` : '.'}`); }}>{d.pflichtangaben.anzahl} übernehmen</Knopf> : undefined}>Pflichtangaben</Ueberschrift>
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

      {unter === 'austausch' && <Austausch d={d} api={api} laeuft={laeuft} setLaeuft={setLaeuft} setMeldung={setMeldung} laden={() => void laden()} />}
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
  const { frage, dialog: nachfrage } = useNachfrage();
  const tage = (f: string) => Math.round((Date.parse(`${f}T12:00:00Z`) - Date.parse(`${d.heute}T12:00:00Z`)) / 864e5);
  const passend = (name: string) => (api.kontakte ?? []).find(k => `${k.vorname} ${k.nachname}`.trim().toLowerCase() === name.trim().toLowerCase());
  return (
    <Karte i={1}>
      <Ueberschrift rechts={!neu ? <Knopf leise onClick={() => setNeu({ art: 'auskunft', name: '', email: '', eingang: d.heute })}>+ Antrag</Knopf> : undefined}>Betroffenenrechte · {offen.length} offen</Ueberschrift>
      {neu && (
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Art</span><Wahl label="Art des Antrags" liste={ANTRAG_ART} wert={neu.art} onWahl={art => setNeu({ ...neu, art })} /></div>
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
                <Knopf onClick={async () => { const e = await frage('Ergebnis festhalten', { hinweis: 'z. B. „Auskunft am … per Mail übermittelt“ — steht im Nachweis.' }); if (e?.trim()) void setze({ ...a, status: 'erledigt', ergebnis: e.trim(), erledigtAm: d.heute }); }}>Erledigt</Knopf>
                {nachfrage}
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
