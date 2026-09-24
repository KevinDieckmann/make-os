'use client';

// ─── CRM · Kartei — jede Person mit ihrer ganzen Geschichte ────────────────
// Links suchen und filtern, rechts die Karteikarte: Beziehung (Kreis, Phase,
// Anrede, wer hält sie), nächster Schritt, Gesprächsnotiz mit Vorlage,
// Verlauf, Kanal-Ampel mit Einwilligungen und Werbesperre, Chancen und
// Mandate, Entwurf. Quelle der Kartei ist die Masterdatei (CRM Leadordner) —
// das Adressbuch der Kontakte-App bleibt bewusst draußen (Kevin hat es am
// 27.08. aussortiert: 659 private Nummern gelöscht).

import { useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, feld, Spalten, Spalte, useBreit, LEUCHT } from '../schlank';
import { anzeigename, STUFE_LABEL, KREIS_TAKT, type Kontakt, type Kreis, type Lebensphase, type Einwilligung, type EinwilligungKanal, type Grundlage } from '@/lib/make-one/crm';
import { ampel as kanalAmpel, art14 } from '@/lib/crm/recht';
import { dubletten } from '@/lib/crm/dubletten';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { type CrmApi, neueId, datum, euro } from './daten';
import { KanalAmpel, Grund, NotizFormular, Verlauf, Feldzeile, Pillen, Feld } from './teile';

type Filter = 'alle' | 'kunden' | 'kreis' | 'chancen' | 'art14' | 'gesperrt' | 'dubletten';
const FILTER: { id: Filter; label: string }[] = [
  { id: 'alle', label: 'Alle' }, { id: 'kunden', label: 'Kunden' }, { id: 'kreis', label: 'Kreis A/B' }, { id: 'chancen', label: 'Mit Chance' }, { id: 'art14', label: 'Art. 14 fällig' }, { id: 'gesperrt', label: 'Gesperrt' }, { id: 'dubletten', label: 'Dubletten' },
];
const PHASEN: { id: Lebensphase; label: string }[] = [
  { id: 'kontakt', label: 'Kontakt' }, { id: 'interessent', label: 'Interessent' }, { id: 'kunde', label: 'Kunde' }, { id: 'ex_kunde', label: 'Ex-Kunde' }, { id: 'partner', label: 'Partner' }, { id: 'multiplikator', label: 'Multiplikator' },
];
const KREISE: { id: Kreis; label: string }[] = (['A', 'B', 'C', 'D'] as Kreis[]).map(k => ({ id: k, label: `${k} · ${KREIS_TAKT[k]} T` }));
const EW_KANAL: { id: EinwilligungKanal; label: string }[] = [{ id: 'mail', label: 'Mail' }, { id: 'telefon', label: 'Telefon' }, { id: 'social', label: 'LinkedIn/Social' }, { id: 'newsletter', label: 'Newsletter' }, { id: 'einladung', label: 'Einladungen' }];
const GRUNDLAGEN: { id: Grundlage; label: string }[] = [{ id: 'einwilligung', label: 'Einwilligung' }, { id: 'anfrage', label: 'Anfrage' }, { id: 'intro_akzeptiert', label: 'Intro akzeptiert' }, { id: 'vertrag', label: 'Vertrag' }];
const phaseFarbe = (p?: string) => (p === 'kunde' ? LEUCHT.gut : p === 'partner' || p === 'multiplikator' ? LEUCHT.agenten : p === 'interessent' ? LEUCHT.business : p === 'ex_kunde' ? C.inkLeise : LEUCHT.puls);

export function Kartei({ api, name, auswahl, setAuswahl }: { api: CrmApi; name: (p: string) => string; auswahl: string | null; setAuswahl: (id: string | null) => void }) {
  const breit = useBreit();
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState<Filter>('alle');
  const [mehr, setMehr] = useState(60);
  const kontakte = api.kontakte ?? [];
  const crm = api.crm;
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const mitChance = useMemo(() => new Set((crm?.stand.chancen ?? []).filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds)), [crm]);

  const paare = useMemo(() => (filter === 'dubletten' ? dubletten(kontakte) : []), [filter, kontakte]);
  const zusammen = async (behalten: string, weg: string) => {
    const r = await fetch('/api/crm/dubletten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ behalten, weg }) }).then(x => x.json()).catch(() => null);
    if (r?.ok) { await api.laden(); setAuswahl(behalten); } else api.setFehler(r?.fehler ?? 'Nicht zusammengeführt.');
  };
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let l = kontakte;
    if (filter === 'dubletten') { const ids = new Set(paare.flatMap(([a, b]) => [a.id, b.id])); l = l.filter(k => ids.has(k.id)); }
    if (filter === 'kunden') l = l.filter(k => k.lebensphase === 'kunde');
    if (filter === 'kreis') l = l.filter(k => k.kreis === 'A' || k.kreis === 'B');
    if (filter === 'chancen') l = l.filter(k => mitChance.has(k.id));
    if (filter === 'art14') l = l.filter(k => art14(k, heute)?.faellig);
    if (filter === 'gesperrt') l = l.filter(k => k.werbesperre);
    if (q) l = l.filter(k => [anzeigename(k), k.firma ?? '', k.email ?? '', k.firmaBranche ?? '', k.position ?? '', k.firmaStadt ?? ''].join(' ').toLowerCase().includes(q));
    const rang = (k: Kontakt) => (k.lebensphase === 'kunde' ? 0 : k.kreis === 'A' ? 1 : k.kreis === 'B' ? 2 : k.prio === 'A' ? 3 : k.prio === 'B' ? 4 : 5);
    return [...l].sort((a, b) => rang(a) - rang(b) || anzeigename(a).localeCompare(anzeigename(b)));
  }, [kontakte, suche, filter, mitChance, heute, paare]);

  const k = auswahl ? kontakte.find(x => x.id === auswahl) ?? null : null;
  const zeile = (x: Kontakt) => {
    const a14 = art14(x, heute);
    return (
      <div key={x.id}>
        <Zeile onClick={() => setAuswahl(auswahl === x.id ? null : x.id)} aktiv={auswahl === x.id}
          links={<Punkt farbe={x.werbesperre ? LEUCHT.kritisch : phaseFarbe(x.lebensphase)} />}
          titel={<>{anzeigename(x)}{x.firma && <span style={{ color: C.inkLeise }}> · {x.firma}</span>}</>}
          unter={[x.position ?? x.jobtitel, x.letzterKontakt ? `zuletzt ${datum(x.letzterKontakt, heute)}` : '', x.naechsterSchritt ? `→ ${x.naechsterSchritt.text}` : ''].filter(Boolean).join(' · ')}
          rechts={<span style={{ display: 'flex', gap: 6 }}>
            {a14?.faellig && <Chip farbe={LEUCHT.kritisch}>Art. 14</Chip>}
            {mitChance.has(x.id) && <Chip farbe={LEUCHT.business}>Chance</Chip>}
            {x.kreis && <Chip farbe={C.inkDim}>{x.kreis}</Chip>}
            {x.lebensphase && x.lebensphase !== 'kontakt' && <Chip farbe={phaseFarbe(x.lebensphase)}>{PHASEN.find(p => p.id === x.lebensphase)?.label}</Chip>}
          </span>} />
        {auswahl === x.id && !breit && <div style={{ padding: '8px 0 18px' }}><Karteikarte k={x} api={api} name={name} /></div>}
      </div>
    );
  };

  return (
    <Spalten verhaeltnis="3:2">
      <Spalte>
        <Karte i={0}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name, Firma, Branche, Ort …" aria-label="Kartei durchsuchen" style={{ ...feld, flex: 1 }} />
            <Knopf leise onClick={() => { const id = neueId('c-neu').replace(/[^a-z0-9-]/g, ''); void api.kontaktSetzen({ id, vorname: '', nachname: suche.trim() || 'Neuer Kontakt', eignung: '', prio: '', stufe: 'neu', lebensphase: 'kontakt', besitzer: 'kevin', aktivitaeten: [], importiertAm: heute, geaendertAm: heute }).then(() => setAuswahl(id)); }}>+ Person</Knopf>
          </div>
          <div style={{ marginBottom: 10 }}><Pillen liste={FILTER} aktiv={filter} onWahl={f => { setFilter(f); setMehr(60); }} /></div>
          <Ueberschrift>{treffer.length} von {kontakte.length} Personen</Ueberschrift>
          {filter === 'dubletten' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {paare.map(([a, b]) => (
                <div key={`${a.id}|${b.id}`} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 8 }}>
                  {[a, b].map(x => <div key={x.id} style={{ fontSize: TYP.bedien }}><b style={{ fontWeight: 600 }}>{anzeigename(x)}</b> <span style={{ color: C.inkLeise }}>· {x.email ?? 'ohne Mail'} · {x.firma ?? '—'} · {(x.aktivitaeten ?? []).length} Einträge</span></div>)}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Knopf leise onClick={() => zusammen(a.id, b.id)}>Erste behalten</Knopf>
                    <Knopf leise onClick={() => zusammen(b.id, a.id)}>Zweite behalten</Knopf>
                  </div>
                </div>
              ))}
              {!paare.length && <Leer>Keine Dubletten.</Leer>}
              <div style={{ fontSize: 12, color: C.inkLeise }}>Gleicher Name und ein zweites Merkmal (Firma, Domain, LinkedIn, Telefon). Beim Zusammenführen gehen Verlauf, Einwilligungen und die zweite Mailadresse nicht verloren; eine Sperre gilt weiter.</div>
            </div>
          ) : <Liste>{treffer.slice(0, mehr).map(zeile)}</Liste>}
          {treffer.length > mehr && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => setMehr(mehr + 100)}>Weitere {Math.min(100, treffer.length - mehr)} zeigen</Knopf></div>}
          {!treffer.length && <Leer>Niemand gefunden.</Leer>}
        </Karte>
      </Spalte>
      {breit && (
        <Spalte klebt>
          <Karte i={1} akzent={k ? phaseFarbe(k.lebensphase) : undefined}>
            {k ? <Karteikarte k={k} api={api} name={name} /> : <Leer>Eine Person anklicken — Verlauf, Notiz, Kanäle und Chancen erscheinen hier.</Leer>}
          </Karte>
        </Spalte>
      )}
    </Spalten>
  );
}

function Karteikarte({ k, api, name }: { k: Kontakt; api: CrmApi; name: (p: string) => string }) {
  const crm = api.crm;
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const [notiz, setNotiz] = useState(false);
  const [ew, setEw] = useState<{ kanal: EinwilligungKanal; grundlage: Grundlage; nachweis: string } | null>(null);
  const [entwurf, setEntwurf] = useState<{ betreff: string; email: string; linkedin: string; hinweis: string } | 'laedt' | null>(null);
  const [stamm, setStamm] = useState(false);
  const chancen = (crm?.stand.chancen ?? []).filter(c => c.kontaktIds.includes(k.id));
  const mandate = (crm?.stand.mandate ?? []).filter(m => m.kontaktIds.includes(k.id));
  const ctx = { hatMandat: mandate.some(m => m.status === 'aktiv'), hatChance: chancen.some(c => OFFENE_STUFEN.includes(c.stufe)) };
  const ampel = kanalAmpel(k, ctx);
  const a14 = art14(k, heute);
  const setze = (teil: Partial<Kontakt>) => api.kontaktSetzen({ ...k, ...teil });
  const log = (art: string, extra: Record<string, unknown> = {}) => api.aktivitaet({ id: k.id, art, ...extra });

  const entwerfen = async () => {
    setEntwurf('laedt');
    const r = await fetch('/api/crm/entwurf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id }) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.error) { api.setFehler(r.error); setEntwurf(null); return; }
    setEntwurf(r);
  };
  const mailOk = ampel.some(s => s.kanal === 'mail' && s.farbe !== 'rot');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <div style={{ fontFamily: SCHRIFT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-.015em' }}>{anzeigename(k)}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>{[k.position ?? k.jobtitel, k.firma, k.firmaStadt].filter(Boolean).join(' · ') || '—'}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <Chip farbe={C.inkDim}>{STUFE_LABEL[k.stufe]}</Chip>{k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}{k.quelle && <Chip farbe={C.inkLeise}>{k.quelle.slice(0, 40)}</Chip>}
        </div>
      </div>
      {k.werbesperre && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LEUCHT.kritisch}18`, color: LEUCHT.kritisch, fontSize: TYP.bedien }}>Werbesperre seit {datum(k.werbesperre.seit)} — {k.werbesperre.grund}. Kein Kanal, keine Liste, kein Agent.</div>}
      {a14 && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${a14.faellig ? LEUCHT.kritisch : LEUCHT.achtung}14`, fontSize: TYP.bedien, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: a14.faellig ? LEUCHT.kritisch : LEUCHT.achtung }}>Art. 14: Daten stammen nicht von der Person — seit {a14.tage} Tagen nicht informiert (Frist 1 Monat).</span>
        <Knopf leise onClick={() => setze({ art14InformiertAm: heute })}>Informiert</Knopf>
      </div>}

      <div>
        <Ueberschrift>Kanäle</Ueberschrift>
        <KanalAmpel ampel={ampel} ziele={{ telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin }} />
        <Grund ampel={ampel} />
      </div>

      <div>
        <Ueberschrift>Beziehung</Ueberschrift>
        <Feldzeile label="Kreis"><Pillen liste={KREISE} aktiv={k.kreis} onWahl={kreis => setze({ kreis: kreis === k.kreis ? undefined : kreis })} farbe={LEUCHT.beziehung} /></Feldzeile>
        <Feldzeile label="Phase"><Pillen liste={PHASEN} aktiv={k.lebensphase ?? 'kontakt'} onWahl={lebensphase => setze({ lebensphase })} /></Feldzeile>
        <Feldzeile label="Anrede"><Pillen liste={[{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }]} aktiv={k.anrede} onWahl={anrede => setze({ anrede: anrede as 'Sie' | 'Du' })} /></Feldzeile>
        <Feldzeile label="Hält die Beziehung"><Pillen liste={[{ id: 'kevin', label: 'Kevin' }, { id: 'malin', label: 'Malin' }, { id: 'beide', label: 'Beide' }]} aktiv={k.besitzer} onWahl={besitzer => setze({ besitzer })} /></Feldzeile>
      </div>

      <div>
        <Ueberschrift rechts={k.naechsterSchritt ? <button onClick={() => setze({ naechsterSchritt: undefined })} style={{ background: 'none', border: 'none', color: LEUCHT.gut, cursor: 'pointer', fontSize: 12 }}>✓ erledigt</button> : undefined}>Nächster Schritt</Ueberschrift>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><Feld wert={k.naechsterSchritt?.text} platzhalter="Was als Nächstes passiert" onFertig={text => setze({ naechsterSchritt: text.trim() ? { text: text.trim(), datum: k.naechsterSchritt?.datum ?? heute } : undefined })} /></div>
          <Feld typ="date" wert={k.naechsterSchritt?.datum} breite={150} platzhalter="Datum" onFertig={d2 => k.naechsterSchritt && setze({ naechsterSchritt: { ...k.naechsterSchritt, datum: d2 } })} />
        </div>
      </div>

      <div>
        <Ueberschrift rechts={!notiz ? <Knopf leise onClick={() => setNotiz(true)}>+ Gesprächsnotiz</Knopf> : undefined}>Verlauf</Ueberschrift>
        {notiz && <div style={{ marginBottom: 10 }}><NotizFormular heute={heute} onAbbruch={() => setNotiz(false)} onFertig={x => { void log('gespraech', { notiz: x.notiz, naechster: x.naechster }); setNotiz(false); }} /></div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[['anruf', 'Angerufen'], ['mail', 'Mail geschickt'], ['linkedin', 'LinkedIn'], ['antwort', 'Antwort erhalten'], ['termin', 'Termin']].map(([a, l]) => <Knopf key={a} leise onClick={() => void log(a)}>{l}</Knopf>)}
        </div>
        <Verlauf liste={k.aktivitaeten ?? []} name={name} heute={heute} max={30} />
      </div>

      <div>
        <Ueberschrift rechts={<Knopf leise onClick={() => void api.setze('chancen', { id: neueId('ch'), titel: `${k.firma ?? anzeigename(k)} — Chance`, kontaktIds: [k.id], ...(k.firma ? { firma: k.firma } : {}), art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: {}, gesellschaft: 'offen', besitzer: k.besitzer && k.besitzer !== 'beide' ? k.besitzer : 'kevin', angelegt: new Date().toISOString() })}>+ Chance</Knopf>}>Chancen & Mandate</Ueberschrift>
        {chancen.map(c => <div key={c.id} style={{ fontSize: TYP.bedien, padding: '5px 0' }}><Punkt farbe={crm?.ampel[c.id]?.ampel === 'rot' ? LEUCHT.kritisch : crm?.ampel[c.id]?.ampel === 'gelb' ? LEUCHT.achtung : LEUCHT.gut} groesse={7} /> <b style={{ fontWeight: 600 }}>{c.titel}</b> <span style={{ color: C.inkLeise }}>· {crm?.stufen.find(s => s.id === c.stufe)?.label} · {c.wert.betrag ? euro(c.wert.betrag) + (c.wert.basis === 'monat' ? '/Monat' : '') : 'ohne Wert'}</span></div>)}
        {mandate.map(m => <div key={m.id} style={{ fontSize: TYP.bedien, padding: '5px 0' }}><Punkt farbe={LEUCHT.geld} groesse={7} /> <b style={{ fontWeight: 600 }}>{m.titel.slice(0, 70)}</b> <span style={{ color: C.inkLeise }}>· Mandat {m.status}</span></div>)}
        {!chancen.length && !mandate.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch keine Chance.</div>}
      </div>

      <div>
        <Ueberschrift rechts={!ew ? <Knopf leise onClick={() => setEw({ kanal: 'mail', grundlage: 'einwilligung', nachweis: '' })}>+ Grundlage</Knopf> : undefined}>Einwilligungen</Ueberschrift>
        {(k.einwilligungen ?? []).map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, padding: '4px 0', color: e.widerrufenAm ? C.inkLeise : C.ink }}>
            <span>{EW_KANAL.find(x => x.id === e.kanal)?.label} · {GRUNDLAGEN.find(x => x.id === e.grundlage)?.label ?? e.grundlage} · {datum(e.erteiltAm)}{e.nachweis ? ` · „${e.nachweis.slice(0, 60)}“` : ''}{e.widerrufenAm ? ` · widerrufen ${datum(e.widerrufenAm)}` : ''}</span>
            {!e.widerrufenAm && <button onClick={() => setze({ einwilligungen: (k.einwilligungen ?? []).map((x, j) => (j === i ? { ...x, widerrufenAm: heute } : x)) })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>Widerruf</button>}
          </div>
        ))}
        {ew && (
          <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
            <Pillen liste={EW_KANAL} aktiv={ew.kanal} onWahl={kanal => setEw({ ...ew, kanal })} />
            <Pillen liste={GRUNDLAGEN} aktiv={ew.grundlage} onWahl={grundlage => setEw({ ...ew, grundlage })} />
            <input value={ew.nachweis} onChange={e => setEw({ ...ew, nachweis: e.target.value })} placeholder="Nachweis: Wortlaut oder Beleg („im Gespräch am …: Darf ich Ihnen … schicken? — ja“)" aria-label="Nachweis" style={{ ...feld, fontSize: TYP.bedien }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Knopf aus={!ew.nachweis.trim()} onClick={() => { const neu: Einwilligung = { kanal: ew.kanal, grundlage: ew.grundlage, erteiltAm: heute, nachweis: ew.nachweis.trim() }; void setze({ einwilligungen: [...(k.einwilligungen ?? []), neu] }); setEw(null); }}>Festhalten</Knopf>
              <Knopf leise onClick={() => setEw(null)}>Abbrechen</Knopf>
            </div>
            <div style={{ fontSize: 12, color: C.inkLeise }}>Eine Visitenkarte ist keine Einwilligung. Newsletter nur per Double-Opt-in.</div>
          </div>
        )}
        {!k.werbesperre
          ? <div style={{ marginTop: 8 }}><button onClick={() => { if (window.confirm('Werbewiderspruch eintragen? Die Person wird aus allen Listen genommen.')) void setze({ werbesperre: { seit: heute, grund: 'Widerspruch' }, wiedervorlage: undefined, naechsterSchritt: undefined }); }} style={{ background: 'none', border: 'none', color: LEUCHT.kritisch, cursor: 'pointer', fontSize: 12, padding: 0 }}>Werbesperre eintragen</button></div>
          : <div style={{ marginTop: 8 }}><button onClick={() => { if (window.confirm('Sperre aufheben? Nur, wenn die Person ausdrücklich wieder eingewilligt hat.')) void setze({ werbesperre: undefined }); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>Sperre aufheben (nur nach neuer Einwilligung)</button></div>}
      </div>

      {!k.werbesperre && (
        <div>
          <Ueberschrift>Entwurf</Ueberschrift>
          {!entwurf && <Knopf leise onClick={entwerfen}>Jarvis entwerfen lassen</Knopf>}
          {entwurf === 'laedt' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Jarvis schreibt …</span>}
          {entwurf && entwurf !== 'laedt' && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>{entwurf.betreff}</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55 }}>{entwurf.email}</pre>
              {entwurf.linkedin && <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55, borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 8 }}>{entwurf.linkedin}</pre>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {mailOk && <Knopf onClick={() => fetch('/api/apple-mail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: k.email ?? '', subject: entwurf.betreff, body: entwurf.email }) })}>In Mail öffnen</Knopf>}
                <Knopf leise onClick={() => { try { void navigator.clipboard.writeText(entwurf.linkedin || entwurf.email); } catch { /* egal */ } }}>Text kopieren</Knopf>
                <Knopf leise onClick={() => setEntwurf(null)}>Verwerfen</Knopf>
              </div>
              <div style={{ fontSize: 12, color: C.inkLeise }}>{mailOk ? entwurf.hinweis : 'Mail ist für diese Person nicht freigegeben (Ampel) — den Text nur für ein persönliches Gespräch oder eine Vernetzungsanfrage ohne Werbung nutzen.'}</div>
            </div>
          )}
        </div>
      )}

      <div>
        <button onClick={() => setStamm(!stamm)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.inkDim, fontSize: TYP.bedien, fontWeight: 600 }}>{stamm ? '▾' : '▸'} Stammdaten</button>
        {stamm && (
          <div style={{ marginTop: 8 }}>
            <Feldzeile label="Vorname"><Feld wert={k.vorname} onFertig={vorname => setze({ vorname })} /></Feldzeile>
            <Feldzeile label="Nachname"><Feld wert={k.nachname} onFertig={nachname => setze({ nachname })} /></Feldzeile>
            <Feldzeile label="Firma"><Feld wert={k.firma} onFertig={firma => setze({ firma: firma || undefined })} /></Feldzeile>
            <Feldzeile label="Position"><Feld wert={k.position} onFertig={position => setze({ position: position || undefined })} /></Feldzeile>
            <Feldzeile label="E-Mail"><Feld wert={k.email} onFertig={email => setze({ email: email.toLowerCase() || undefined })} /></Feldzeile>
            <Feldzeile label="Telefon"><Feld wert={k.telefon} onFertig={telefon => setze({ telefon: telefon || undefined })} /></Feldzeile>
            <Feldzeile label="LinkedIn"><Feld wert={k.linkedin} onFertig={linkedin => setze({ linkedin: linkedin || undefined })} /></Feldzeile>
            <Feldzeile label="Aufhänger"><Feld wert={k.aufhaenger} onFertig={aufhaenger => setze({ aufhaenger: aufhaenger || undefined })} /></Feldzeile>
            <Feldzeile label="Vorgestellt durch"><Feld wert={k.vorgestelltDurch} onFertig={v => setze({ vorgestelltDurch: v || undefined })} /></Feldzeile>
            <Feldzeile label="Fremddaten"><Pillen liste={[{ id: 'nein', label: 'Von der Person selbst' }, { id: 'ja', label: 'Recherche/Liste' }]} aktiv={k.fremddaten ? 'ja' : 'nein'} onWahl={x => setze({ fremddaten: x === 'ja' ? true : undefined })} /></Feldzeile>
            <Feldzeile label="Privat (nie an Agenten)"><Feld wert={k.privatNotiz} onFertig={privatNotiz => setze({ privatNotiz: privatNotiz || undefined })} /></Feldzeile>
          </div>
        )}
      </div>
    </div>
  );
}
