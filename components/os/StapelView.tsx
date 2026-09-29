'use client';

// ─── MAKE OS — Aufträge & Freigaben (der Stapel) ────────────────────────────
// Was ZOE vorbereitet hat und auf dein Ja wartet. Seit 24.09. im
// lebendigen Muster: offene Vorschläge je Gruppe mit Freigeben/Ablehnen,
// zuletzt Entschiedenes, der Arbeiter mit seinen Aufträgen, Gedächtnis und
// Verbrauch. Protokoll, Rückgängig und Felder-Ändern: /os/stapel/voll.
// 29.09. (#94/#97): ZOE-Aufgaben-Vorschläge zeigen je Feld „alt → neu“ mit Häkchen; „Alle freigeben“ nur für risikoarme
// (nur Notiz-Entwurf/Unteraufgaben) — alles andere braucht einzeln einen Blick; freigegebene Chargen lassen sich zurücknehmen.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/make-one/finance-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Zahl, Fortschritt, feld, LEUCHT, Spalten, Spalte } from './schlank';
import { WEG } from '@/lib/wege';
import { markttraktion } from '@/lib/crm/adresse';
import { CrmStapelDetail } from './crm/ZoeFragen';
import { useTasks } from '@/context/TasksContext';
import { risikoarm, vorschlagSauber, nurGewaehlt, zoeStandLesen, ZOE_AUFGABE_WERKZEUG, type ZoeFeld } from '@/lib/aufgaben/zoe';
import { FreigabeFelder, alleFelder } from './aufgaben/ZoeAufgabe';

interface Vorschlag { id: string; zeit: string; werkzeug: string; gruppe: string; titel: string; vorher?: string; nachher: string; eingabe: Record<string, unknown>; anlass?: string; status: 'offen' | 'in_arbeit' | 'freigegeben' | 'abgelehnt' | 'fehlgeschlagen'; ergebnis?: string; grund?: string; /** Wer entschieden hat (29.09.). */ entschiedenVon?: string; /** Art mit Bezug (lib/zoe/stapel-arten.ts), z. B. „aufgabe“. */ bezug?: { art: string; id: string } }
interface Auftrag { id: string; zeit: string; art: string; name: string; auftrag?: string; status: 'offen' | 'laeuft' | 'fertig' | 'fehler'; ergebnis?: string; fehler?: string }
interface Fakt { id: string; tag: string; art: string; thema: string; satz: string }
interface Kosten { heuteCent: number; summeCent: number; jeZweck: { zweck: string; cent: number; anzahl: number }[] }
/** Die Freigabe-Listen der Heads (eigene Speicher, eigene Seiten) — hier gebündelt sichtbar (27.09.). */
interface HeadFreigaben { id: string; name: string; href: string; offen: number; titel: string[]; fehler?: boolean }
const HEADS_QUELLEN: { id: string; name: string; api: string; href: string }[] = [
  { id: 'sales', name: 'Head of Sales', api: '/api/heads/sales', href: WEG.powerHour() },
  { id: 'marketing', name: 'Head of Marketing', api: '/api/heads/marketing', href: markttraktion('marketing') },
  { id: 'event', name: 'Head of Event', api: '/api/heads/event', href: markttraktion('event') },
  { id: 'finanzchef', name: 'Head of Finance', api: '/api/finanzchef', href: WEG.chef() },
];

const GRUPPE: Record<string, { label: string; href: string; farbe: string }> = {
  finanzen: { label: 'Geld', href: '/os/finanzen', farbe: LEUCHT.geld }, meilensteine: { label: 'Meilensteine', href: '/os/roadmap', farbe: LEUCHT.schlaf },
  fokus: { label: 'Fokus & Ziele', href: '/os/wachstum', farbe: LEUCHT.schlaf }, aufgaben: { label: 'Aufgaben', href: '/os/aufgaben', farbe: LEUCHT.achtung },
  kunden: { label: 'Mandate', href: '/os/mandate', farbe: LEUCHT.business }, planer: { label: 'Planung', href: '/os/planung/woche', farbe: LEUCHT.puls },
  inbox: { label: 'Postfach', href: '/os/inbox', farbe: LEUCHT.puls }, gesundheit: { label: 'Gesundheit', href: '/os/gesundheit', farbe: LEUCHT.gut },
  kalender: { label: 'Kalender', href: '/os/kalender', farbe: LEUCHT.schlaf },
};
const STATUS: Record<string, { label: string; farbe: string }> = {
  offen: { label: 'offen', farbe: LEUCHT.achtung }, laeuft: { label: 'läuft', farbe: LEUCHT.puls }, fertig: { label: 'fertig', farbe: LEUCHT.gut }, fehler: { label: 'Fehler', farbe: LEUCHT.kritisch },
  in_arbeit: { label: 'wird übernommen', farbe: LEUCHT.puls }, freigegeben: { label: 'freigegeben', farbe: LEUCHT.gut }, abgelehnt: { label: 'abgelehnt', farbe: C.inkLeise }, fehlgeschlagen: { label: 'fehlgeschlagen', farbe: LEUCHT.kritisch },
};
const her = (iso: string) => { const min = Math.floor((Date.now() - Date.parse(iso)) / 60000); return min < 1 ? 'gerade' : min < 60 ? `vor ${min} min` : min < 1440 ? `vor ${Math.floor(min / 60)} h` : `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`; };

export function StapelView() {
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [auftraege, setAuftraege] = useState<Auftrag[]>([]);
  const [fakten, setFakten] = useState<Fakt[]>([]);
  const [kosten, setKosten] = useState<Kosten | null>(null);
  const [heads, setHeads] = useState<HeadFreigaben[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [offenId, setOffenId] = useState<string | null>(null);
  const [grund, setGrund] = useState<Record<string, string>>({});
  const [meldung, setMeldung] = useState('');
  const [laedt, setLaedt] = useState(true);
  const { state: aufgabenStand, rehydrate } = useTasks();
  const [haekchen, setHaekchen] = useState<Record<string, ReadonlySet<ZoeFeld>>>({});
  /** ZOE-Aufgaben-Vorschlag (Art „aufgabe“) — gesäubert, sonst null. */
  const aufgabenInhalt = (v: Vorschlag) => (v.werkzeug === ZOE_AUFGABE_WERKZEUG && v.bezug?.art === 'aufgabe' ? vorschlagSauber(v.eingabe, v.bezug.id) : null);
  const sammelTauglich = (v: Vorschlag) => risikoarm(aufgabenInhalt(v));

  const laden = useCallback(async () => {
    try {
      const [s, a, g] = await Promise.all([fetch('/api/zoe/stapel?alle=1').then(r => r.json()), fetch('/api/zoe/auftraege').then(r => r.json()), fetch('/api/zoe/gedaechtnis').then(r => r.json())]);
      setVorschlaege(Array.isArray(s.vorschlaege) ? s.vorschlaege : []); setAuftraege(Array.isArray(a.auftraege) ? a.auftraege : []); setFakten(Array.isArray(g.fakten) ? g.fakten : []);
    } catch { /* offline — der alte Stand bleibt */ }
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); fetch('/api/zoe/verbrauch').then(r => r.json()).then(d => { if (d.ok) setKosten(d); }).catch(() => {}); }, [laden]);
  // Die Heads führen ihre Freigaben selbst — hier die Summe, damit EINE Seite zeigt, was überall wartet.
  useEffect(() => {
    let aktiv = true;
    void Promise.all(HEADS_QUELLEN.map(async q => {
      try {
        const d = await fetch(q.api, { cache: 'no-store' }).then(r => r.json());
        const offen = (Array.isArray(d?.vorschlaege) ? d.vorschlaege : []).filter((v: { status?: string }) => v.status === 'offen') as { titel?: string }[];
        return { id: q.id, name: q.name, href: q.href, offen: offen.length, titel: offen.slice(0, 2).map(v => String(v.titel ?? '')).filter(Boolean) };
      } catch { return { id: q.id, name: q.name, href: q.href, offen: 0, titel: [], fehler: true }; }
    })).then(l => { if (aktiv) setHeads(l); });
    return () => { aktiv = false; };
  }, []);
  const headsOffen = heads.reduce((s, h) => s + h.offen, 0);
  const inArbeit = auftraege.filter(a => a.status === 'laeuft' || a.status === 'offen').length;
  useEffect(() => { if (!inArbeit) return; const iv = setInterval(() => { void laden(); }, 5000); return () => clearInterval(iv); }, [inArbeit, laden]);

  async function entscheide(v: Vorschlag, entscheidung: 'freigeben' | 'ablehnen') {
    setBusy(v.id);
    // Häkchen (#94): bei ZOE-Aufgaben-Vorschlägen nur die gewählten Felder.
    const inhalt = entscheidung === 'freigeben' ? aufgabenInhalt(v) : null;
    const auswahl = inhalt ? haekchen[v.id] ?? alleFelder(inhalt) : null;
    const d = await fetch('/api/zoe/stapel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, entscheidung, ...(grund[v.id] ? { grund: grund[v.id] } : {}), ...(inhalt && auswahl ? { eingabe: nurGewaehlt(inhalt, auswahl) } : {}) }) }).then(r => r.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(d.ergebnis ?? (entscheidung === 'ablehnen' ? `Abgelehnt: ${v.titel}` : d.error ?? '')); setBusy(null); if (d.ok !== false) setOffenId(null); void laden();
    if (inhalt) void rehydrate();
  }
  async function alleFreigeben(gruppe?: string) {
    setBusy(gruppe ?? 'alle');
    const d = await fetch('/api/zoe/stapel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alle: true, ...(gruppe ? { gruppe } : {}) }) }).then(r => r.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(d.error ?? `${d.erledigt ?? 0} risikoarme Vorschläge übernommen.${d.einzeln ? ` ${d.einzeln} brauchen einzeln einen Blick (ändern Status/Deadline, CRM oder anderes).` : ''}`); setBusy(null); void laden(); void rehydrate();
  }
  async function chargeZurueck(charge: string) {
    if (!window.confirm('Alle Übernahmen dieser Charge zurücknehmen? Felder, die inzwischen jemand geändert hat, bleiben.')) return;
    setBusy(charge);
    const d = await fetch('/api/aufgaben/zoe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'charge-zurueck', charge }) }).then(r => r.json()).catch(() => ({ ok: false, error: 'nicht erreichbar' }));
    setMeldung(d?.ok ? `${d.bericht?.zurueck ?? 0} zurückgenommen.${d.bericht?.teilweise?.length ? ` ${d.bericht.teilweise.map((x: { titel: string; grund: string }) => `„${x.titel}“: ${x.grund}`).join(' · ')}` : ''}` : (d?.error ?? 'Nicht zurückgenommen.'));
    setBusy(null); void laden(); void rehydrate();
  }
  async function vergiss(id: string) {
    setBusy(id); await fetch(`/api/zoe/gedaechtnis?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {}); setBusy(null); void laden();
  }

  const offen = vorschlaege.filter(v => v.status === 'offen');
  const risikoarmOffen = offen.filter(sammelTauglich);
  const entschieden = vorschlaege.filter(v => v.status !== 'offen').slice(0, 10);
  const gruppen = Array.from(new Set(offen.map(v => v.gruppe)));
  const g = (id: string) => GRUPPE[id] ?? { label: id, href: '/os', farbe: C.inkLeise };

  return (
    <Seite titel="Aufträge & Freigaben" unter="Was ZOE vorbereitet hat und auf dein Ja wartet. Ohne dich passiert nichts." rechts={<Link href="/os/stapel/voll" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Protokoll & Rückgängig ›</Link>}>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}

      <Spalten verhaeltnis="2:1">
        <Spalte>
      <Karte i={0} akzent={offen.length ? LEUCHT.achtung : undefined}>
        <Ueberschrift farbe={offen.length ? LEUCHT.achtung : C.inkLeise} rechts={risikoarmOffen.length > 1 ? <Knopf onClick={() => alleFreigeben()} aus={busy === 'alle'}>{risikoarmOffen.length === offen.length ? `Alle ${offen.length} freigeben` : `${risikoarmOffen.length} risikoarme freigeben`}</Knopf> : `${offen.length} offen`}>Wartet auf dich</Ueberschrift>
        {!laedt && offen.length === 0 && <Leer>Nichts offen. ZOE legt hier ab, was er vorbereitet hat — du entscheidest.</Leer>}
        {gruppen.map(gr => (
          <div key={gr} style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 2px' }}>
              <Punkt farbe={g(gr).farbe} /><span style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.04em', textTransform: 'uppercase' }}>{g(gr).label}</span>
              <Link href={g(gr).href} style={{ fontSize: 12, color: C.inkLeise, textDecoration: 'none' }}>lieber selbst ›</Link>
              {risikoarmOffen.filter(v => v.gruppe === gr).length > 1 && <button onClick={() => alleFreigeben(gr)} disabled={busy === gr} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12 }}>alle in {g(gr).label} freigeben</button>}
            </div>
            <Liste>
              {offen.filter(v => v.gruppe === gr).map(v => (
                <div key={v.id}>
                  <Zeile onClick={() => setOffenId(o => (o === v.id ? null : v.id))} aktiv={offenId === v.id} titel={v.titel} unter={v.anlass ?? `${v.vorher ? `${v.vorher} → ` : ''}${v.nachher}`}
                    rechts={<span style={{ display: 'flex', gap: 6 }}><Knopf onClick={() => entscheide(v, 'freigeben')} aus={busy === v.id} farbe={LEUCHT.gut}>Freigeben</Knopf><Knopf leise onClick={() => entscheide(v, 'ablehnen')} aus={busy === v.id}>Ablehnen</Knopf></span>} />
                  {offenId === v.id && (
                    <div style={{ padding: '6px 2px 16px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: TYP.bedien, color: C.inkDim }}>
                        {v.vorher && <><span style={{ color: C.inkLeise }}>vorher</span><span>{v.vorher}</span></>}
                        <span style={{ color: C.inkLeise }}>nachher</span><span style={{ color: C.ink, fontWeight: 600 }}>{v.nachher}</span>
                        <span style={{ color: C.inkLeise }}>Werkzeug</span><span style={{ fontFamily: SCHRIFT.mono, fontSize: 12 }}>{v.werkzeug}</span>
                        <span style={{ color: C.inkLeise }}>seit</span><span>{her(v.zeit)}</span>
                      </div>
                      {v.bezug?.art === 'aufgabe' && <AufgabeVorschlag v={v} />}
                      {aufgabenInhalt(v) && (
                        <div style={{ marginTop: 10 }}>
                          <FreigabeFelder inhalt={aufgabenInhalt(v)!} aufgabe={aufgabenStand.tasks.find(t => t.id === v.bezug!.id)} stand={zoeStandLesen(v.eingabe._stand)} eigene={aufgabenStand.statusEigen ?? []}
                            gewaehlt={haekchen[v.id] ?? alleFelder(aufgabenInhalt(v)!)} onWahl={f => setHaekchen(h => ({ ...h, [v.id]: f }))} />
                        </div>
                      )}
                      {/* Art „crm“ (28.09., C7): Text zum Kopieren, Mail-Programm, Sprung in die Markttraktion. */}
                      {v.bezug?.art === 'crm' && <CrmStapelDetail v={v} />}
                      <input value={grund[v.id] ?? ''} onChange={e => setGrund(x => ({ ...x, [v.id]: e.target.value }))} placeholder="Grund fürs Ablehnen (optional) — ZOE lernt daraus" style={{ ...feld, marginTop: 12 }} />
                    </div>
                  )}
                </div>
              ))}
            </Liste>
          </div>
        ))}
      </Karte>
        </Spalte>
        <Spalte>
        <Karte i={1}>
          <Ueberschrift farbe={inArbeit ? LEUCHT.puls : C.inkLeise} rechts={inArbeit ? `${inArbeit} in Arbeit` : undefined}>Der Arbeiter</Ueberschrift>
          <Liste>
            {auftraege.length === 0 && <Leer>Noch kein Auftrag.</Leer>}
            {auftraege.slice(0, 8).map(a => <Zeile key={a.id} links={<Punkt farbe={STATUS[a.status]?.farbe ?? C.inkLeise} />} titel={a.auftrag ?? a.name} unter={`${a.name} · ${her(a.zeit)}${a.fehler ? ` · ${a.fehler}` : a.ergebnis ? ` · ${a.ergebnis.slice(0, 80)}` : ''}`} rechts={<Chip farbe={STATUS[a.status]?.farbe ?? C.inkLeise}>{STATUS[a.status]?.label ?? a.status}</Chip>} />)}
          </Liste>
        </Karte>
        <Karte i={2} akzent={headsOffen ? LEUCHT.achtung : undefined}>
          <Ueberschrift farbe={headsOffen ? LEUCHT.achtung : C.inkLeise} rechts={heads.length ? `${headsOffen} offen` : undefined}>Freigaben der Heads</Ueberschrift>
          <Liste>
            {heads.length === 0 && <Leer>Wird gelesen …</Leer>}
            {heads.map(h => (
              <Link key={h.id} href={h.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Zeile onClick={() => {}} links={<Punkt farbe={h.fehler ? C.inkLeise : h.offen ? LEUCHT.achtung : LEUCHT.gut} />} titel={h.name}
                  unter={h.fehler ? 'nicht lesbar' : h.offen ? `${h.offen} offen${h.titel.length ? ` · ${h.titel.join(' · ')}` : ''}` : 'nichts offen'} rechts={<span style={{ color: C.inkLeise }}>›</span>} />
              </Link>
            ))}
          </Liste>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Entschieden wird beim Head selbst — dort steht die Begründung und der Prüfer-Vermerk.</div>
        </Karte>
        <Karte i={3}>
          <Ueberschrift farbe={LEUCHT.schlaf}>Zuletzt entschieden</Ueberschrift>
          <Liste>
            {entschieden.length === 0 && <Leer>Noch nichts entschieden.</Leer>}
            {entschieden.map(v => {
              const charge = v.status === 'freigegeben' && v.werkzeug === ZOE_AUFGABE_WERKZEUG && v.eingabe?._vorher ? (typeof v.eingabe._sammel === 'string' ? v.eingabe._sammel : typeof v.eingabe._charge === 'string' ? v.eingabe._charge : null) : null;
              return <Zeile key={v.id} links={<Punkt farbe={STATUS[v.status]?.farbe ?? C.inkLeise} />} titel={v.titel} unter={`${g(v.gruppe).label} · ${her(v.zeit)}${v.entschiedenVon ? ` · ${v.entschiedenVon}` : ''}${v.grund ? ` · ${v.grund}` : v.ergebnis ? ` · ${v.ergebnis.slice(0, 80)}` : ''}`}
                rechts={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{charge && <button onClick={() => void chargeZurueck(charge)} disabled={busy === charge} title="Alle Übernahmen dieses Laufs bzw. dieser Sammelfreigabe zurücknehmen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12 }}>Charge rückgängig</button>}<Chip farbe={STATUS[v.status]?.farbe ?? C.inkLeise}>{STATUS[v.status]?.label ?? v.status}</Chip></span>} />;
            })}
          </Liste>
        </Karte>
        <Karte i={4}>
          <Ueberschrift farbe={LEUCHT.agenten} rechts={`${fakten.length}`}>Gedächtnis</Ueberschrift>
          <Liste>
            {fakten.length === 0 && <Leer>ZOE hat sich noch nichts gemerkt. Sag ihm „merk dir …“.</Leer>}
            {fakten.slice(0, 10).map(f => <Zeile key={f.id} titel={f.satz} unter={`${f.thema} · ${f.tag}`} rechts={<button onClick={() => vergiss(f.id)} disabled={busy === f.id} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12 }}>vergessen</button>} />)}
          </Liste>
        </Karte>
        <Karte i={4}>
          <Ueberschrift farbe={LEUCHT.geld}>Verbrauch der KI</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
            <Zahl wert={kosten ? eur(kosten.heuteCent / 100) : undefined} label="heute" farbe={LEUCHT.geld} />
            <Zahl wert={kosten ? eur(kosten.summeCent / 100) : undefined} label="insgesamt" />
          </div>
          {(kosten?.jeZweck ?? []).slice(0, 5).map(z => (
            <div key={z.zweck} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,130px) 1fr 64px', alignItems: 'center', gap: 10, padding: '4px 0' }}>
              <span style={{ fontSize: 12.5, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.zweck}</span>
              <Fortschritt anteil={z.cent / Math.max(kosten!.jeZweck[0]?.cent ?? 1, 1)} farbe={LEUCHT.geld} />
              <span style={{ fontFamily: SCHRIFT.display, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: C.inkDim, textAlign: 'right' }}>{eur(z.cent / 100)}</span>
            </div>
          ))}
        </Karte>
        </Spalte>
      </Spalten>
    </Seite>
  );
}

/** Art „aufgabe“ (Paket C4): was ZOE an der Aufgabe übernehmen würde — nur Text, Link zur Aufgabe. */
function AufgabeVorschlag({ v }: { v: Vorschlag }) {
  const e = v.eingabe;
  const entwurf = typeof e.entwurf === 'string' ? e.entwurf : '';
  const unter = Array.isArray(e.unteraufgaben) ? e.unteraufgaben.filter((x): x is string => typeof x === 'string') : [];
  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}>
      {entwurf && <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 12px', maxHeight: 240, overflowY: 'auto', lineHeight: 1.5 }}>{entwurf}</div>}
      {unter.length > 0 && <ul style={{ margin: 0, paddingLeft: 18 }}>{unter.map(u => <li key={u}>{u}</li>)}</ul>}
      <Link href={WEG.aufgabe(v.bezug!.id)} style={{ fontSize: 12.5, color: C.aktiv, textDecoration: 'none' }}>Aufgabe öffnen ›</Link>
    </div>
  );
}
