'use client';

// ─── Markttraktion · Bausteine einer Person ─────────────────────────────────
// Die Karteikarte (rechts in Kontakte) und die Kontaktakte (Vollansicht, 25.09.)
// zeigen dieselbe Person — mit denselben Bausteinen, damit beide gleich
// rechnen und gleich speichern: Hinweise (Werbesperre, Art. 14), nächster
// Schritt, Beziehung, Deals & Mandate, Entwurf, Verlauf, Recht und die Matrix
// aller Stammdaten (Felder aus lib/crm/akte.ts).

import { useEffect, useState, type ReactNode, type KeyboardEvent as TastenEreignis } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Punkt, feld, LEUCHT } from '../schlank';
import { WEG } from '@/lib/wege';
import { anzeigename, STUFE_LABEL, STUFEN, KREIS_TAKT, HERKUNFT, RECHTSGRUNDLAGEN, type Kontakt, type Kreis, type Lebensphase, type Einwilligung, type EinwilligungKanal, type Grundlage, type Stufe, type Herkunft, type Rechtsgrundlage, type AktivitaetArt, ROLLEN as KONTAKT_ROLLEN, ROLLE_LABEL, rollenVon, type Rolle } from '@/lib/make-one/crm';
import type { Firma } from '@/lib/crm/typen';
import { art14 } from '@/lib/crm/recht';
import { PERSON_FELDER, FIRMA_FELDER, FIRMA_FELDER_IMPORT, EINORDNUNG_FELDER, HERKUNFT_FELDER, gefuellt, vollstaendigkeit, type MatrixFeld } from '@/lib/crm/akte';
import { haeltBeziehung, BEIDE, TEAM, nameVon } from '@/lib/crm/team';
import { netzStufe, profilAdresse, suchLink } from '@/lib/crm/netzwerk';
import { markttraktion, mandateLink } from '@/lib/crm/adresse';
import Link from 'next/link';
import { type CrmApi, neueId, datum, euro } from './daten';
import { NotizFormular, Verlauf, Feldzeile, Pillen, Feld, festhalten, hatMailEinwilligung, MehrfachPillen } from './teile';
import { ZustaendigWahl, Uebergeben, Person } from './team';
import { neueFirma, ROLLEN } from './Firmen';

export const PHASEN: { id: Lebensphase; label: string }[] = [
  { id: 'kontakt', label: 'Kontakt' }, { id: 'interessent', label: 'Interessent' }, { id: 'kunde', label: 'Kunde' }, { id: 'ex_kunde', label: 'Ex-Kunde' }, { id: 'partner', label: 'Partner' }, { id: 'multiplikator', label: 'Multiplikator' },
];
const KREISE: { id: Kreis; label: string }[] = (['A', 'B', 'C', 'D'] as Kreis[]).map(k => ({ id: k, label: `${k} · ${KREIS_TAKT[k]} T` }));
const EW_KANAL: { id: EinwilligungKanal; label: string }[] = [{ id: 'mail', label: 'Mail' }, { id: 'telefon', label: 'Telefon' }, { id: 'social', label: 'LinkedIn/Social' }, { id: 'newsletter', label: 'Newsletter' }, { id: 'einladung', label: 'Einladungen' }];
const GRUNDLAGEN: { id: Grundlage; label: string }[] = [{ id: 'einwilligung', label: 'Einwilligung' }, { id: 'anfrage', label: 'Anfrage' }, { id: 'intro_akzeptiert', label: 'Intro akzeptiert' }, { id: 'vertrag', label: 'Vertrag' }];
export const phaseFarbe = (p?: string) => (p === 'kunde' ? LEUCHT.gut : p === 'partner' || p === 'multiplikator' ? LEUCHT.agenten : p === 'interessent' ? LEUCHT.business : p === 'ex_kunde' ? C.inkLeise : LEUCHT.puls);
export const phaseLabel = (p?: string) => PHASEN.find(x => x.id === p)?.label ?? 'Kontakt';

/** Einen Kontakt ändern — immer der ganze Eintrag mit den geänderten Feldern. */
export type Setze = (teil: Partial<Kontakt>) => Promise<void> | void;

/** Werbesperre und Art.-14-Frist — stehen über allem anderen. */
export function Hinweise({ k, heute, setze }: { k: Kontakt; heute: string; setze: Setze }) {
  const a14 = art14(k, heute);
  return (
    <>
      {k.werbesperre && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LEUCHT.kritisch}18`, color: LEUCHT.kritisch, fontSize: TYP.bedien }}>Werbesperre seit {datum(k.werbesperre.seit)} — {k.werbesperre.grund}. Kein Kanal, keine Liste, kein Agent.</div>}
      {a14 && <div style={{ padding: '10px 12px', borderRadius: 10, background: `${a14.faellig ? LEUCHT.kritisch : LEUCHT.achtung}14`, fontSize: TYP.bedien, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: a14.faellig ? LEUCHT.kritisch : LEUCHT.achtung }}>Art. 14: Daten stammen nicht von der Person — seit {a14.tage} Tagen nicht informiert (Frist ein Monat).</span>
        <Knopf leise onClick={() => void setze({ art14InformiertAm: heute })}>Informiert</Knopf>
      </div>}
    </>
  );
}

export function NaechsterSchrittTeil({ k, heute, setze }: { k: Kontakt; heute: string; setze: Setze }) {
  return (
    <div>
      <Ueberschrift rechts={k.naechsterSchritt ? <button onClick={() => void setze({ naechsterSchritt: undefined })} style={{ background: 'none', border: 'none', color: LEUCHT.gut, cursor: 'pointer', fontSize: 12 }}>✓ erledigt</button> : undefined}>Nächster Schritt</Ueberschrift>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><Feld wert={k.naechsterSchritt?.text} platzhalter="Was als Nächstes passiert" onFertig={text => void setze({ naechsterSchritt: text.trim() ? { text: text.trim(), datum: k.naechsterSchritt?.datum ?? heute } : undefined })} /></div>
        <Feld typ="date" wert={k.naechsterSchritt?.datum} breite={150} platzhalter="Datum" onFertig={d2 => k.naechsterSchritt && void setze({ naechsterSchritt: { ...k.naechsterSchritt, datum: d2 } })} />
      </div>
    </div>
  );
}

export function BeziehungTeil({ k, api, setze }: { k: Kontakt; api: CrmApi; setze: Setze }) {
  return (
    <div>
      <Ueberschrift>Beziehung</Ueberschrift>
      <Feldzeile label="Kreis"><Pillen liste={KREISE} aktiv={k.kreis} onWahl={kreis => void setze({ kreis: kreis === k.kreis ? undefined : kreis })} farbe={LEUCHT.beziehung} /></Feldzeile>
      <Feldzeile label="Phase"><Pillen liste={PHASEN} aktiv={k.lebensphase ?? 'kontakt'} onWahl={lebensphase => void setze({ lebensphase })} /></Feldzeile>
      <Feldzeile label="Rollen"><MehrfachPillen liste={KONTAKT_ROLLEN.map(r => ({ id: r, label: ROLLE_LABEL[r] }))} aktiv={rollenVon(k)} onWahl={(rollen: Rolle[]) => void setze({ rollen })} farbe={LEUCHT.business} /></Feldzeile>
      <Feldzeile label="Ansprache"><Pillen liste={STUFEN.map(s => ({ id: s, label: STUFE_LABEL[s] }))} aktiv={k.stufe} onWahl={(stufe: Stufe) => void setze({ stufe })} /></Feldzeile>
      <Feldzeile label="Anrede"><Pillen liste={[{ id: 'Sie', label: 'Sie' }, { id: 'Du', label: 'Du' }]} aktiv={k.anrede} onWahl={anrede => void setze({ anrede: anrede as 'Sie' | 'Du' })} /></Feldzeile>
      <Feldzeile label="Hält die Beziehung"><ZustaendigWahl wert={k.besitzer} welt="sales" onWahl={besitzer => void setze({ besitzer })} /></Feldzeile>
      <div style={{ marginTop: 8 }}><Uebergeben api={api} art="kontakt" id={k.id} jetzt={haeltBeziehung(k)} /></div>
    </div>
  );
}

/**
 * LinkedIn an der Person (25.09.): Profil, Stand je Profil (Kevin, Malin) und
 * der nächste Schritt für das eigene Profil — dieselben Schritte wie in der
 * Vernetzen-Runde (/api/crm/netzwerk). Versendet wird nichts.
 */
export function LinkedInTeil({ k, api }: { k: Kontakt; api: CrmApi }) {
  const ich = api.ich ?? 'kevin';
  const heute = api.crm?.heute ?? new Date().toISOString().slice(0, 10);
  const profil = profilAdresse(k.linkedin);
  const [url, setUrl] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { setUrl(''); setFehler(null); }, [k.id]);
  const tun = async (body: Record<string, unknown>) => { setFehler(null); const r = await api.netzwerk({ id: k.id, ...body }); if (!r.ok) setFehler(r.fehler ?? 'Nicht gespeichert.'); };
  const { stufe } = netzStufe(k, ich, heute);
  const zeile = (p: string) => {
    const s = k.netzwerk?.[p];
    const text = !s ? 'nicht vernetzt' : s.status === 'vernetzt' ? `vernetzt seit ${datum(s.vernetztAm)}${s.geschriebenAm ? ` · geschrieben ${datum(s.geschriebenAm)}` : ' · noch nicht geschrieben'}` : s.status === 'angefragt' ? `angefragt ${datum(s.angefragtAm)}` : s.status === 'abgelehnt' ? 'abgelehnt' : 'Anfrage zurückgezogen';
    return <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: s?.status === 'vernetzt' ? C.ink : C.inkDim, padding: '3px 0' }}><Person id={p} groesse={18} /><span>{nameVon(p)}: {text}</span></div>;
  };
  const leise = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: 0, fontFamily: SCHRIFT.text } as const;
  return (
    <div>
      <Ueberschrift rechts={<Link href={markttraktion('kontakte', 'runde-vernetzen')} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: 12 }}>Vernetzen-Runde ›</Link>}>LinkedIn</Ueberschrift>
      {profil ? <a href={profil} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: C.inkDim, textDecoration: 'none', overflowWrap: 'anywhere' }}>{profil.replace('https://www.', '')} ↗</a>
        : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href={suchLink(k)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: LEUCHT.business, textDecoration: 'none' }}>Auf LinkedIn suchen ↗</a>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Profiladresse einfügen" aria-label="LinkedIn-Profiladresse" onKeyDown={e => { if (e.key === 'Enter' && url.trim()) void tun({ aktion: 'profil', url }); }} style={{ ...feld, flex: 1, minWidth: 160, fontSize: TYP.bedien, padding: '7px 10px' }} />
          {url.trim() && <Knopf leise onClick={() => void tun({ aktion: 'profil', url })}>Speichern</Knopf>}
        </div>}
      <div style={{ marginTop: 6 }}>{TEAM.map(t => zeile(t.id))}</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        {stufe === 'anfragen' && <><button onClick={() => void tun({ aktion: 'angefragt' })} style={leise}>Meine Anfrage ist raus ✓</button><button onClick={() => void tun({ aktion: 'vernetzt' })} style={leise}>Bin schon vernetzt</button></>}
        {(stufe === 'warten' || stufe === 'zurueckziehen') && <><button onClick={() => void tun({ aktion: 'vernetzt' })} style={leise}>Wurde angenommen ✓</button><button onClick={() => void tun({ aktion: 'zurueckgezogen' })} style={leise}>Zurückgezogen</button></>}
        {stufe === 'schreiben' && <Link href={markttraktion('kontakte', 'runde-vernetzen')} style={{ ...leise, color: LEUCHT.gut, textDecoration: 'none' }}>Angenommen — in der Runde schreiben ›</Link>}
      </div>
      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch, marginTop: 4 }}>{fehler}</div>}
    </div>
  );
}

export function DealsTeil({ k, api }: { k: Kontakt; api: CrmApi }) {
  const crm = api.crm;
  const firma = k.firmaId ? crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const chancen = (crm?.stand.chancen ?? []).filter(c => c.kontaktIds.includes(k.id));
  const mandate = (crm?.stand.mandate ?? []).filter(m => m.kontaktIds.includes(k.id));
  const neuerDeal = () => void api.setze('chancen', { id: neueId('ch'), titel: firma?.name ?? k.firma ?? anzeigename(k), kontaktIds: [k.id], ...(firma || k.firma ? { firma: firma?.name ?? k.firma } : {}), art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: {}, gesellschaft: 'offen', besitzer: haeltBeziehung(k) === BEIDE ? api.ich ?? 'kevin' : haeltBeziehung(k), angelegt: new Date().toISOString() });
  return (
    <div>
      <Ueberschrift rechts={<Knopf leise onClick={neuerDeal}>+ Deal</Knopf>}>Deals & Mandate</Ueberschrift>
      {chancen.map(c => <Link key={c.id} href={WEG.deal(c.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '5px 0', color: C.ink, textDecoration: 'none' }}><Punkt farbe={crm?.ampel[c.id]?.ampel === 'rot' ? LEUCHT.kritisch : crm?.ampel[c.id]?.ampel === 'gelb' ? LEUCHT.achtung : LEUCHT.gut} groesse={7} /> <b style={{ fontWeight: 600 }}>{c.titel}</b> <span style={{ color: C.inkLeise }}>· {crm?.stufen.find(s => s.id === c.stufe)?.label} · {c.wert.betrag ? euro(c.wert.betrag) + (c.wert.basis === 'monat' ? '/Monat' : '') : 'ohne Wert'} ›</span></Link>)}
      {mandate.map(m => <Link key={m.id} href={mandateLink('mandate', m.id)} style={{ display: 'block', fontSize: TYP.bedien, padding: '5px 0', color: C.ink, textDecoration: 'none' }}><Punkt farbe={LEUCHT.geld} groesse={7} /> <b style={{ fontWeight: 600 }}>{m.titel.slice(0, 70)}</b> <span style={{ color: C.inkLeise }}>· Mandat {m.status} ›</span></Link>)}
      {!chancen.length && !mandate.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch kein Deal.</div>}
    </div>
  );
}

export function EntwurfTeil({ k, mailOk }: { k: Kontakt; mailOk: boolean }) {
  const [entwurf, setEntwurf] = useState<{ betreff: string; email: string; linkedin: string; hinweis: string } | 'laedt' | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { setEntwurf(null); setFehler(null); }, [k.id]);
  if (k.werbesperre) return null;
  const entwerfen = async () => {
    setEntwurf('laedt'); setFehler(null);
    const r = await fetch('/api/crm/entwurf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id }) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.error) { setFehler(r.error); setEntwurf(null); return; }
    setEntwurf(r);
  };
  return (
    <div>
      <Ueberschrift>Entwurf</Ueberschrift>
      {!entwurf && <Knopf leise onClick={entwerfen}>Jarvis entwerfen lassen</Knopf>}
      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch, marginTop: 6 }}>{fehler}</div>}
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
  );
}

/** Verlauf mit Gesprächsnotiz, schnellen Einträgen und Filter nach Art. */
export function VerlaufTeil({ k, api, name, heute, max = 60 }: { k: Kontakt; api: CrmApi; name: (p: string) => string; heute: string; max?: number }) {
  const [notiz, setNotiz] = useState(false);
  const [artFilter, setArtFilter] = useState<'alle' | AktivitaetArt>('alle');
  useEffect(() => { setNotiz(false); setArtFilter('alle'); }, [k.id]);
  const verlauf = (k.aktivitaeten ?? []).filter(a => artFilter === 'alle' || a.art === artFilter);
  const arten = Array.from(new Set((k.aktivitaeten ?? []).map(a => a.art)));
  const log = (art: string) => api.aktivitaet({ id: k.id, art });
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {!notiz && <Knopf onClick={() => setNotiz(true)}>+ Gesprächsnotiz</Knopf>}
        {[['anruf', 'Angerufen'], ['mail', 'Mail geschickt'], ['linkedin', 'LinkedIn'], ['antwort', 'Antwort erhalten'], ['termin', 'Termin']].map(([a, l]) => <Knopf key={a} leise onClick={() => void log(a)}>{l}</Knopf>)}
      </div>
      {notiz && <div style={{ marginBottom: 10 }}><NotizFormular heute={heute} anrede={k.anrede} einwilligung={!hatMailEinwilligung(k)} onAbbruch={() => setNotiz(false)} onFertig={x => { void festhalten(api, { id: k.id, art: 'gespraech', notiz: x.notiz, naechster: x.naechster }, x.einwilligung, heute); setNotiz(false); }} /></div>}
      {arten.length > 1 && <div style={{ marginBottom: 8 }}><Pillen liste={[{ id: 'alle', label: 'Alle' }, ...arten.map(a => ({ id: a, label: a }))] as { id: 'alle' | AktivitaetArt; label: string }[]} aktiv={artFilter} onWahl={setArtFilter} /></div>}
      <Verlauf liste={verlauf} name={name} heute={heute} max={max} />
      {verlauf.length > max && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Die jüngsten {max} von {verlauf.length} Einträgen.</div>}
    </div>
  );
}

/** Rechtsgrundlage, Herkunft (Art. 14), Einwilligungen, Werbewiderspruch, Auskunft und Löschung. */
export function RechtTeil({ k, api, heute, setze }: { k: Kontakt; api: CrmApi; heute: string; setze: Setze }) {
  const [ew, setEw] = useState<{ kanal: EinwilligungKanal; grundlage: Grundlage; nachweis: string } | null>(null);
  useEffect(() => { setEw(null); }, [k.id]);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div><Ueberschrift>Grundlage</Ueberschrift>
        <Feldzeile label="Rechtsgrundlage (Art. 6)"><Pillen liste={RECHTSGRUNDLAGEN.map(r => ({ id: r.id, label: r.label }))} aktiv={k.rechtsgrundlage} onWahl={(r: Rechtsgrundlage) => void setze({ rechtsgrundlage: r })} /></Feldzeile>
        <Feldzeile label="Herkunft (Art. 14)"><Pillen liste={HERKUNFT.map(h => ({ id: h.id, label: h.label }))} aktiv={k.herkunft} onWahl={(h: Herkunft) => void setze({ herkunft: h, ...(HERKUNFT.find(x => x.id === h)?.fremd ? { fremddaten: true } : { fremddaten: undefined }) })} /></Feldzeile>
        {k.fremddaten && <Feldzeile label="Informiert"><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12.5, color: C.inkDim }}>{k.art14InformiertAm ? `am ${datum(k.art14InformiertAm)}` : 'noch nicht'}</span>{!k.art14InformiertAm && <Knopf leise onClick={() => void setze({ art14InformiertAm: heute })}>Heute informiert</Knopf>}</div></Feldzeile>}
      </div>
      <div>
        <Ueberschrift rechts={!ew ? <Knopf leise onClick={() => setEw({ kanal: 'mail', grundlage: 'einwilligung', nachweis: '' })}>+ Einwilligung</Knopf> : undefined}>Einwilligungen</Ueberschrift>
        {(k.einwilligungen ?? []).map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, padding: '4px 0', color: e.widerrufenAm ? C.inkLeise : C.ink }}>
            <span>{EW_KANAL.find(x => x.id === e.kanal)?.label} · {GRUNDLAGEN.find(x => x.id === e.grundlage)?.label ?? e.grundlage} · {datum(e.erteiltAm)}{e.nachweis ? ` · „${e.nachweis.slice(0, 60)}“` : ''}{e.widerrufenAm ? ` · widerrufen ${datum(e.widerrufenAm)}` : ''}</span>
            {!e.widerrufenAm && <button onClick={() => void setze({ einwilligungen: (k.einwilligungen ?? []).map((x, j) => (j === i ? { ...x, widerrufenAm: heute } : x)) })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>Widerruf</button>}
          </div>
        ))}
        {!(k.einwilligungen ?? []).length && !ew && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Keine. Einwilligung im Gespräch einholen und den Wortlaut festhalten.</div>}
        {ew && (
          <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
            <Pillen liste={EW_KANAL} aktiv={ew.kanal} onWahl={kanal => setEw({ ...ew, kanal })} />
            <Pillen liste={GRUNDLAGEN} aktiv={ew.grundlage} onWahl={grundlage => setEw({ ...ew, grundlage })} />
            <input value={ew.nachweis} onChange={e => setEw({ ...ew, nachweis: e.target.value })} placeholder="Nachweis: Wortlaut oder Beleg („im Gespräch am …: Darf ich Ihnen … schicken? — ja“)" aria-label="Nachweis" style={{ ...feld, fontSize: TYP.bedien }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Knopf aus={!ew.nachweis.trim()} onClick={() => { const neu: Einwilligung = { kanal: ew.kanal, grundlage: ew.grundlage, erteiltAm: heute, nachweis: ew.nachweis.trim() }; void setze({ einwilligungen: [...(k.einwilligungen ?? []), neu], ...(ew.grundlage === 'einwilligung' && !k.rechtsgrundlage ? { rechtsgrundlage: 'einwilligung' as Rechtsgrundlage } : {}) }); setEw(null); }}>Festhalten</Knopf>
              <Knopf leise onClick={() => setEw(null)}>Abbrechen</Knopf>
            </div>
            <div style={{ fontSize: 12, color: C.inkLeise }}>Eine Visitenkarte ist keine Einwilligung. Newsletter nur per Double-Opt-in.</div>
          </div>
        )}
      </div>
      <div>
        <Ueberschrift>Werbewiderspruch (Art. 21)</Ueberschrift>
        {!k.werbesperre
          ? <Knopf leise onClick={() => { if (window.confirm('Werbewiderspruch eintragen? Die Person wird aus allen Listen genommen — dauerhaft.')) void setze({ werbesperre: { seit: heute, grund: 'Widerspruch' }, wiedervorlage: undefined, naechsterSchritt: undefined }); }}>Werbesperre eintragen</Knopf>
          : <Knopf leise onClick={() => { if (window.confirm('Sperre aufheben? Nur, wenn die Person ausdrücklich wieder eingewilligt hat.')) void setze({ werbesperre: undefined }); }}>Sperre aufheben (nur nach neuer Einwilligung)</Knopf>}
      </div>
      <div>
        <Ueberschrift>Betroffenenrechte</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise onClick={() => { window.location.href = `/api/crm/datenschutz?id=${k.id}`; }}>Auskunft (Art. 15) als Datei</Knopf>
          <Knopf leise onClick={async () => {
            if (!window.confirm(`${anzeigename(k)} endgültig löschen (Art. 17)? Besser oft: Werbesperre — dann bleibt „nicht anschreiben“ erhalten.`)) return;
            const grund = window.prompt('Grund (für das Löschprotokoll, ohne Personendaten)', 'Löschverlangen Art. 17') ?? '';
            const r = await fetch('/api/crm/datenschutz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, grund }) }).then(x => x.json()).catch(() => null);
            if (r?.ok) void api.laden(); else api.setFehler('Nicht gelöscht.');
          }}>Löschen (Art. 17)</Knopf>
        </div>
      </div>
    </div>
  );
}

/**
 * Eine Zeile der Matrix: Wert lesen, antippen zum Bearbeiten. Enter (bei
 * Fließtext Cmd/Strg+Enter) oder Verlassen speichert, Esc verwirft.
 * Profil und Webseite lassen sich öffnen (↗); Telefon und Mail nicht — die
 * laufen über die Kanal-Ampel (§ 7 UWG).
 */
/** Raster einer Matrix-Zeile — Textfelder, Auswahl und Firmenzuordnung stehen so bündig untereinander. */
function MatrixRahmen({ label, mittig, children }: { label: string; mittig?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(92px, 34%) minmax(0, 1fr)', gap: 12, alignItems: mittig ? 'center' : 'baseline', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.045)', minHeight: 34 }}>
      <span style={{ fontSize: 12.5, color: C.inkLeise }}>{label}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function MatrixZeile({ label, wert, lang, link, onFertig }: { label: string; wert?: string; lang?: boolean; link?: boolean; onFertig: (t: string) => void }) {
  const [an, setAn] = useState(false);
  const [t, setT] = useState(wert ?? '');
  useEffect(() => { if (!an) setT(wert ?? ''); }, [wert, an]);
  const fertig = () => { setAn(false); if (t.trim() !== (wert ?? '').trim()) onFertig(t.trim()); };
  const abbruch = () => { setAn(false); setT(wert ?? ''); };
  const leer = !gefuellt(wert);
  const href = link && !leer ? (/^https?:\/\//i.test(wert!) ? wert! : `https://${wert}`) : undefined;
  const taste = (e: TastenEreignis) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); abbruch(); }
    else if (e.key === 'Enter' && (!lang || e.metaKey || e.ctrlKey)) { e.preventDefault(); fertig(); }
  };
  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '7px 10px' };
  return (
    <MatrixRahmen label={label} mittig={an}>
      {an ? (lang
        ? <textarea autoFocus rows={3} value={t} aria-label={label} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={taste} style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} />
        : <input autoFocus value={t} aria-label={label} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={taste} style={eingabe} />)
        : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
            <button onClick={() => setAn(true)} title={leer ? `${label} ergänzen` : `${label} bearbeiten`}
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'text', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, lineHeight: 1.5, color: leer ? C.inkLeise : C.ink, whiteSpace: lang ? 'pre-wrap' : 'normal', overflowWrap: 'anywhere' }}>
              {leer ? '—' : wert}
            </button>
            {href && <a href={href} target="_blank" rel="noopener noreferrer" title={`${label} öffnen`} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: 12.5 }}>↗</a>}
          </div>
        )}
    </MatrixRahmen>
  );
}

function Gruppe({ titel, zahl, rechts, children }: { titel: string; zahl?: [number, number]; rechts?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Ueberschrift rechts={<>{rechts}{zahl && <span style={{ fontVariantNumeric: 'tabular-nums', color: zahl[0] === zahl[1] ? LEUCHT.gut : C.inkLeise }}>{zahl[0]}/{zahl[1]}</span>}</>}>{titel}</Ueberschrift>
      {children}
    </div>
  );
}

/**
 * Die Matrix: jedes Feld der Masterdatei für diese Person, gruppiert —
 * Person, Firma, Einordnung, Herkunft der Daten, dazu die private Notiz.
 * Gehört die Person zu einer Firma, bearbeitet die Firmengruppe den
 * Firmeneintrag (für alle ihre Personen); sonst die Firmenfelder aus dem Import.
 */
export function Matrix({ k, api, setze, zuFirma }: { k: Kontakt; api: CrmApi; setze: Setze; zuFirma: (id: string) => void }) {
  const crm = api.crm;
  const firmen = crm?.stand.firmen ?? [];
  const firma: Firma | undefined = k.firmaId ? firmen.find(f => f.id === k.firmaId) : undefined;
  const v = vollstaendigkeit(k, firma);
  const kf = (m: MatrixFeld<keyof Kontakt>) => <MatrixZeile key={m.feld} label={m.label} lang={m.lang} link={m.link} wert={String(k[m.feld] ?? '')} onFertig={t => void setze({ [m.feld]: (m.feld === 'email' ? t.toLowerCase() : t) || undefined } as Partial<Kontakt>)} />;
  const ff = (f: Firma, m: MatrixFeld<keyof Firma>) => <MatrixZeile key={m.feld} label={m.label} lang={m.lang} link={m.link} wert={String(f[m.feld] ?? '')} onFertig={t => void api.teil('firmen', f.id, { [m.feld]: t })} />;
  const firmaZuordnen = async (n: string) => {
    if (n === (firma?.name ?? k.firma ?? '')) return;
    if (!n) return void setze({ firma: undefined, firmaId: undefined });
    const f = firmen.find(x => x.name.toLowerCase() === n.toLowerCase()) ?? neueFirma(n);
    if (!firmen.some(x => x.id === f.id)) await api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>);
    void setze({ firma: f.name, firmaId: f.id });
  };
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Gruppe titel="Person" zahl={v.gruppen.person}>{PERSON_FELDER.map(kf)}</Gruppe>
      <Gruppe titel="Firma" zahl={v.gruppen.firma} rechts={firma ? <button onClick={() => zuFirma(firma.id)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>Firma öffnen ›</button> : undefined}>
        <MatrixRahmen label="Firma" mittig>
          <div>
            <input list="crm-firmen-matrix" defaultValue={firma?.name ?? k.firma ?? ''} key={`${k.id}-${firma?.id ?? ''}`} aria-label="Firma" placeholder="Firma zuordnen …"
              onBlur={e => void firmaZuordnen(e.target.value.trim())} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px' }} />
            <datalist id="crm-firmen-matrix">{firmen.slice(0, 400).map(f => <option key={f.id} value={f.name} />)}</datalist>
          </div>
        </MatrixRahmen>
        {firma && <MatrixRahmen label="Rolle"><span style={{ fontSize: TYP.bedien, color: ROLLEN.find(r => r.id === firma.rolle)?.farbe ?? C.inkDim }}>{ROLLEN.find(r => r.id === firma.rolle)?.label ?? firma.rolle}</span></MatrixRahmen>}
        {firma ? FIRMA_FELDER.map(m => ff(firma, m)) : FIRMA_FELDER_IMPORT.map(kf)}
        {firma && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Firmenfelder gelten für alle Personen dieser Firma.</div>}
      </Gruppe>
      <Gruppe titel="Einordnung" zahl={v.gruppen.einordnung}>
        <MatrixRahmen label="Prio" mittig><Pillen liste={[{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }, { id: '', label: '—' }]} aktiv={k.prio} onWahl={p => void setze({ prio: p as Kontakt['prio'] })} /></MatrixRahmen>
        <MatrixRahmen label="Eignung" mittig><Pillen liste={[{ id: 'ja', label: 'ja' }, { id: 'vielleicht', label: 'vielleicht' }, { id: 'nein', label: 'nein' }, { id: '', label: '—' }]} aktiv={k.eignung} onWahl={x => void setze({ eignung: x as Kontakt['eignung'] })} /></MatrixRahmen>
        {EINORDNUNG_FELDER.map(kf)}
      </Gruppe>
      <Gruppe titel="Herkunft der Daten">
        {HERKUNFT_FELDER.map(kf)}
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Importiert {datum(k.importiertAm)} · geändert {datum(k.geaendertAm)} · Kennung {k.id}</div>
      </Gruppe>
      <div><Ueberschrift rechts={<span>nur für dich sichtbar · nie an Agenten</span>}>Privat</Ueberschrift><MatrixRahmen label="Deine Notiz" mittig><Feld wert={k.privatNotiz} onFertig={privatNotiz => void setze({ privatNotiz: privatNotiz || undefined })} /></MatrixRahmen></div>
    </div>
  );
}
