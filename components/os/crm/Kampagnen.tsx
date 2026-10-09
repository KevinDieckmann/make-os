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
// Kosten (27.09.): je Kampagne pflegbar — der Marketing-Trichter rechnet daraus
// Kosten je Anfrage und je SQL. „Deal anlegen“ an einer Person mit Ergebnis
// „Interesse → Lead“: über POST /api/crm/deal mit Quelle Kampagne und Bezug
// (marketing/DealAusQuelle.tsx) — der Lead wird SQL, der Deal trägt die Herkunft.
// 04.10. (Kevin: „alles anpassbar“): jede Kampagne hängt am Baustein `ZeileAktionen` — Archivieren (`archiviertAm`, Reiter
// Archiv, zurückholbar) und Löschen (Papierkorb 30 Tage, `geloeschtAm`, mit Rückgängig); endgültig nur aus dem Papierkorb
// (components/os/crm/ablage.tsx, Regel lib/crm/ablage.ts).

import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { useLinkAuswahl } from '../Verlauf';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dealAkte } from '@/lib/crm/adresse';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Raster, Zahl, LEUCHT, ZeileAktionen, Hinweis } from '../ui';
import { useCrmAblage, useAblageSicht, AblageReiter, PapierkorbKarte, type CrmAblage } from './ablage';
import { anzeigename } from '@/lib/make-one/crm';
import { kanalStatus } from '@/lib/crm/recht';
import type { Kampagne, KampagnenErgebnis } from '@/lib/crm/typen';
import type { Playbook, KampagnenZahlen } from '@/lib/crm/kampagnen';
import { werZahlen, bearbeiterFuer, kampagneJePerson, OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { zustaendig, nameVon, BEIDE } from '@/lib/crm/team';
import { type CrmApi, datum, euro, plusTage, nurFelder } from './daten';
import { Pillen, Feld, Feldzeile, AMPEL_FARBE } from './teile';
import { Wahl } from './Wahl';
import { Person, ZustaendigWahl, Uebergeben, WerFilter, useWerFilter, passtWer } from './team';
import { HeadPanel } from './HeadPanel';
import { VernetzenEinstellungen } from './Vernetzen';
import { DealAusQuelle } from './marketing/DealAusQuelle';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { NEU_MAX, kampagneInPowerHour } from '@/lib/crm/heute';
import { weltDerKampagne, sichtbareKampagnen } from '@/lib/crm/kampagnen-welt';

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

/** Kampagnen planen beide Heads (Kevin, 25.09.): in Sales mit dem Head of Sales, in Marketing mit dem Head of Marketing — dieselben Kampagnen. */
export function Kampagnen({ api, zuKontakt, head = 'marketing' }: { api: CrmApi; zuKontakt: (id: string) => void; head?: 'sales' | 'marketing' }) {
  const [d, setD] = useState<Daten | null>(null);
  // Offene Kampagne im Link (k): Zurück schließt sie wieder.
  const [offen, setOffen] = useLinkAuswahl();
  const [meldung, setMeldung] = useState('');
  const [segmentPlan, setSegmentPlan] = useState<string | null>(null);
  const [wahl, setWahl] = useWerFilter('kampagnen');
  const ich = api.ich;
  const [fehler, setFehler] = useState<string | null>(null);
  const ablage = useCrmAblage(api, 'kampagnen');
  const [sicht, setSicht] = useAblageSicht(() => setOffen(null));
  const laden = useCallback(() => fetch('/api/crm/kampagnen', { cache: 'no-store' }).then(r => r.json()).then(x => { if (x.ok) { setD(x); setFehler(null); } else setFehler(x.fehler ?? 'Kampagnen nicht geladen.'); }).catch(() => setFehler('Kampagnen nicht erreichbar.')), []);
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
    if (!passtWer(wahl, r.kampagne.zustaendig, weltDerKampagne(r.kampagne), ich)) setWahl('alle');
    // 5.2 (08.10.): der Hinweis des Servers (rote Ampel nicht aufgenommen, gelbe nur persönlich) geht nicht mehr verloren — „0 Personen“ hat einen Grund.
    setMeldung(`Entwurf „${r.kampagne.name}“ mit ${r.kampagne.kontaktIds.length} Personen angelegt — zuständig ${nameVon(zustaendig(r.kampagne.zustaendig, weltDerKampagne(r.kampagne)))}.${typeof r.hinweis === 'string' && r.hinweis ? ` ${r.hinweis}` : ''} Als Nächstes: ${r.kampagne.kontaktIds.length ? 'Personen prüfen, dann den ersten Schritt angehen' : 'Personen über die Suche in der Kampagne hinzufügen'}.`);
  };
  const alleRoh = api.crm?.stand.kampagnen ?? [];
  const archivZahl = alleRoh.filter(k => k.archiviertAm).length;
  const alleKampagnen = alleRoh.filter(k => (sicht === 'archiv' ? !!k.archiviertAm : !k.archiviertAm)).sort((a, b) => STATUS.findIndex(s => s.id === a.status) - STATUS.findIndex(s => s.id === b.status) || b.geaendert.localeCompare(a.geaendert));
  // 6.6 (08.10.): die Welt einer Kampagne kommt aus ihrem Playbook (`weltDerKampagne`) — nicht mehr fest „sales“.
  // 5.7: die Kampagne aus dem Link (`k`) steht immer da — auch archiviert oder bei gemerktem Filter „Meins“.
  const kampagnen = sichtbareKampagnen(alleRoh, { sicht, offen, passt: k => passtWer(wahl, k.zustaendig, weltDerKampagne(k), ich) })
    .sort((a, b) => STATUS.findIndex(s => s.id === a.status) - STATUS.findIndex(s => s.id === b.status) || b.geaendert.localeCompare(a.geaendert));
  const zahlen = werZahlen(alleKampagnen, k => zustaendig(k.zustaendig, weltDerKampagne(k)), 'sales', ich);
  const segment = segmentPlan ? api.crm?.stand.segmente.find(s => s.id === segmentPlan) : undefined;
  if (!d) return <Karte i={0}>{fehler ? <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler} <Knopf leise onClick={() => void laden()}>Noch einmal</Knopf></div> : <Leer>Lädt …</Leer>}</Karte>;

  return (
    <>
      <HeadPanel head={head} standardModus="kampagne" zuKontakt={zuKontakt} i={0} nachEntscheid={() => { void laden(); void api.laden(); }} />
      {/* 5.5 (08.10.): ist eine Kampagne offen, steht die Meldung an ihr (unten im Detail), nicht außer Sicht oben. */}
      {meldung && !offen && <Hinweis art={/nicht|Fehl|keine/i.test(meldung) ? 'achtung' : 'gut'} rolle="status" aktion={<Knopf leise onClick={() => setMeldung('')}>ok</Knopf>}>{meldung}</Hinweis>}

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

      {(alleRoh.length > 0 || ablage.korb.length > 0) && (
        <AblageReiter sicht={sicht} onSicht={setSicht} name="Kampagnen" liste={alleRoh.length - archivZahl} archiv={archivZahl} korb={ablage.korb.length} />
      )}
      {sicht === 'papierkorb' && <PapierkorbKarte ablage={ablage} liste="kampagnen" />}
      {sicht !== 'papierkorb' && (alleKampagnen.length > 0 || sicht === 'archiv' || kampagnen.length > 0) && (
        <Karte i={1}>
          <Ueberschrift rechts={sicht === 'archiv' ? `${alleKampagnen.length} im Archiv` : `${kampagnen.filter(k => k.status === 'aktiv').length} aktiv`}>{sicht === 'archiv' ? 'Archiv · Kampagnen' : 'Kampagnen'}</Ueberschrift>
          <div style={{ marginBottom: 6 }}><WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} /></div>
          {!kampagnen.length && <Leer>{sicht === 'archiv' ? 'Hier liegt keine archivierte Kampagne. Archivierte Kampagnen sind aus der Liste ausgeblendet, ihre Ergebnisse bleiben im Verlauf der Personen — zurückholen jederzeit.' : `Bei ${wahl === 'ich' ? 'dir' : nameVon(wahl)} liegt keine Kampagne — „Alle“ zeigen, eine übergeben oder unten nach bewährtem Vorgehen planen.`}</Leer>}
          <Liste>
            {kampagnen.map(k => {
              const z = d.zahlen[k.id];
              return (
                <div key={k.id}>
                  <ZeileAktionen titel={k.name} archiviert={sicht === 'archiv'} onArchivieren={() => { setOffen(null); if (sicht === 'archiv') ablage.zurueckholen(k.id, k.name); else ablage.archivieren(k.id, k.name); }} onLoeschen={() => { setOffen(null); kampagneLoeschen(ablage, k); }}>
                  <Zeile onClick={() => setOffen(offen === k.id ? null : k.id)} aktiv={offen === k.id}
                    links={<Punkt farbe={k.status === 'aktiv' ? LEUCHT.gut : k.status === 'entwurf' ? LEUCHT.achtung : C.inkLeise} />}
                    titel={k.name} unter={z ? `${z.personen} Personen · ${z.angesprochen} angesprochen · ${z.gespraeche} Gespräche · ${z.chancen} Leads${z.schritteFaellig ? ` · ${z.schritteFaellig} Schritte fällig` : ''}${k.kostenEuro ? ` · ${euro(k.kostenEuro)} Kosten` : ''}` : ''}
                    rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{k.archiviertAm && sicht !== 'archiv' && <Chip farbe={C.inkLeise}>archiviert</Chip>}{k.von !== 'hand' && <Chip farbe={LEUCHT.agenten}>{k.von === 'head-sales' ? 'Head of Sales' : 'Head of Marketing'}</Chip>}<Chip farbe={C.inkDim}>{STATUS.find(s => s.id === k.status)?.label}</Chip><Person id={zustaendig(k.zustaendig, weltDerKampagne(k))} groesse={18} /></span>} />
                  </ZeileAktionen>
                  {offen === k.id && <KampagnenDetail k={k} api={api} ablage={ablage} pb={d.playbooks.find(p => p.id === k.playbook)} z={z} heute={d.heute} post={post} zuKontakt={zuKontakt} meldung={meldung} setMeldung={setMeldung} />}
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
        {/* 5.6 (08.10.): eine eigene (leere) Kampagne geht auch ohne Segment — Personen danach über die Suche hinzufügen. */}
        <Ueberschrift rechts={<Knopf leise onClick={() => planen('eigen')}>Eigene Kampagne</Knopf>}>Bewährtes Vorgehen</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 10 }}>
          {d.playbooks.map(p => (
            <div key={p.id} style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 6, alignContent: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ fontSize: TYP.body }}>{p.name}</b><Chip farbe={p.anzahl ? LEUCHT.business : C.inkLeise}>{p.anzahl} Personen</Chip></div>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{p.warum}</div>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Kanal: {KANAL_LABEL[p.kanal]} · Messgröße: {p.kennzahl} · {p.fuer.map(f => (f === 'head-sales' ? 'Sales' : 'Marketing')).join(' & ')}</div>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>⚖ {p.recht}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><Knopf leise aus={!p.anzahl} onClick={() => planen(p.id)}>Kampagne planen</Knopf>{!p.anzahl && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Zielgruppe heute leer — „Eigene Kampagne“ geht immer.</span>}</div>
            </div>
          ))}
        </div>
      </Karte>
      {ablage.dialog}
      {ablage.hinweis}
    </>
  );
}

/**
 * Wie viele Personen der Kampagne heute in der Power Hour der führenden Person stehen (5.3) — dieselbe Rechnung wie die Power Hour
 * (GET /api/crm/heute, Karten mit Bezug auf die Kampagne). Nur für aktive Kampagnen; ohne Antwort null (dann kein Zähler).
 */
function useKampagneInPowerHour(k: Kampagne, person: string): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (k.status !== 'aktiv') { setN(null); return; }
    let lebt = true;
    fetch(`/api/crm/heute?n=12&fuer=${encodeURIComponent(person)}`, { cache: 'no-store' }).then(r => r.json())
      .then((d: { ok?: boolean; karten?: { bezug?: string }[] }) => { if (lebt) setN(d?.ok ? kampagneInPowerHour(d.karten ?? [], k.id) : null); })
      .catch(() => { if (lebt) setN(null); });
    return () => { lebt = false; };
  }, [k.id, k.status, person]);
  return n;
}

/** Löschen = Papierkorb; eine laufende Kampagne erst nach Rückfrage (Archiv als ruhigerer Weg). */
function kampagneLoeschen(ablage: CrmAblage, k: Kampagne) {
  if (k.status !== 'aktiv') { ablage.loeschen(k.id, k.name); return; }
  ablage.loeschen(k.id, k.name, { archivAnbieten: true, text: 'Die Kampagne läuft noch. Im Papierkorb ist sie überall ausgeblendet; die Ergebnisse im Verlauf der Personen bleiben. Ist sie nur vorbei, ist Archivieren der ruhigere Weg.' });
}

function KampagnenDetail({ k, api, ablage, pb, z, heute, post, zuKontakt, meldung, setMeldung }: { k: Kampagne; api: CrmApi; ablage: CrmAblage; pb?: Playbook; z?: KampagnenZahlen; heute: string; post: (b: Record<string, unknown>) => Promise<{ ok?: boolean; angelegt?: number; an?: string; fehler?: string; hinweis?: string }>; zuKontakt: (id: string) => void; meldung: string; setMeldung: (t: string) => void }) {
  const router = useRouter();
  const [suche, setSuche] = useState('');
  const [alle, setAlle] = useState(false);
  const [hinweis, setHinweis] = useState('');
  // „Deal anlegen“ an einer Person mit Interesse — offen für genau eine Person.
  const [dealFuer, setDealFuer] = useState<string | null>(null);
  const zuDeal = (id: string) => router.push(dealAkte(id));
  // Nur die geänderten Felder — Kevin und Malin können gleichzeitig an derselben Kampagne arbeiten.
  const setze = (teil: Partial<Kampagne>) => api.teil('kampagnen', k.id, nurFelder(teil));
  const nachId = new Map((api.kontakte ?? []).map(x => [x.id, x]));
  const letztes = new Map<string, { ergebnis: KampagnenErgebnis; von?: string }>();
  for (const e of [...k.ergebnisse].sort((a, b) => a.am.localeCompare(b.am))) letztes.set(e.kontaktId, { ergebnis: e.ergebnis, von: e.von });
  const welt = weltDerKampagne(k);
  const fuehrt = zustaendig(k.zustaendig, welt);
  // Aufgaben gehen an die Zuständigkeit; bei „beide“ an mich.
  const aufgabenAn = bearbeiterFuer(k.zustaendig, welt, api.ich ?? fuehrt);
  const jePerson = kampagneJePerson(k);
  const inPowerHour = useKampagneInPowerHour(k, fuehrt === BEIDE ? api.ich ?? fuehrt : fuehrt);
  // Was als Nächstes zu tun ist — fällige Schritte vor offenen Personen vor Abschluss.
  const naechstes = !z ? '' : k.status === 'abgeschlossen' || k.status === 'abgebrochen' ? ''
    : z.schritteFaellig ? `${z.schritteFaellig} ${z.schritteFaellig === 1 ? 'Schritt ist' : 'Schritte sind'} fällig — abhaken oder als Aufgabe an ${nameVon(aufgabenAn)} geben.`
    // 5.3 (08.10.): ehrlich — die Power Hour nimmt je Tag höchstens NEU_MAX neue Karten über alle Quellen; rote Ampel und kürzlich Kontaktierte fallen raus.
    : z.offen ? `${z.offen} ${z.offen === 1 ? 'Person ist' : 'Personen sind'} noch nicht angesprochen${k.status === 'aktiv' ? ` — die Power Hour von ${fuehrt === BEIDE ? 'euch beiden' : nameVon(fuehrt)} nimmt je Tag höchstens ${NEU_MAX} neue Karten (über alle Quellen, ohne rote Ampel und kürzlich Kontaktierte)${inPowerHour !== null ? `; heute in der Power Hour: ${inPowerHour}` : ''}` : ' — Status auf „Aktiv“, dann kommen sie nach und nach in die Power Hour'}.`
    : z.personen ? 'Alle angesprochen — Kampagne abschließen und in der Notiz festhalten, was funktioniert hat.' : 'Personen hinzufügen — über die Suche unten.';
  const kanal = k.kanal === 'telefon' || k.kanal === 'mail' || k.kanal === 'linkedin' ? k.kanal : null;
  const treffer = suche.trim().length >= 2 ? (api.kontakte ?? []).filter(x => !k.kontaktIds.includes(x.id) && !ausgenommen(x) && `${anzeigename(x)} ${x.firma ?? ''}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 6) : [];
  // Offener Deal mit dieser Person — dann führt „Deal“ dorthin statt einen zweiten anzulegen.
  const offenerDeal = (kontaktId: string) => (api.crm?.stand.chancen ?? []).find(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(kontaktId));
  const personen = k.kontaktIds.map(id => nachId.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <div style={{ padding: '10px 2px 18px', display: 'grid', gap: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      {/* 5.5 (08.10.): Meldungen AM Detail — Fehler und Bestätigungen (auch der Speicher-Weg: Kanal, Personen) stehen hier, nicht außer Sicht oben. */}
      {meldung && <Hinweis art={/nicht|Fehl|keine Verbindung/i.test(meldung) ? 'achtung' : 'gut'} rolle="status" aktion={<Knopf leise onClick={() => setMeldung('')}>ok</Knopf>}>{meldung}</Hinweis>}
      {api.fehler && <Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={() => api.setFehler(null)}>ok</Knopf>}>{api.fehler}</Hinweis>}
      {api.hinweis && <Hinweis art="achtung" rolle="status" aktion={<Knopf leise onClick={() => api.setHinweis(null)}>ok</Knopf>}>{api.hinweis}</Hinweis>}
      {z && <Raster min={110}><Zahl wert={String(z.personen)} label="Personen" /><Zahl wert={String(z.angesprochen)} label="angesprochen" /><Zahl wert={String(z.reagiert)} label="reagiert" /><Zahl wert={String(z.gespraeche)} label="Gespräche" farbe={LEUCHT.gut} /><Zahl wert={String(z.chancen)} label="Chancen" farbe={LEUCHT.business} /></Raster>}
      {naechstes && <div style={{ fontSize: TYP.bedien, color: C.ink }}>Als Nächstes: {naechstes}</div>}
      {jePerson.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
          {jePerson.map(x => (
            <span key={x.person || 'ohne'} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              {x.person ? <Person id={x.person} name groesse={18} /> : <span style={{ color: C.inkLeise }}>ohne Angabe</span>}
              <span>{x.angesprochen} angesprochen · {x.gespraeche} Gespräche{x.chancen ? ` · ${x.chancen} Leads` : ''}</span>
            </span>
          ))}
        </div>
      )}
      {pb && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}><b style={{ color: C.ink }}>Warum:</b> {pb.warum} <span style={{ color: C.inkLeise }}>· ⚖ {pb.recht}</span></div>}
      {k.playbook === 'vernetzen' && <VernetzenEinstellungen k={k} api={api} />}
      <Feldzeile label="Zuständig">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ZustaendigWahl wert={k.zustaendig} welt={welt} onWahl={wert => void api.teil('kampagnen', k.id, { zustaendig: wert })} />
          <Uebergeben api={api} art="kampagne" id={k.id} jetzt={fuehrt} klein />
        </div>
      </Feldzeile>
      <Feldzeile label="Status"><Wahl label="Status" liste={STATUS} wert={k.status} onWahl={status => setze({ status })} /></Feldzeile>
      <Feldzeile label="Name"><Feld wert={k.name} onFertig={name => name.trim() && setze({ name: name.trim() })} /></Feldzeile>
      <Feldzeile label="Ziel"><Feld wert={k.ziel} onFertig={ziel => setze({ ziel })} /></Feldzeile>
      <Feldzeile label="Start"><Feld typ="date" breite={160} wert={k.start} platzhalter="Start" onFertig={start => setze({ start: start || undefined })} /></Feldzeile>
      <Feldzeile label="Kanal"><Wahl label="Kanal" liste={Object.entries(KANAL_LABEL).map(([id, label]) => ({ id: id as Kampagne['kanal'], label }))} wert={k.kanal} onWahl={kanal => setze({ kanal })} /></Feldzeile>
      <Feldzeile label="Kosten (€)">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Feld typ="number" breite={140} wert={k.kostenEuro ? String(k.kostenEuro) : ''} platzhalter="0" onFertig={t => { const n = Math.round(Number(t)); setze({ kostenEuro: Number.isFinite(n) && n > 0 ? n : undefined }); }} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Anzeigen, Tools, Zukauf — geht in „Kosten je Anfrage“ und „je SQL“ der Marketing-Strecke ein.</span>
        </div>
      </Feldzeile>
      <div>
        <Ueberschrift rechts={<Knopf leise onClick={async () => { const r = await post({ aktion: 'aufgaben', id: k.id }); if (r.ok) setHinweis(r.angelegt ? `${r.angelegt} ${r.angelegt === 1 ? 'Aufgabe' : 'Aufgaben'} für ${nameVon(r.an ?? aufgabenAn)} angelegt.` : 'Alle offenen Schritte haben schon eine Aufgabe.'); }}>Offene Schritte als Aufgaben für {nameVon(aufgabenAn)}</Knopf>}>Schritte</Ueberschrift>
        {hinweis && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>{hinweis}</div>}
        {k.schritte.map(s => {
          const faellig = k.start ? plusTage(k.start, s.tag) : null;
          const um = () => setze({ schritte: k.schritte.map(x => (x.id === s.id ? { ...x, erledigt: !x.erledigt } : x)) });
          return (
            <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: TYP.bedien }}>
              <input type="checkbox" checked={s.erledigt} onChange={um} aria-label={s.text} />
              <span style={{ flex: 1, color: s.erledigt ? C.inkLeise : C.ink, textDecoration: s.erledigt ? 'line-through' : 'none' }}>{s.text}</span>
              {s.aufgabeId && <Link href={WEG.aufgabe(s.aufgabeId)} style={{ textDecoration: 'none' }}><Chip farbe={C.inkDim}>Aufgabe ›</Chip></Link>}
              <span style={{ fontSize: TYP.bedien, color: !s.erledigt && faellig && faellig <= heute ? LEUCHT.achtung : C.inkLeise }}>{faellig ? datum(faellig, heute) : `Tag ${s.tag}`}</span>
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
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{x.firma}</span>
                {l?.von && <span title={`zuletzt festgehalten von ${nameVon(l.von)}`} style={{ display: 'inline-flex' }}><Person id={l.von} groesse={16} /></span>}
                {st && <span title={st.grund} style={{ fontSize: 12, color: AMPEL_FARBE[st.farbe] }}>● {KANAL_LABEL[kanal!]}: {st.farbe === 'gruen' ? 'zulässig' : st.farbe === 'gelb' ? 'nur persönlich/mit Anlass' : 'nicht zulässig'}</span>}
                <button onClick={() => setze({ kontaktIds: k.kontaktIds.filter(i => i !== x.id) })} aria-label="Aus der Kampagne nehmen" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pillen liste={ERGEBNISSE} aktiv={e} onWahl={async ergebnis => { const r = await post({ aktion: 'ergebnis', id: k.id, kontaktId: x.id, ergebnis, ...(api.ich ? { von: api.ich } : {}) }); if (r.ok) setMeldung(`„${ERGEBNISSE.find(y => y.id === ergebnis)?.label}“ bei ${anzeigename(x)} festgehalten — steht im Verlauf der Person.${r.hinweis ? ` ${r.hinweis}` : ''}`); }} farbe={ERGEBNISSE.find(r => r.id === e)?.farbe ?? LEUCHT.puls} />
                {e === 'chance' && (offenerDeal(x.id)
                  ? <Knopf leise onClick={() => zuDeal(offenerDeal(x.id)!.id)}>Zum Deal ›</Knopf>
                  : <Knopf leise farbe={LEUCHT.business} onClick={() => setDealFuer(dealFuer === x.id ? null : x.id)}>{dealFuer === x.id ? 'Abbrechen' : 'Deal aus dieser Kampagne'}</Knopf>)}
              </div>
              {dealFuer === x.id && !offenerDeal(x.id) && (
                <DealAusQuelle api={api} kontaktId={x.id} quelle="kampagne" quelleBezug={k.id} bezugTitel={k.name} onFertig={id => { setDealFuer(null); zuDeal(id); }} onAbbruch={() => setDealFuer(null)} zuDeal={zuDeal} />
              )}
            </div>
          );
        })}
        {personen.length > 12 && <button onClick={() => setAlle(!alle)} style={{ marginTop: 6, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>{alle ? 'weniger' : `alle ${personen.length}`}</button>}
        {!personen.length && <Leer>Keine Personen — über die Suche hinzufügen.</Leer>}
        <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Person hinzufügen …" aria-label="Person hinzufügen" style={{ marginTop: 8, width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 11px', color: C.ink, fontSize: TYP.bedien }} />
        {treffer.map(x => <button key={x.id} onClick={() => { void setze({ kontaktIds: [...k.kontaktIds, x.id] }); setSuche(''); }} style={{ display: 'block', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: '3px 0' }}>+ {anzeigename(x)}{x.firma ? ` · ${x.firma}` : ''}</button>)}
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Jedes Ergebnis landet im Verlauf der Person — mit dir als der Person, die angesprochen hat; „Interesse → Lead“ setzt den Lead der Firma in die Qualifizierung (Ebene 1). Wird daraus ein echter Bedarf: „Deal aus dieser Kampagne“ — der Deal trägt Quelle Kampagne, der Lead wird SQL.</div>
      </div>
      <Feldzeile label="Notiz"><Feld wert={k.notiz} onFertig={notiz => setze({ notiz: notiz || undefined })} /></Feldzeile>
      <div><button onClick={() => kampagneLoeschen(ablage, k)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>In den Papierkorb</button></div>
    </div>
  );
}
