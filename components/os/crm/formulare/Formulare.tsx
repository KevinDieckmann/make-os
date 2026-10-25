'use client';

// ─── Markttraktion › Formulare (25.10.2026) ─────────────────────────────────────────────────────────────────────────────────────────────
// Kevin 25.10.: „Wir brauchen ein Formular, wo die Vertriebler Kunden eintragen können, die ein Angebot brauchen … am besten unter Formulare unter
// Markttraktion.“ Eine Seite mit vier Karten: „Angebot anfordern“ (Kundensuche + Formular), „Eingänge“ (letzte Anfragen mit Status, Freigabe
// „Senden“ für Inhaber), „Externe Links“ (je Vertriebler, nur Inhaber) und „Einstellungen“ (Absender-Postfach, Mail-Vorlage, nur Inhaber).
// Alles kommt gefiltert vom Server (GET /api/crm/formulare): Eingänge sieht ein Inhaber alle, jede andere Person nur die eigenen; Links und Einstellungen
// nur Inhaber. Später gehören die Website-Formulare (z. B. Innovations-Check) ebenfalls hierher.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Chip, Feldzeile, Leerzustand, eingabe } from '../../ui';
import { Wahl } from '../Wahl';
import type { CrmApi } from '../daten';
import { AnfrageFormular, leereWerte, type AnfrageWerte, type AnfrageErgebnis } from './AnfrageFormular';
import { EINGANG_STATUS_LABEL, type EingangStatus, type KatalogProdukt, type LinkLage } from '@/lib/crm/formulare';
import { alleAdressen } from '@/lib/crm/emails';
import { WEG } from '@/lib/wege';

interface EingangSicht { id: string; am: string; quelle: 'intern' | 'link'; status: EingangStatus; vertriebler: string; firma?: string; nummer?: string; angebotId?: string; an?: string; gruende: string[]; vorschlagId?: string; versendet?: { am: string; ueber: string }; entschieden?: { am: string; art: string; von: string; grund?: string } }
interface LinkSicht { id: string; name: string; email?: string; vorsatz: string; produkte: string[]; bis?: string; lage: LinkLage; angelegt: string; zuletzt?: string; anzahl?: number; widerrufenAm?: string }
interface Daten {
  ok: boolean; istInhaber: boolean; katalog: KatalogProdukt[];
  einstellungen: { absender: { postfach: string; person: string; adresse?: string; eigenes: boolean } | null; absenderOk: boolean; absenderGrund?: string; betreff?: string; text?: string; platzhalter: string[]; standard: { betreff: string; text: string }; datenschutzFehlt: boolean };
  absenderWahl?: { id: string; name: string }[];
  links: LinkSicht[]; linksNurInhaber?: boolean; eingaenge: EingangSicht[];
}

const STATUS_FARBE: Record<EingangStatus, string> = { laeuft: C.inkDim, verschickt: LEUCHT.gut, freigabe: LEUCHT.achtung, abgelehnt: LEUCHT.kritisch };
const LAGE_FARBE: Record<LinkLage, string> = { aktiv: LEUCHT.gut, abgelaufen: C.inkLeise, widerrufen: LEUCHT.kritisch };
const zeitDe = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const NEU = '__neu';

async function post(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok?: boolean; fehler?: string }> {
  const r = await fetch('/api/crm/formulare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  if (!r) return { ok: false, fehler: 'Keine Verbindung.' };
  return await r.json().catch(() => ({ ok: false, fehler: `Fehler ${r.status}` }));
}

export function Formulare({ api }: { api: CrmApi }) {
  const [d, setD] = useState<Daten | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch('/api/crm/formulare?space=business', { cache: 'no-store' }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j?.ok) { setLadeFehler(j?.fehler ?? 'Formulare nicht geladen.'); return; }
    setLadeFehler(null); setD(j as Daten);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  if (ladeFehler) return <Hinweis art="kritisch" aktion={<Knopf leise onClick={laden}>Noch einmal</Knopf>}>{ladeFehler}</Hinweis>;
  if (!d) return <Karte i={0}><div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Formulare laden …</div></Karte>;
  return (
    <>
      <Karte i={0} id="anfordern"><AnfordernKarte api={api} d={d} nachher={() => { void laden(); void api.laden(true); }} /></Karte>
      <Karte i={1} id="eingaenge"><EingaengeKarte d={d} neu={laden} /></Karte>
      {d.istInhaber && <Karte i={2} id="links"><LinksKarte d={d} neu={laden} /></Karte>}
      {d.istInhaber && <Karte i={3} id="einstellungen"><EinstellungenKarte d={d} neu={laden} /></Karte>}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Später stehen hier auch die Formulare der Website (z. B. der Innovations-Check).</div>
    </>
  );
}

// ── Angebot anfordern ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function AnfordernKarte({ api, d, nachher }: { api: CrmApi; d: Daten; nachher: () => void }) {
  const [werte, setWerte] = useState<AnfrageWerte>(leereWerte());
  const [kunde, setKunde] = useState<string | null>(null);
  const [neuName, setNeuName] = useState('');
  const kontakte = useMemo(() => (api.kontakte ?? []).filter(k => !k.eingeschraenkt), [api.kontakte]);
  const firmen = api.crm?.stand.firmen ?? [];
  const gewaehlt = kunde && kunde !== NEU ? kontakte.find(k => k.id === kunde) : undefined;
  const liste = useMemo(() => [
    ...(kunde === NEU ? [{ id: NEU, label: `Neu: ${neuName}` }] : []),
    ...kontakte.map(k => ({ id: k.id, label: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim() + (k.firma ? ` · ${k.firma}` : '') })),
  ], [kontakte, kunde, neuName]);
  const waehlen = (id: string) => {
    const k = kontakte.find(x => x.id === id);
    if (!k) return;
    const f = k.firmaId ? firmen.find(x => x.id === k.firmaId) : undefined;
    setKunde(id);
    setWerte({ firma: { ...leereWerte().firma, name: f?.name ?? k.firma ?? '' }, person: { anrede: k.anrede === 'Du' ? 'Du' : 'Sie', vorname: k.vorname ?? '', nachname: k.nachname ?? '', email: alleAdressen(k)[0] ?? '', telefon: k.telefon ?? '' } });
  };
  const neuAnlegen = async (text: string): Promise<string> => {
    const [vorname, ...rest] = text.trim().split(/\s+/);
    setNeuName(text.trim()); setKunde(NEU);
    setWerte({ ...leereWerte(), person: { ...leereWerte().person, vorname: vorname ?? '', nachname: rest.join(' ') } });
    return NEU;
  };
  const senden = async (anfrage: Record<string, unknown>, anfrageId: string): Promise<AnfrageErgebnis> => {
    const k = gewaehlt;
    const r = await post({ aktion: 'anfordern', anfrageId, anfrage: { ...anfrage, ...(k ? { kontaktId: k.id, ...(k.firmaId && (anfrage.firma as { name: string }).name === (firmen.find(f => f.id === k.firmaId)?.name ?? '') ? { firmaId: k.firmaId } : {}) } : {}) } });
    nachher();
    return r as AnfrageErgebnis;
  };
  return (
    <>
      <Ueberschrift farbe={LEUCHT.gut}>Angebot anfordern</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 12, lineHeight: 1.5 }}>
        Kunde eintragen, Produkte wählen, absenden — das Angebot geht zu Listenpreisen automatisch raus. Mit Rabatt, eigenem Preis oder einer Sperre liegt es zur Freigabe bei den Inhabern.
        {!d.einstellungen.absenderOk && <> Noch kein Absender-Postfach gewählt — bis dahin liegt jedes Angebot zur Freigabe.</>}
      </div>
      <AnfrageFormular intern katalog={d.katalog} werte={werte} setWerte={setWerte} onSenden={senden}
        onNeu={() => { setKunde(null); setNeuName(''); setWerte(leereWerte()); }}
        {...(gewaehlt ? { festePerson: { emails: alleAdressen(gewaehlt) } } : {})}
        kunde={(
          <Feldzeile label="Kunde (suchen oder neu)" gruppe>
            <Wahl<string> label="Kunde" liste={liste} wert={kunde} onWahl={waehlen} onLeeren={() => { setKunde(null); setWerte(leereWerte()); }} leerenLabel="Auswahl lösen" onNeu={neuAnlegen} leer="+ Kunde suchen oder neu" />
          </Feldzeile>
        )} />
    </>
  );
}

// ── Eingänge ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function EingaengeKarte({ d, neu }: { d: Daten; neu: () => void }) {
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch'; text: string } | null>(null);
  const entscheiden = async (e: EingangSicht, ablehnen: boolean) => {
    if (!e.vorschlagId) return;
    const r = await fetch('/api/zoe/stapel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: e.vorschlagId, ...(ablehnen ? { entscheidung: 'ablehnen' } : {}) }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMeldung(r?.ok && j.ok ? { art: 'gut', text: ablehnen ? 'Abgelehnt — der Entwurf bleibt im Angebots-Tool.' : String(j.ergebnis ?? 'Verschickt.') } : { art: 'kritisch', text: String(j.error ?? j.fehler ?? 'Nicht entschieden.') });
    neu();
  };
  return (
    <>
      <Ueberschrift>Eingänge</Ueberschrift>
      {meldung && <Hinweis art={meldung.art} rolle="status" aktion={<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf>}>{meldung.text}</Hinweis>}
      {d.eingaenge.length === 0 ? (
        <Leerzustand symbol="✉" titel="Noch keine Anfragen">Sobald jemand ein Angebot anfordert, steht es hier — mit Status und Link zum Angebot.</Leerzustand>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {d.eingaenge.map(e => (
            <div key={e.id} data-eingang={e.id} style={{ display: 'grid', gap: 4, padding: '10px 0', borderTop: `1px solid ${C.linie}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip farbe={STATUS_FARBE[e.status]}>{EINGANG_STATUS_LABEL[e.status]}</Chip>
                <b style={{ fontSize: TYP.body }}>{e.firma || 'Kunde'}</b>
                {e.nummer && e.angebotId && <Link href={WEG.angebot({ angebotId: e.angebotId })} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Angebot {e.nummer} ›</Link>}
                {!e.nummer && e.angebotId && <Link href={WEG.angebot({ angebotId: e.angebotId })} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Entwurf öffnen ›</Link>}
              </div>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{[zeitDe(e.am), e.vertriebler, e.an ? `an ${e.an}` : '', e.versendet ? `verschickt ${zeitDe(e.versendet.am)} über ${e.versendet.ueber}` : '', e.entschieden?.art === 'abgelehnt' ? `abgelehnt von ${e.entschieden.von}${e.entschieden.grund ? ` — ${e.entschieden.grund}` : ''}` : ''].filter(Boolean).join(' · ')}</div>
              {e.status !== 'verschickt' && e.gruende.length > 0 && <ul style={{ margin: 0, paddingLeft: 18, fontSize: TYP.bedien, color: C.inkDim }}>{e.gruende.map(g => <li key={g}>{g}</li>)}</ul>}
              {e.status === 'freigabe' && d.istInhaber && e.vorschlagId && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Knopf farbe={LEUCHT.gut} onClick={() => entscheiden(e, false)}>Senden</Knopf>
                  <Knopf leise onClick={() => entscheiden(e, true)}>Ablehnen</Knopf>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Externe Links ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function LinksKarte({ d, neu }: { d: Daten; neu: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bis, setBis] = useState('');
  const [produkte, setProdukte] = useState<string[]>([]);
  const [frisch, setFrisch] = useState<{ name: string; url: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const zeigen = (n: string, pfad: unknown) => { if (typeof pfad === 'string') setFrisch({ name: n, url: `${window.location.origin}${pfad}` }); };
  const anlegen = async () => {
    setFehler(null);
    const r = await post({ aktion: 'link-neu', name, ...(email.trim() ? { email: email.trim() } : {}), ...(bis ? { bis } : {}), produkte });
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht angelegt.'); return; }
    zeigen(name, r.pfad); setName(''); setEmail(''); setBis(''); setProdukte([]); neu();
  };
  const aktion = async (l: LinkSicht, a: 'widerrufen' | 'erneuern' | 'entfernen') => {
    const r = await post({ aktion: `link-${a}`, id: l.id });
    if (!r.ok) { setFehler(r.fehler ?? 'Nicht gespeichert.'); return; }
    if (a === 'erneuern') zeigen(l.name, r.pfad);
    neu();
  };
  const kopieren = async () => { if (frisch) { try { await navigator.clipboard.writeText(frisch.url); } catch { /* Text bleibt sichtbar */ } } };
  const name2 = (id: string) => d.katalog.find(p => p.id === id)?.name ?? 'Produkt';
  return (
    <>
      <Ueberschrift>Externe Links</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10, lineHeight: 1.5 }}>Je Vertriebler ein eigener Link — er sieht nur die freigegebenen Produkte und nie Kundendaten. Der Link wird nur einmal gezeigt (gespeichert ist sein Fingerabdruck); später gibt es „Neuer Link“.</div>
      {frisch && (
        <Hinweis art="gut" rolle="status" titel={`Link für ${frisch.name}`} aktion={<><Knopf onClick={kopieren}>Link kopieren</Knopf> <Knopf leise onClick={() => setFrisch(null)}>Fertig</Knopf></>}>
          <code style={{ fontSize: TYP.bedien, overflowWrap: 'anywhere' }}>{frisch.url}</code>
        </Hinweis>
      )}
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      {d.links.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {d.links.map(l => (
            <div key={l.id} data-link={l.id} style={{ display: 'grid', gap: 4, padding: '10px 0', borderTop: `1px solid ${C.linie}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip farbe={LAGE_FARBE[l.lage]}>{l.lage}</Chip><b style={{ fontSize: TYP.body }}>{l.name}</b>{l.email && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{l.email}</span>}
              </div>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{[l.produkte.map(name2).join(', '), l.bis ? `gilt bis ${l.bis.slice(8, 10)}.${l.bis.slice(5, 7)}.${l.bis.slice(0, 4)}` : 'unbefristet', l.anzahl ? `${l.anzahl} Anfrage${l.anzahl === 1 ? '' : 'n'}` : ''].filter(Boolean).join(' · ')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {l.lage === 'aktiv' && <Knopf leise onClick={() => aktion(l, 'erneuern')}>Neuer Link</Knopf>}
                {l.lage === 'aktiv' && <Knopf leise onClick={() => aktion(l, 'widerrufen')}>Widerrufen</Knopf>}
                {l.lage !== 'aktiv' && <Knopf leise onClick={() => aktion(l, 'entfernen')}>Entfernen</Knopf>}
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={e => { e.preventDefault(); void anlegen(); }} style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Feldzeile label="Name des Vertrieblers"><input value={name} onChange={e => setName(e.target.value)} style={eingabe} required /></Feldzeile>
          <Feldzeile label="Adresse (optional)"><input value={email} onChange={e => setEmail(e.target.value)} style={eingabe} type="email" inputMode="email" /></Feldzeile>
          <Feldzeile label="Gilt bis (optional)"><input value={bis} onChange={e => setBis(e.target.value)} style={eingabe} type="date" /></Feldzeile>
        </div>
        <Feldzeile label="Erlaubte Produkte" gruppe>
          <div style={{ display: 'grid', gap: 4 }}>
            {d.katalog.map(p => (
              <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: TYP.body }}>
                <input type="checkbox" checked={produkte.includes(p.id)} onChange={() => setProdukte(x => (x.includes(p.id) ? x.filter(y => y !== p.id) : [...x, p.id]))} style={{ width: 20, height: 20 }} />{p.name}
              </label>
            ))}
          </div>
        </Feldzeile>
        <Knopf typ="submit" aus={!name.trim() || !produkte.length}>Link anlegen</Knopf>
      </form>
    </>
  );
}

// ── Einstellungen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function EinstellungenKarte({ d, neu }: { d: Daten; neu: () => void }) {
  const e = d.einstellungen;
  const anfang = e.absender?.eigenes ? e.absender.postfach : '';
  const [absender, setAbsender] = useState(anfang);
  const [betreff, setBetreff] = useState(e.betreff ?? '');
  const [text, setText] = useState(e.text ?? '');
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch'; text: string } | null>(null);
  const speichern = async () => {
    // Den Absender nur mitschicken, wenn er geändert wurde (der eines anderen Inhabers bleibt sonst stehen).
    const r = await post({ aktion: 'einstellungen', ...(absender !== anfang ? { absender: absender || null } : {}), betreff, text });
    setMeldung(r.ok ? { art: 'gut', text: 'Gespeichert.' } : { art: 'kritisch', text: r.fehler ?? 'Nicht gespeichert.' });
    if (r.ok) neu();
  };
  return (
    <>
      <Ueberschrift>Einstellungen</Ueberschrift>
      {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}
      {e.datenschutzFehlt && <Hinweis art="achtung" titel="Datenschutzhinweis unvollständig">Ohne Verantwortlichen und Kontaktweg geht nichts automatisch raus — <Link href={WEG.datenschutz('verantwortlicher')} style={{ color: C.aktiv }}>Einstellungen › Datenschutz</Link>.</Hinweis>}
      <form onSubmit={x => { x.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 10 }}>
        <Feldzeile label="Absender-Postfach (Antworten kommen hier an)">
          <select value={absender} onChange={x => setAbsender(x.target.value)} style={eingabe}>
            <option value="">— keins (alles zur Freigabe) —</option>
            {(d.absenderWahl ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Feldzeile>
        {e.absender && !e.absender.eigenes && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Gewählt von {e.absender.person}{e.absender.adresse ? ` (${e.absender.adresse})` : ''} — mit „Speichern“ wird dein eigenes Postfach der Absender.</div>}
        {!e.absenderOk && e.absenderGrund && <Hinweis art="achtung">{e.absenderGrund}</Hinweis>}
        {(d.absenderWahl ?? []).length === 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Kein eigenes Postfach im Business-Bereich — unter <Link href={WEG.inbox()} style={{ color: C.aktiv }}>Inbox</Link> verbinden und dem Business zuordnen.</div>}
        <Feldzeile label="Betreff (leer = Standard)"><input value={betreff} onChange={x => setBetreff(x.target.value)} placeholder={e.standard.betreff} style={eingabe} /></Feldzeile>
        <Feldzeile label="Text der Mail (leer = Standard)"><textarea value={text} onChange={x => setText(x.target.value)} placeholder={e.standard.text} rows={8} style={{ ...eingabe, minHeight: 180, resize: 'vertical' }} /></Feldzeile>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Platzhalter: {e.platzhalter.join(' ')} — der Datenschutzhinweis (Art. 13) steht immer darunter. Text nur aus dieser Vorlage, keine KI.</div>
        <Knopf typ="submit">Speichern</Knopf>
      </form>
    </>
  );
}
