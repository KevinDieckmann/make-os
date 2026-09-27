'use client';

// ─── Markttraktion · Marketing › Anfragen — der Eingang (27.09.) ─────────────────────
// Kevin (26.09.): Marketing hatte keinen Anfrage-Eingang. Hier wird eine Anfrage
// erfasst — Person (vorhanden oder neu), Kanal, Bezug (Beitrag, Kampagne, Event),
// Text, Datum — und daraus entsteht alles auf einmal (lib/crm/anfragen.ts, über
// POST /api/crm/anfrage): Person in der Kartei, Aktivität „Anfrage über …“,
// Einwilligung „Antwort auf Anfrage“, Wirkung am Beitrag, Follow-up „Anfrage
// beantworten“ (heute), Lead → kontaktiert. Darunter die Anfragen der letzten
// 30 Tage: offen oder beantwortet, mit Sprung zur Person, „Beantwortet“ über die
// Follow-up-Ebene und „Deal anlegen“ mit Quelle Anfrage/Content/Kampagne.
// MAKE OS versendet nichts — beantwortet wird im eigenen Postfach.

import { localDay } from '@/lib/zeit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Raster, Zahl, feld, LEUCHT } from '../../schlank';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import type { Quelle } from '@/lib/crm/typen';
import { ANFRAGE_KANAELE, GRENZEN, type AnfrageKanal, type AnfrageBezugArt, type AnfrageZeile } from '@/lib/crm/anfragen';
import { statusLabel } from '@/lib/crm/leads';
import { dealAkte } from '@/lib/crm/adresse';
import { type CrmApi, datum, holeMitStand } from '../daten';
import { Pillen, Feldzeile } from '../teile';
import { Wahl } from '../Wahl';
import { Person } from '../team';
import { PersonWahl, AlsNaechstes } from './gemeinsam';
import { DealAusQuelle } from './DealAusQuelle';

interface Daten { heute: string; liste: AnfrageZeile[]; offen: number }
type PersonWahlArt = 'vorhanden' | 'neu';
const BEZUEGE: { id: AnfrageBezugArt | 'keiner'; label: string }[] = [{ id: 'keiner', label: 'kein Bezug' }, { id: 'beitrag', label: 'Beitrag' }, { id: 'kampagne', label: 'Kampagne' }, { id: 'event', label: 'Event' }];
const KANAELE = ANFRAGE_KANAELE.map(k => ({ id: k.id, label: k.label }));
const leer = { vorname: '', nachname: '', email: '', firma: '', telefon: '' };
/** Quelle des Deals aus der Anfrage: über einen Beitrag → Content, über eine Kampagne → Kampagne, sonst Anfrage. */
const quelleAus = (z: AnfrageZeile): { quelle: Quelle; bezug?: string } => (z.bezug?.art === 'beitrag' ? { quelle: 'content', bezug: z.bezug.id } : z.bezug?.art === 'kampagne' ? { quelle: 'kampagne', bezug: z.bezug.id } : { quelle: 'inbound' });

export function Anfragen({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  const router = useRouter();
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const staende = useRef(new Map<string, string>());
  const laden = useCallback(() => holeMitStand<Daten & { ok?: boolean; fehler?: string }>('/api/crm/anfrage', staende.current).then(x => { if (x?.ok) { setD(x); setFehler(null); } else if (x && !x.ok) setFehler(x.fehler ?? 'Anfragen nicht geladen.'); }).catch(() => setFehler('Anfragen nicht erreichbar.')), []);
  useEffect(() => { void laden(); }, [laden, api.crm, api.kontakte]);
  const crm = api.crm;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const heute = crm?.heute ?? localDay();

  // Formular
  const [art, setArt] = useState<PersonWahlArt>('vorhanden');
  const [person, setPerson] = useState<Kontakt | null>(null);
  const [neu, setNeu] = useState(leer);
  const [kanal, setKanal] = useState<AnfrageKanal>('website');
  const [bezugArt, setBezugArt] = useState<AnfrageBezugArt | 'keiner'>('keiner');
  const [bezugId, setBezugId] = useState('');
  const [text, setText] = useState('');
  const [tag, setTag] = useState(heute);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; kontaktId?: string; fehler?: boolean } | null>(null);
  const [dealFuer, setDealFuer] = useState<string | null>(null);
  const [beantwortet, setBeantwortet] = useState<string | null>(null);
  useEffect(() => { setTag(heute); }, [heute]);

  const bezugListe = useMemo(() => {
    if (!crm) return [] as { id: string; label: string }[];
    if (bezugArt === 'beitrag') return [...crm.stand.beitraege].filter(b => b.status !== 'idee').sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? '')).slice(0, 40).map(b => ({ id: b.id, label: `${b.titel}${b.datum ? ` · ${datum(b.datum, heute)}` : ''}` }));
    if (bezugArt === 'kampagne') return [...crm.stand.kampagnen].filter(k => k.status === 'aktiv' || k.status === 'entwurf').sort((a, b) => b.geaendert.localeCompare(a.geaendert)).map(k => ({ id: k.id, label: k.name }));
    if (bezugArt === 'event') return [...crm.stand.events].filter(e => e.status !== 'abgesagt').sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 40).map(e => ({ id: e.id, label: `${e.titel} · ${datum(e.datum, heute)}` }));
    return [];
  }, [crm, bezugArt, heute]);
  const personOk = art === 'vorhanden' ? !!person : !!(neu.vorname.trim() || neu.nachname.trim() || neu.firma.trim() || neu.email.trim().includes('@'));
  const bereit = personOk && text.trim() && (bezugArt === 'keiner' || bezugId);

  const festhalten = async () => {
    if (!bereit || laeuft) return;
    setLaeuft(true); setMeldung(null);
    const body = {
      aktion: 'anlegen', kanal, text: text.trim(), datum: tag || undefined,
      ...(art === 'vorhanden' ? { kontaktId: person!.id } : { neu: { vorname: neu.vorname.trim(), nachname: neu.nachname.trim(), email: neu.email.trim(), firma: neu.firma.trim(), telefon: neu.telefon.trim() } }),
      ...(bezugArt !== 'keiner' && bezugId ? { bezug: { art: bezugArt, id: bezugId } } : {}),
    };
    const r = await fetch('/api/crm/anfrage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    if (!r.ok) { setMeldung({ text: r.fehler ?? 'Nicht festgehalten.', fehler: true }); return; }
    setMeldung({ text: `${r.text}${r.hinweis ? ` ${r.hinweis}` : ''}`, kontaktId: r.kontaktId });
    setPerson(null); setNeu(leer); setText(''); setBezugArt('keiner'); setBezugId('');
    await api.laden(); await laden();
  };
  const erledigen = async (z: AnfrageZeile) => {
    if (!z.followUp || z.followUp.status !== 'offen') return;
    setBeantwortet(z.id);
    const r = await fetch('/api/crm/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'erledigen', id: z.followUp.id }) }).then(x => x.json()).catch(() => ({ ok: false }));
    setBeantwortet(null);
    if (!r.ok) { setMeldung({ text: r.fehler ?? 'Nicht erledigt.', fehler: true }); return; }
    setMeldung({ text: `Anfrage von ${z.name} beantwortet — steht im Verlauf.`, kontaktId: z.kontaktId });
    await api.laden(); await laden();
  };

  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const liste = d?.liste ?? [];
  const offen = liste.filter(z => z.offen);

  return (
    <>
      <Karte i={0} akzent={offen.length ? LEUCHT.achtung : undefined}>
        <Ueberschrift rechts={<span style={{ fontSize: 12.5, color: C.inkLeise }}>Alles hier bleibt im System — geantwortet wird in deinem Postfach.</span>}>Anfrage erfassen</Ueberschrift>
        <div style={{ display: 'grid', gap: 6 }}>
          <Feldzeile label="Wer">
            <div style={{ display: 'grid', gap: 8 }}>
              <Pillen liste={[{ id: 'vorhanden', label: 'Person aus der Kartei' }, { id: 'neu', label: 'Neue Person' }]} aktiv={art} onWahl={a => { setArt(a); setPerson(null); }} />
              {art === 'vorhanden' ? (person
                ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien }}><span>{anzeigename(person)}{person.firma ? <span style={{ color: C.inkLeise }}> · {person.firma}</span> : null}</span><button onClick={() => setPerson(null)} aria-label="Person abwählen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button></div>
                : <PersonWahl kontakte={kontakte} onWahl={setPerson} platzhalter="Person suchen: Name, Firma, Mail …" />)
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: 6 }}>
                    <input value={neu.vorname} maxLength={GRENZEN.name} onChange={e => setNeu({ ...neu, vorname: e.target.value })} placeholder="Vorname" aria-label="Vorname" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
                    <input value={neu.nachname} maxLength={GRENZEN.name} onChange={e => setNeu({ ...neu, nachname: e.target.value })} placeholder="Nachname" aria-label="Nachname" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
                    <input value={neu.email} maxLength={GRENZEN.email} type="email" onChange={e => setNeu({ ...neu, email: e.target.value })} placeholder="E-Mail" aria-label="E-Mail" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
                    <input value={neu.firma} maxLength={GRENZEN.firma} onChange={e => setNeu({ ...neu, firma: e.target.value })} placeholder="Firma" aria-label="Firma" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
                    <input value={neu.telefon} maxLength={GRENZEN.telefon} onChange={e => setNeu({ ...neu, telefon: e.target.value })} placeholder="Telefon (optional)" aria-label="Telefon" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
                  </div>
                )}
            </div>
          </Feldzeile>
          <Feldzeile label="Kanal"><Wahl label="Kanal" liste={KANAELE} wert={kanal} onWahl={setKanal} /></Feldzeile>
          <Feldzeile label="Bezug">
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Wahl label="Bezug" liste={BEZUEGE} wert={bezugArt} onWahl={a => { if (a !== bezugArt) { setBezugArt(a); setBezugId(''); } }} />
              {bezugArt !== 'keiner' && (bezugListe.length
                ? <Wahl label={bezugArt === 'beitrag' ? 'Beitrag' : bezugArt === 'kampagne' ? 'Kampagne' : 'Event'} leer="+ wählen" liste={bezugListe.map(b => ({ id: b.id, label: b.label }))} wert={bezugId || null} onWahl={setBezugId} onLeeren={() => setBezugId('')} />
                : <span style={{ fontSize: 12.5, color: C.inkLeise }}>{bezugArt === 'beitrag' ? 'Noch kein Beitrag über das Ideen-Stadium hinaus.' : bezugArt === 'kampagne' ? 'Keine laufende Kampagne.' : 'Kein Event.'}</span>)}
              </span>
            </div>
          </Feldzeile>
          <Feldzeile label="Datum"><input type="date" value={tag} max={heute} onChange={e => setTag(e.target.value)} aria-label="Datum der Anfrage" style={{ ...feld, width: 170, fontSize: TYP.bedien, padding: '8px 11px' }} /></Feldzeile>
          <textarea value={text} rows={3} maxLength={GRENZEN.text} onChange={e => setText(e.target.value)} placeholder="Was wurde angefragt? In den Worten der Person." aria-label="Text der Anfrage" style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Knopf aus={!bereit || laeuft} onClick={() => void festhalten()}>{laeuft ? '…' : 'Anfrage festhalten'}</Knopf>
            <span style={{ fontSize: 12, color: C.inkLeise }}>Legt an: Person (falls neu), Verlauf, Einwilligung „Antwort auf Anfrage“, Wirkung am Beitrag, Follow-up „Anfrage beantworten“ heute, Lead → kontaktiert.</span>
          </div>
          {meldung && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: meldung.fehler ? LEUCHT.achtung : C.inkDim }}>
              <span>{meldung.text}</span>
              {meldung.kontaktId && <Knopf leise onClick={() => zuKontakt(meldung.kontaktId!)}>Zur Person</Knopf>}
            </div>
          )}
        </div>
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts={offen.length ? <Chip farbe={LEUCHT.achtung}>{offen.length} offen</Chip> : undefined}>Anfragen · 30 Tage</Ueberschrift>
        {liste.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <Raster min={120}>
              <Zahl wert={String(liste.length)} label="Anfragen" />
              <Zahl wert={String(offen.length)} label="offen" farbe={offen.length ? LEUCHT.achtung : LEUCHT.gut} />
              <Zahl wert={String(liste.filter(z => z.deal).length)} label="mit offenem Deal" farbe={LEUCHT.business} />
              <Zahl wert={String(new Set(liste.map(z => z.kanal)).size)} label="Kanäle" />
            </Raster>
          </div>
        )}
        {!d ? (fehler ? <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler} <Knopf leise onClick={() => void laden()}>Noch einmal</Knopf></div> : <Leer>Lädt …</Leer>) : liste.length ? (
          <Liste>
            {liste.map(z => {
              const q = quelleAus(z);
              return (
                <div key={z.id}>
                  <Zeile onClick={() => zuKontakt(z.kontaktId)} titel={<>{z.name}{z.firma ? <span style={{ color: C.inkLeise, fontWeight: 400 }}> · {z.firma}</span> : null}</>}
                    unter={`${z.kanal} · ${datum(z.am.slice(0, 10), heute)}${z.bezug ? ` · ${z.bezug.art === 'beitrag' ? 'Beitrag' : z.bezug.art === 'kampagne' ? 'Kampagne' : 'Event'} „${z.bezug.titel}“` : ''}${z.text ? ` · „${z.text.length > 90 ? `${z.text.slice(0, 89)}…` : z.text}“` : ''}`}
                    links={<Punkt farbe={z.offen ? LEUCHT.achtung : LEUCHT.gut} />}
                    rechts={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {z.leadStatus && <Chip farbe={C.inkDim}>Lead: {statusLabel(z.leadStatus)}</Chip>}
                      {z.deal ? <Chip farbe={LEUCHT.business}>Deal offen</Chip> : <Chip farbe={z.offen ? LEUCHT.achtung : LEUCHT.gut}>{z.offen ? 'offen' : 'beantwortet'}</Chip>}
                      <Person id={z.von} groesse={18} />
                    </span>} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0 10px' }} onClick={e => e.stopPropagation()}>
                    {z.offen && z.followUp && <Knopf leise aus={beantwortet === z.id} onClick={() => void erledigen(z)}>{beantwortet === z.id ? '…' : 'Beantwortet'}</Knopf>}
                    {z.deal ? <Knopf leise onClick={() => router.push(dealAkte(z.deal!.id))}>Zum Deal „{z.deal.titel.length > 30 ? `${z.deal.titel.slice(0, 29)}…` : z.deal.titel}“</Knopf>
                      : <Knopf leise onClick={() => setDealFuer(dealFuer === z.id ? null : z.id)}>{dealFuer === z.id ? 'Deal abbrechen' : 'Deal anlegen'}</Knopf>}
                  </div>
                  {dealFuer === z.id && !z.deal && (
                    <div style={{ marginBottom: 12 }}>
                      <DealAusQuelle api={api} kontaktId={z.kontaktId} quelle={q.quelle} quelleBezug={q.bezug} bezugTitel={z.bezug?.titel} onFertig={id => { setDealFuer(null); router.push(dealAkte(id)); }} onAbbruch={() => setDealFuer(null)} zuDeal={id => router.push(dealAkte(id))} />
                    </div>
                  )}
                </div>
              );
            })}
          </Liste>
        ) : <Leer>Noch keine Anfrage in den letzten 30 Tagen. Kommt eine — über die Webseite, per Mail, auf LinkedIn, aus einer Empfehlung oder nach einem Event — oben festhalten. Dann zählt sie im Trichter, steht als Follow-up an und der Lead beginnt.</Leer>}
        {liste.length > 0 && <div style={{ marginTop: 10 }}><AlsNaechstes>{offen.length ? `${offen.length} ${offen.length === 1 ? 'Anfrage wartet' : 'Anfragen warten'} auf Antwort — heute antworten, dann „Beantwortet“. Wird daraus ein Gespräch: „Deal anlegen“, die Quelle steht dann am Deal.` : 'Alles beantwortet. Aus einem echten Bedarf wird ein Deal — mit Quelle Anfrage, Content oder Kampagne.'}</AlsNaechstes></div>}
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>Als Anfrage zählt, was hier erfasst wurde (Aktivität „Anfrage über …“ im Verlauf) oder als Wirkung „Anfrage“ an einem Beitrag steht. „Offen“ heißt: das Follow-up „Anfrage beantworten“ der Person ist noch offen — es steht auch unter Follow-up.</div>
      </Karte>
    </>
  );
}
