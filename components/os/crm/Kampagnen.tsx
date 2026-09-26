'use client';

// ─── Markttraktion · Kampagnen (in Sales und Marketing) — nach bewährtem Vorgehen, auf Basis der Kunden ─
// Kevin: „immer wieder auf Best Practice zurückgreifen und neue Kampagnen
// planen können auf Basis der Kunden, die wir haben — vom Head of Marketing
// genauso wie vom Head of Sales.“ Oben: wer unsere Kunden sind und welche
// Firmen ihnen ähneln. Dann die Playbooks mit der Zielgruppe von heute. Eine
// Kampagne hat Schritte (→ Aufgaben) und Ergebnisse je Person (→ Verlauf,
// bei „Chance“ → Pipeline). Versendet wird nichts.
// Zu zweit (25.09.): Je Kampagne ist jemand zuständig (wer plant; ohne
// Eintrag Kevin als Sales-Verantwortung) — Filter „Alle · Meins · Malin“,
// Plakette, Übergeben. Ergebnisse halten fest, wer angesprochen hat („von“);
// Schritt-Aufgaben gehen an die Zuständigkeit. Änderungen als Einzelfelder.

import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { useLinkAuswahl } from '../Verlauf';
import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Raster, Zahl, LEUCHT } from '../schlank';
import { anzeigename } from '@/lib/make-one/crm';
import { kanalStatus } from '@/lib/crm/recht';
import type { Kampagne, KampagnenErgebnis } from '@/lib/crm/typen';
import type { Playbook, KampagnenZahlen } from '@/lib/crm/kampagnen';
import { werZahlen, bearbeiterFuer, kampagneJePerson } from '@/lib/crm/pipeline';
import { zustaendig, nameVon, BEIDE } from '@/lib/crm/team';
import { type CrmApi, datum, euro, plusTage } from './daten';
import { Pillen, Feld, Feldzeile, AMPEL_FARBE } from './teile';
import { Person, ZustaendigWahl, Uebergeben, WerFilter, useWerFilter, passtWer } from './team';
import { HeadPanel } from './HeadPanel';
import { VernetzenEinstellungen } from './Vernetzen';

interface Daten {
  heute: string; playbooks: (Playbook & { anzahl: number })[];
  profil: { kunden: { id: string; name: string; branche?: string; stadt?: string }[]; branchen: string[]; staedte: string[]; groesse: { min: number; max: number } | null; mrrJeKunde: { kunde: string; mrr: number; health: number | null }[] };
  aehnliche: { id: string; name: string; branche?: string; stadt?: string; punkte: number; gruende: string[]; personen: { id: string; name: string }[] }[];
  zahlen: Record<string, KampagnenZahlen>;
}
const STATUS: { id: Kampagne['status']; label: string }[] = [{ id: 'entwurf', label: 'Entwurf' }, { id: 'aktiv', label: 'Aktiv' }, { id: 'abgeschlossen', label: 'Abgeschlossen' }, { id: 'abgebrochen', label: 'Abgebrochen' }];
const ERGEBNISSE: { id: KampagnenErgebnis; label: string; farbe: string }[] = [
  { id: 'angesprochen', label: 'angesprochen', farbe: LEUCHT.puls }, { id: 'reagiert', label: 'reagiert', farbe: LEUCHT.achtung }, { id: 'gespraech', label: 'Gespräch', farbe: LEUCHT.gut },
  { id: 'chance', label: 'Interesse → Lead', farbe: LEUCHT.business }, { id: 'kein_interesse', label: 'kein Interesse', farbe: C.inkLeise },
];
const KANAL_LABEL: Record<string, string> = { persoenlich: 'persönlich', telefon: 'Telefon', mail: 'Mail', linkedin: 'LinkedIn', event: 'Event', mix: 'gemischt' };
/** Einzeländerung: nur diese Felder; „undefined“ heißt leeren (als '' gesendet — der Server lässt das Feld dann weg). */
const nurFelder = (t: Record<string, unknown>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v === undefined ? '' : v]));

/** Kampagnen planen beide Heads (Kevin, 25.09.): in Sales mit dem Head of Sales, in Marketing mit dem Head of Marketing — dieselben Kampagnen. */
export function Kampagnen({ api, zuKontakt, head = 'marketing' }: { api: CrmApi; zuKontakt: (id: string) => void; head?: 'sales' | 'marketing' }) {
  const [d, setD] = useState<Daten | null>(null);
  // Offene Kampagne im Link (k): Zurück schließt sie wieder.
  const [offen, setOffen] = useLinkAuswahl();
  const [meldung, setMeldung] = useState('');
  const [segmentPlan, setSegmentPlan] = useState<string | null>(null);
  const [wahl, setWahl] = useWerFilter('kampagnen');
  const ich = api.ich;
  const laden = useCallback(() => fetch('/api/crm/kampagnen', { cache: 'no-store' }).then(r => r.json()).then(x => x.ok && setD(x)).catch(() => {}), []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { try { const s = sessionStorage.getItem('crm-kampagne-segment'); if (s) { setSegmentPlan(s); sessionStorage.removeItem('crm-kampagne-segment'); } } catch { /* ohne Speicher */ } }, []);
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch('/api/crm/kampagnen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    if (!r.ok) setMeldung(r.fehler ?? 'Fehlgeschlagen.');
    await laden(); await api.laden();
    return r;
  };
  const planen = async (playbook: string, segmentId?: string) => {
    const r = await post({ aktion: 'planen', playbook, ...(segmentId ? { segmentId } : {}) });
    if (!r.ok) return;
    setOffen(r.kampagne.id); setSegmentPlan(null);
    // Die neue Kampagne soll sichtbar sein, auch wenn gerade nach der anderen Person gefiltert ist.
    if (!passtWer(wahl, r.kampagne.zustaendig, 'sales', ich)) setWahl('alle');
    setMeldung(`Entwurf „${r.kampagne.name}“ mit ${r.kampagne.kontaktIds.length} Personen angelegt — zuständig ${nameVon(zustaendig(r.kampagne.zustaendig, 'sales'))}. Als Nächstes: Personen prüfen, dann den ersten Schritt angehen.`);
  };
  const alleKampagnen = [...(api.crm?.stand.kampagnen ?? [])].sort((a, b) => STATUS.findIndex(s => s.id === a.status) - STATUS.findIndex(s => s.id === b.status) || b.geaendert.localeCompare(a.geaendert));
  const kampagnen = alleKampagnen.filter(k => passtWer(wahl, k.zustaendig, 'sales', ich));
  const zahlen = werZahlen(alleKampagnen, k => k.zustaendig, 'sales', ich);
  const segment = segmentPlan ? api.crm?.stand.segmente.find(s => s.id === segmentPlan) : undefined;
  if (!d) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  return (
    <>
      <HeadPanel head={head} standardModus="kampagne" zuKontakt={zuKontakt} i={0} nachEntscheid={() => { void laden(); void api.laden(); }} />
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}

      {segment && (
        <Karte i={1} akzent={LEUCHT.business}>
          <Ueberschrift rechts={<button onClick={() => setSegmentPlan(null)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button>}>Kampagne für „{segment.name}“</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>Vorgehen wählen — die Personen kommen aus dem Segment.</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {d.playbooks.map(p => <Knopf key={p.id} leise onClick={() => planen(p.id, segment.id)}>{p.name}</Knopf>)}
            <Knopf leise onClick={() => planen('eigen', segment.id)}>Eigenes Vorgehen</Knopf>
          </div>
        </Karte>
      )}

      {alleKampagnen.length > 0 && (
        <Karte i={1}>
          <Ueberschrift rechts={`${kampagnen.filter(k => k.status === 'aktiv').length} aktiv`}>Kampagnen</Ueberschrift>
          <div style={{ marginBottom: 6 }}><WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} /></div>
          {!kampagnen.length && <Leer>Bei {wahl === 'ich' ? 'dir' : nameVon(wahl)} liegt keine Kampagne — „Alle“ zeigen, eine übergeben oder unten nach bewährtem Vorgehen planen.</Leer>}
          <Liste>
            {kampagnen.map(k => {
              const z = d.zahlen[k.id];
              return (
                <div key={k.id}>
                  <Zeile onClick={() => setOffen(offen === k.id ? null : k.id)} aktiv={offen === k.id}
                    links={<Punkt farbe={k.status === 'aktiv' ? LEUCHT.gut : k.status === 'entwurf' ? LEUCHT.achtung : C.inkLeise} />}
                    titel={k.name} unter={z ? `${z.personen} Personen · ${z.angesprochen} angesprochen · ${z.gespraeche} Gespräche · ${z.chancen} Leads${z.schritteFaellig ? ` · ${z.schritteFaellig} Schritte fällig` : ''}` : ''}
                    rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{k.von !== 'hand' && <Chip farbe={LEUCHT.agenten}>{k.von === 'head-sales' ? 'Head of Sales' : 'Head of Marketing'}</Chip>}<Chip farbe={C.inkDim}>{STATUS.find(s => s.id === k.status)?.label}</Chip><Person id={zustaendig(k.zustaendig, 'sales')} groesse={18} /></span>} />
                  {offen === k.id && <KampagnenDetail k={k} api={api} pb={d.playbooks.find(p => p.id === k.playbook)} z={z} heute={d.heute} post={post} zuKontakt={zuKontakt} />}
                </div>
              );
            })}
          </Liste>
        </Karte>
      )}

      <Karte i={2}>
        <Ueberschrift rechts={`${d.profil.kunden.length} Kunden`}>Auf Basis unserer Kunden</Ueberschrift>
        {d.profil.kunden.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <Raster min={150}>
              {d.profil.mrrJeKunde.slice(0, 6).map(m => <Zahl key={m.kunde} wert={m.mrr ? euro(m.mrr) : 'offen'} label={`${m.kunde.slice(0, 26)}${m.mrr ? ' je Monat' : ' · Honorar offen'}${m.health !== null ? ` · Health ${m.health}` : ''}`} />)}
            </Raster>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
              {d.profil.branchen.length ? <>Branchen: {d.profil.branchen.join(' · ')}. </> : <>Bei den Kunden-Firmen fehlt die Branche — in der Firmenkarte pflegen, dann findet „Kunden wie unsere besten“ ähnliche Firmen. </>}
              {d.profil.staedte.length ? <>Orte: {d.profil.staedte.join(', ')}. </> : null}
              {d.profil.groesse ? <>Größe {d.profil.groesse.min === d.profil.groesse.max ? d.profil.groesse.min : `${d.profil.groesse.min}–${d.profil.groesse.max}`} Mitarbeitende.</> : null}
            </div>
          </div>
        ) : <Leer>Noch keine Kunden-Firmen erkannt — Mandate und Firmen verknüpfen.</Leer>}
        {d.aehnliche.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, marginBottom: 4 }}>Kunden wie unsere besten</div>
            <Liste>
              {d.aehnliche.slice(0, 8).map(a => <Zeile key={a.id} titel={a.name} unter={a.gruende.join(' · ')} rechts={a.personen.length ? <Knopf leise onClick={() => zuKontakt(a.personen[0].id)}>{a.personen[0].name}{a.personen.length > 1 ? ` +${a.personen.length - 1}` : ''}</Knopf> : <Chip farbe={C.inkLeise}>keine Person</Chip>} />)}
            </Liste>
          </div>
        )}
      </Karte>

      <Karte i={3}>
        <Ueberschrift>Bewährtes Vorgehen</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 10 }}>
          {d.playbooks.map(p => (
            <div key={p.id} style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 6, alignContent: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ fontSize: TYP.body }}>{p.name}</b><Chip farbe={p.anzahl ? LEUCHT.business : C.inkLeise}>{p.anzahl} Personen</Chip></div>
              <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>{p.warum}</div>
              <div style={{ fontSize: 12, color: C.inkLeise }}>Kanal: {KANAL_LABEL[p.kanal]} · Messgröße: {p.kennzahl} · {p.fuer.map(f => (f === 'head-sales' ? 'Sales' : 'Marketing')).join(' & ')}</div>
              <div style={{ fontSize: 12, color: C.inkLeise }}>⚖ {p.recht}</div>
              <div><Knopf leise aus={!p.anzahl} onClick={() => planen(p.id)}>Kampagne planen</Knopf></div>
            </div>
          ))}
        </div>
      </Karte>
    </>
  );
}

function KampagnenDetail({ k, api, pb, z, heute, post, zuKontakt }: { k: Kampagne; api: CrmApi; pb?: Playbook; z?: KampagnenZahlen; heute: string; post: (b: Record<string, unknown>) => Promise<{ ok?: boolean; angelegt?: number; an?: string }>; zuKontakt: (id: string) => void }) {
  const [suche, setSuche] = useState('');
  const [alle, setAlle] = useState(false);
  const [hinweis, setHinweis] = useState('');
  // Nur die geänderten Felder — Kevin und Malin können gleichzeitig an derselben Kampagne arbeiten.
  const setze = (teil: Partial<Kampagne>) => api.teil('kampagnen', k.id, nurFelder(teil));
  const nachId = new Map((api.kontakte ?? []).map(x => [x.id, x]));
  const letztes = new Map<string, { ergebnis: KampagnenErgebnis; von?: string }>();
  for (const e of [...k.ergebnisse].sort((a, b) => a.am.localeCompare(b.am))) letztes.set(e.kontaktId, { ergebnis: e.ergebnis, von: e.von });
  const fuehrt = zustaendig(k.zustaendig, 'sales');
  // Aufgaben gehen an die Zuständigkeit; bei „beide“ an mich.
  const aufgabenAn = bearbeiterFuer(k.zustaendig, 'sales', api.ich ?? fuehrt);
  const jePerson = kampagneJePerson(k);
  // Was als Nächstes zu tun ist — fällige Schritte vor offenen Personen vor Abschluss.
  const naechstes = !z ? '' : k.status === 'abgeschlossen' || k.status === 'abgebrochen' ? ''
    : z.schritteFaellig ? `${z.schritteFaellig} ${z.schritteFaellig === 1 ? 'Schritt ist' : 'Schritte sind'} fällig — abhaken oder als Aufgabe an ${nameVon(aufgabenAn)} geben.`
    : z.offen ? `${z.offen} ${z.offen === 1 ? 'Person ist' : 'Personen sind'} noch nicht angesprochen${k.status === 'aktiv' ? ` — sie stehen in der Power Hour von ${fuehrt === BEIDE ? 'euch beiden' : nameVon(fuehrt)}` : ' — Status auf „Aktiv“, dann stehen sie in der Power Hour'}.`
    : z.personen ? 'Alle angesprochen — Kampagne abschließen und in der Notiz festhalten, was funktioniert hat.' : 'Personen hinzufügen — über die Suche unten.';
  const kanal = k.kanal === 'telefon' || k.kanal === 'mail' || k.kanal === 'linkedin' ? k.kanal : null;
  const treffer = suche.trim().length >= 2 ? (api.kontakte ?? []).filter(x => !k.kontaktIds.includes(x.id) && !x.werbesperre && `${anzeigename(x)} ${x.firma ?? ''}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 6) : [];
  const personen = k.kontaktIds.map(id => nachId.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <div style={{ padding: '10px 2px 18px', display: 'grid', gap: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      {z && <Raster min={110}><Zahl wert={String(z.personen)} label="Personen" /><Zahl wert={String(z.angesprochen)} label="angesprochen" /><Zahl wert={String(z.reagiert)} label="reagiert" /><Zahl wert={String(z.gespraeche)} label="Gespräche" farbe={LEUCHT.gut} /><Zahl wert={String(z.chancen)} label="Chancen" farbe={LEUCHT.business} /></Raster>}
      {naechstes && <div style={{ fontSize: 12.5, color: C.ink }}>Als Nächstes: {naechstes}</div>}
      {jePerson.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: C.inkDim }}>
          {jePerson.map(x => (
            <span key={x.person || 'ohne'} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              {x.person ? <Person id={x.person} name groesse={18} /> : <span style={{ color: C.inkLeise }}>ohne Angabe</span>}
              <span>{x.angesprochen} angesprochen · {x.gespraeche} Gespräche{x.chancen ? ` · ${x.chancen} Leads` : ''}</span>
            </span>
          ))}
        </div>
      )}
      {pb && <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}><b style={{ color: C.ink }}>Warum:</b> {pb.warum} <span style={{ color: C.inkLeise }}>· ⚖ {pb.recht}</span></div>}
      {k.playbook === 'vernetzen' && <VernetzenEinstellungen k={k} api={api} />}
      <Feldzeile label="Zuständig">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ZustaendigWahl wert={k.zustaendig} welt="sales" onWahl={wert => void api.teil('kampagnen', k.id, { zustaendig: wert })} />
          <Uebergeben api={api} art="kampagne" id={k.id} jetzt={fuehrt} klein />
        </div>
      </Feldzeile>
      <Feldzeile label="Status"><Pillen liste={STATUS} aktiv={k.status} onWahl={status => setze({ status })} /></Feldzeile>
      <Feldzeile label="Name"><Feld wert={k.name} onFertig={name => name.trim() && setze({ name: name.trim() })} /></Feldzeile>
      <Feldzeile label="Ziel"><Feld wert={k.ziel} onFertig={ziel => setze({ ziel })} /></Feldzeile>
      <Feldzeile label="Start"><Feld typ="date" breite={160} wert={k.start} platzhalter="Start" onFertig={start => setze({ start: start || undefined })} /></Feldzeile>
      <Feldzeile label="Kanal"><Pillen liste={Object.entries(KANAL_LABEL).map(([id, label]) => ({ id: id as Kampagne['kanal'], label }))} aktiv={k.kanal} onWahl={kanal => setze({ kanal })} /></Feldzeile>
      <div>
        <Ueberschrift rechts={<Knopf leise onClick={async () => { const r = await post({ aktion: 'aufgaben', id: k.id }); if (r.ok) setHinweis(r.angelegt ? `${r.angelegt} ${r.angelegt === 1 ? 'Aufgabe' : 'Aufgaben'} für ${nameVon(r.an ?? aufgabenAn)} angelegt.` : 'Alle offenen Schritte haben schon eine Aufgabe.'); }}>Offene Schritte als Aufgaben für {nameVon(aufgabenAn)}</Knopf>}>Schritte</Ueberschrift>
        {hinweis && <div style={{ fontSize: 12.5, color: C.inkDim, marginBottom: 6 }}>{hinweis}</div>}
        {k.schritte.map(s => {
          const faellig = k.start ? plusTage(k.start, s.tag) : null;
          const um = () => setze({ schritte: k.schritte.map(x => (x.id === s.id ? { ...x, erledigt: !x.erledigt } : x)) });
          return (
            <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: TYP.bedien }}>
              <input type="checkbox" checked={s.erledigt} onChange={um} aria-label={s.text} />
              <span style={{ flex: 1, color: s.erledigt ? C.inkLeise : C.ink, textDecoration: s.erledigt ? 'line-through' : 'none' }}>{s.text}</span>
              {s.aufgabeId && <Link href={WEG.aufgabe(s.aufgabeId)} style={{ textDecoration: 'none' }}><Chip farbe={C.inkDim}>Aufgabe ›</Chip></Link>}
              <span style={{ fontSize: 12, color: !s.erledigt && faellig && faellig <= heute ? LEUCHT.achtung : C.inkLeise }}>{faellig ? datum(faellig, heute) : `Tag ${s.tag}`}</span>
            </div>
          );
        })}
      </div>
      <div>
        <Ueberschrift rechts={`${personen.length}`}>Personen</Ueberschrift>
        {personen.slice(0, alle ? 500 : 12).map(x => {
          const st = kanal ? kanalStatus(x, kanal) : null;
          const l = letztes.get(x.id);
          const e = l?.ergebnis;
          return (
            <div key={x.id} style={{ display: 'grid', gap: 6, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => zuKontakt(x.id)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.body, padding: 0 }}>{anzeigename(x)}</button>
                <span style={{ fontSize: 12.5, color: C.inkLeise }}>{x.firma}</span>
                {l?.von && <span title={`zuletzt festgehalten von ${nameVon(l.von)}`} style={{ display: 'inline-flex' }}><Person id={l.von} groesse={16} /></span>}
                {st && <span title={st.grund} style={{ fontSize: 11.5, color: AMPEL_FARBE[st.farbe] }}>● {KANAL_LABEL[kanal!]}: {st.farbe === 'gruen' ? 'zulässig' : st.farbe === 'gelb' ? 'nur persönlich/mit Anlass' : 'nicht zulässig'}</span>}
                <button onClick={() => setze({ kontaktIds: k.kontaktIds.filter(i => i !== x.id) })} aria-label="Aus der Kampagne nehmen" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>×</button>
              </div>
              <Pillen liste={ERGEBNISSE} aktiv={e} onWahl={ergebnis => void post({ aktion: 'ergebnis', id: k.id, kontaktId: x.id, ergebnis, ...(api.ich ? { von: api.ich } : {}) })} farbe={ERGEBNISSE.find(r => r.id === e)?.farbe ?? LEUCHT.puls} />
            </div>
          );
        })}
        {personen.length > 12 && <button onClick={() => setAlle(!alle)} style={{ marginTop: 6, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>{alle ? 'weniger' : `alle ${personen.length}`}</button>}
        {!personen.length && <Leer>Keine Personen — über die Suche hinzufügen.</Leer>}
        <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Person hinzufügen …" aria-label="Person hinzufügen" style={{ marginTop: 8, width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 11px', color: C.ink, fontSize: TYP.bedien }} />
        {treffer.map(x => <button key={x.id} onClick={() => { void setze({ kontaktIds: [...k.kontaktIds, x.id] }); setSuche(''); }} style={{ display: 'block', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '3px 0' }}>+ {anzeigename(x)}{x.firma ? ` · ${x.firma}` : ''}</button>)}
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Jedes Ergebnis landet im Verlauf der Person — mit dir als der Person, die angesprochen hat; „Interesse → Lead“ setzt den Lead der Firma in die Qualifizierung (Ebene 1) — zum Deal wird er erst als SQL.</div>
      </div>
      <Feldzeile label="Notiz"><Feld wert={k.notiz} onFertig={notiz => setze({ notiz: notiz || undefined })} /></Feldzeile>
      <div><button onClick={() => { if (window.confirm('Kampagne löschen? Ergebnisse im Verlauf der Personen bleiben.')) void api.weg('kampagnen', k.id); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>Löschen</button></div>
    </div>
  );
}
