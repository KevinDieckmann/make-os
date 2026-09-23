'use client';

// ─── MAKE OS — Kontakte ─────────────────────────────────────────────────────
// Das CRM, wie Kevin es am 18.09. wollte: „damit wir Kunden ansprechen
// können." Drei Segmente:
//   Heute     wer heute dran ist — fällige Wiedervorlagen, dann Prio A/B mit
//             Aufhänger und Kanal (Regel in lib/make-one/crm.ts)
//   Alle      suchen, Stufe sehen, Karte öffnen
//   Mandate   die laufenden Kunden (bestehende Ansicht, eingebettet)
// Ein Kontakt öffnet sich in der Liste: Aufhänger, Entwurf → in Mail, und die
// Griffe „angeschrieben / Antwort / Termin". Versendet wird hier nichts.

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { STUFE_LABEL, anzeigename, type Kontakt, type Stufe } from '@/lib/make-one/crm';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Segmente, Punkt, Chip, feld, LEUCHT } from './schlank';
import { CrmView } from './CrmView';

type Segment = 'heute' | 'alle' | 'mandate';
const SEG: { id: Segment; label: string }[] = [{ id: 'heute', label: 'Heute' }, { id: 'alle', label: 'Alle' }, { id: 'mandate', label: 'Mandate' }];
interface Posten { kontakt: Kontakt; grund: string; kanaele: { art: string; ziel: string }[] }
interface Entwurf { betreff: string; email: string; linkedin: string; hinweis: string }

const stufeFarbe = (s: Stufe) => (s === 'gewonnen' ? LEUCHT.gut : s === 'verloren' || s === 'ruht' ? C.inkLeise : s === 'neu' ? LEUCHT.puls : s === 'termin' || s === 'angebot' ? LEUCHT.achtung : LEUCHT.business);
const prioChip = (p?: string) => (p === 'A' ? LEUCHT.gut : p === 'B' ? LEUCHT.achtung : C.inkLeise);

export function KontakteView() {
  const router = useRouter(); const pfad = usePathname(); const params = useSearchParams();
  const segment = (SEG.find(s => s.id === params.get('s'))?.id ?? 'heute') as Segment;
  const [kontakte, setKontakte] = useState<Kontakt[] | null>(null);
  const [liste, setListe] = useState<Posten[]>([]);
  const [stand, setStand] = useState<{ gesamt: number; ansprechbar: number } | null>(null);
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Record<string, Entwurf | 'lädt' | undefined>>({});
  const [meldung, setMeldung] = useState('');
  const [importiert, setImportiert] = useState(false);

  const laden = () => {
    fetch('/api/state/kontakte').then(r => r.json()).then(d => { setKontakte(d.kontakte ?? []); setStand(d.stand ?? null); }).catch(() => setKontakte([]));
    fetch('/api/crm/ansprechen?n=12').then(r => r.json()).then(d => setListe(d.liste ?? [])).catch(() => {});
  };
  useEffect(() => { laden(); }, []);

  const importieren = async () => {
    setImportiert(true); setMeldung('Importiere …');
    const r = await fetch('/api/crm/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(r.error ? r.error : `${r.zeilen} Zeilen gelesen: ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert.`);
    setImportiert(false); laden();
  };
  const entwerfen = async (k: Kontakt) => {
    setEntwurf(e => ({ ...e, [k.id]: 'lädt' }));
    const r = await fetch('/api/crm/entwurf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id }) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.error) { setMeldung(r.error); setEntwurf(e => ({ ...e, [k.id]: undefined })); return; }
    setEntwurf(e => ({ ...e, [k.id]: r }));
  };
  const inMail = async (k: Kontakt, e: Entwurf) => {
    const r = await fetch('/api/apple-mail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: k.email ?? '', subject: e.betreff, body: e.email }) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(r.error ? r.error : 'Entwurf in Apple Mail geöffnet — Versand bleibt bei dir.');
  };
  const notieren = async (k: Kontakt, art: string) => {
    await fetch('/api/crm/aktivitaet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, art }) }).catch(() => {});
    setMeldung(`Notiert: ${anzeigename(k)} · ${art}.`); laden();
  };
  const stufeSetzen = async (k: Kontakt, stufe: Stufe) => {
    await fetch('/api/crm/aktivitaet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, art: 'stufe', stufe }) }).catch(() => {});
    laden();
  };
  const kopieren = (t: string) => { try { void navigator.clipboard.writeText(t); setMeldung('Kopiert.'); } catch { /* egal */ } };

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const alle = kontakte ?? [];
    const gefiltert = q ? alle.filter(k => [anzeigename(k), k.firma ?? '', k.email ?? '', k.firmaBranche ?? '', k.position ?? ''].join(' ').toLowerCase().includes(q)) : alle;
    return gefiltert.sort((a, b) => (a.prio || 'Z').localeCompare(b.prio || 'Z') || anzeigename(a).localeCompare(anzeigename(b))).slice(0, q ? 60 : 40);
  }, [kontakte, suche]);

  const Detail = ({ k, grund }: { k: Kontakt; grund?: string }) => {
    const e = entwurf[k.id];
    return (
      <div style={{ padding: '6px 2px 18px 36px', borderBottom: `1px solid ${C.linie}` }}>
        {grund && <div style={{ fontSize: 12, color: LEUCHT.achtung, marginBottom: 6 }}>{grund}</div>}
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
          {[k.position, k.firma, k.firmaStadt].filter(Boolean).join(' · ')}
          {k.email && <> · <a href={`mailto:${k.email}`} style={{ color: C.inkDim }}>{k.email}</a></>}
          {k.linkedin && <> · <a href={k.linkedin} target="_blank" rel="noreferrer" style={{ color: C.inkDim }}>LinkedIn</a></>}
          {k.telefon && <> · {k.telefon}</>}
        </div>
        {k.aufhaenger && <p style={{ margin: '10px 0 0', fontSize: TYP.body, color: C.ink }}><span style={{ color: C.inkLeise, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', marginRight: 8 }}>Aufhänger</span>{k.aufhaenger}</p>}
        {k.marktinfo && <p style={{ margin: '6px 0 0', fontSize: TYP.bedien, color: C.inkDim }}>{k.marktinfo}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
          {!e && <Knopf onClick={() => entwerfen(k)}>Entwurf</Knopf>}
          {e === 'lädt' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Jarvis schreibt …</span>}
          <Knopf leise onClick={() => notieren(k, 'linkedin')}>LinkedIn geschickt</Knopf>
          <Knopf leise onClick={() => notieren(k, 'mail')}>Mail geschickt</Knopf>
          <Knopf leise onClick={() => notieren(k, 'antwort')}>Antwort</Knopf>
          <Knopf leise onClick={() => notieren(k, 'termin')}>Termin</Knopf>
          <select value={k.stufe} onChange={ev => stufeSetzen(k, ev.target.value as Stufe)} style={{ marginLeft: 'auto', background: C.flaeche, border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px' }}>
            {(Object.keys(STUFE_LABEL) as Stufe[]).map(s => <option key={s} value={s}>{STUFE_LABEL[s]}</option>)}
          </select>
        </div>
        {e && e !== 'lädt' && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${C.linie}`, paddingTop: 12 }}>
            <div style={{ fontSize: TYP.body, fontWeight: 600, marginBottom: 6 }}>{e.betreff}</div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55 }}>{e.email}</pre>
            {e.linkedin && <><div style={{ fontSize: 12, color: C.inkLeise, margin: '12px 0 4px', textTransform: 'uppercase', letterSpacing: '.04em' }}>LinkedIn</div><pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55 }}>{e.linkedin}</pre></>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Knopf onClick={() => inMail(k, e)}>In Mail öffnen</Knopf>
              <Knopf leise onClick={() => kopieren(e.linkedin || e.email)}>LinkedIn-Text kopieren</Knopf>
              <Knopf leise onClick={() => setEntwurf(x => ({ ...x, [k.id]: undefined }))}>Verwerfen</Knopf>
            </div>
            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>{e.hinweis}</div>
          </div>
        )}
      </div>
    );
  };

  const zeile = (k: Kontakt, unter: string, rechts?: React.ReactNode) => (
    <Zeile key={k.id} onClick={() => setOffen(o => (o === k.id ? null : k.id))} aktiv={offen === k.id}
      links={<Punkt farbe={stufeFarbe(k.stufe)} />} titel={<>{anzeigename(k)}{k.firma && <span style={{ color: C.inkLeise }}> · {k.firma}</span>}</>} unter={unter}
      rechts={rechts ?? <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{k.prio && <Chip farbe={prioChip(k.prio)}>{k.prio}</Chip>}<Chip farbe={stufeFarbe(k.stufe)}>{STUFE_LABEL[k.stufe]}</Chip></span>} />
  );

  return (
    <Seite titel="Kontakte" rechts={<Segmente liste={SEG} aktiv={segment} onWahl={s => router.replace(s === 'heute' ? pfad : `${pfad}?s=${s}`)} />}>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 12 }}>{meldung}</div>}

      {segment === 'heute' && (
        kontakte !== null && kontakte.length === 0 ? (
          <Karte i={0}><Leer>
            Noch keine Kontakte im CRM. Die Masterliste liegt auf dem Schreibtisch (443 Kontakte, angereichert).
            <div style={{ marginTop: 12 }}><Knopf onClick={importieren} aus={importiert}>Masterliste importieren</Knopf></div>
          </Leer></Karte>
        ) : (
          <Karte i={0} akzent={LEUCHT.gut}>
            <Ueberschrift farbe={LEUCHT.gut} rechts={stand ? `${stand.ansprechbar} ansprechbar · ${stand.gesamt} gesamt` : ''}>Wer heute dran ist</Ueberschrift>
            <Liste>
              {liste.length === 0 && kontakte !== null && <Leer>Niemand fällig — alle Prio-A/B-Kontakte sind angesprochen oder ohne Aufhänger.</Leer>}
              {liste.map(p => (
                <div key={p.kontakt.id}>
                  {zeile(p.kontakt, `${p.grund} · ${p.kanaele.map(c => c.art).join(', ') || 'kein Kanal'}`)}
                  {offen === p.kontakt.id && <Detail k={p.kontakt} grund={p.grund} />}
                </div>
              ))}
            </Liste>
          </Karte>
        )
      )}

      {segment === 'alle' && (
        <Karte i={0}>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name, Firma, Branche, Ort …" style={{ ...feld, marginBottom: 12 }} />
          <Ueberschrift rechts={<span><button onClick={importieren} disabled={importiert} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: 0 }}>Masterliste abgleichen</button></span>}>
            {suche ? `${treffer.length} Treffer` : `Nach Priorität · ${kontakte?.length ?? 0} Kontakte`}
          </Ueberschrift>
          <Liste>
            {kontakte !== null && kontakte.length === 0 && <Leer>Noch keine Kontakte — oben „Masterliste abgleichen".</Leer>}
            {treffer.map(k => (
              <div key={k.id}>
                {zeile(k, [k.position, k.firmaBranche, k.wiedervorlage ? `Wiedervorlage ${k.wiedervorlage.slice(5)}` : ''].filter(Boolean).join(' · '))}
                {offen === k.id && <Detail k={k} />}
              </div>
            ))}
          </Liste>
        </Karte>
      )}

      {segment === 'mandate' && <Karte i={0}><CrmView eingebettet /></Karte>}
    </Seite>
  );
}
