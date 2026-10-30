'use client';

// ─── Markttraktion · Marketing › Innovations-Check (24.10., Branch `innovations-check`) ─────────────────────────
// Die eine interne Stelle des Website-Checks: ein-/ausschalten (nur der Inhaber; kommt AUS, einschalten nur mit Verantwortlichem
// der Instanz), Buchungsseite für das Erstgespräch wählen, Name und Leitsatz, je Bereich (Sichtbarkeit · Vertrieb · Innovation) das
// passende Angebot unter dem nächsten Schritt im Ergebnis (30.10.), eingegangene Checks sehen (Stufe, Säulen, Lead-Klasse, Kontakt,
// CRM-Stand) und die Beleg-Antworten (C5, D6) nach Rubrik bewerten — die Stufe rechnet danach neu. Zahlen nur vom Server
// (lib/check/auswertung.ts). Nichts geht von hier an den Teilnehmer.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Raster, Zahl, Hinweis, Schalter, LEUCHT, useRueckfrage } from '../../ui';
import { WEG } from '@/lib/wege';
import { datum } from '../daten';

interface ZeileDaten {
  id: string; gestartet: string; geaendert: string; quelle: string | null; beantwortet: number;
  kontaktStand: 'offen' | 'erfasst' | 'uebersprungen';
  kontakt: { vorname: string; firma: string; email: string; telefon: string | null; newsletterWunsch: boolean } | null;
  ergebnis: { gesamt: number; stufe: number; stufeName: string; genauigkeit: 'genau' | 'vorlaeufig'; saeulen?: Partial<Record<Bereich, number>>; lead: { punkte: number; klasse: 'A' | 'B' | 'C' } } | null;
  abgeschlossen: string | null;
  crm: { status: 'ok' | 'abgelehnt' | 'fehler'; kontaktId: string | null; grund?: string } | null;
  belegeOffen: number;
}
interface Daten {
  einstellungen: { aktiv: boolean; buchungSlug?: string; gastgeber?: string; marke?: string; claim?: string; angebote?: Partial<Record<Bereich, Angebot>> };
  verantwortlichDa: boolean;
  buchungsseiten: { slug: string; titel: string }[];
  liste: ZeileDaten[];
}
interface Detail { antworten: { frage: string; text: string; typ: string; abschnitt: string; auswahl: string[]; freitext?: string; optionText?: string; rubrik?: [number, string][]; belegScore?: number }[] }

const KLASSE_FARBE: Record<string, string> = { A: LEUCHT.gut, B: LEUCHT.achtung, C: C.inkLeise };

type Bereich = 'sichtbarkeit' | 'vertrieb' | 'innovation';
type Angebot = { titel: string; text?: string; link?: string };
const BEREICHE: { key: Bereich; name: string }[] = [{ key: 'sichtbarkeit', name: 'Sichtbarkeit' }, { key: 'vertrieb', name: 'Vertrieb' }, { key: 'innovation', name: 'Innovation' }];
const FELD = { minHeight: 44, borderRadius: 8, background: C.flaeche, color: C.ink, border: `1px solid ${C.linie}`, padding: '0 10px', fontSize: 16 } as const;

/** Das Angebot eines Bereichs: Titel, ein Satz, Link (Seite der eigenen Website `/…` oder https). Leerer Titel = kein Angebot. */
function AngebotFeld({ bereich, name, wert, speichern }: { bereich: Bereich; name: string; wert?: Angebot; speichern: (b: Bereich, a: Angebot | null) => Promise<void> }) {
  const [titel, setTitel] = useState(wert?.titel ?? '');
  const [text, setText] = useState(wert?.text ?? '');
  const [link, setLink] = useState(wert?.link ?? '');
  const geaendert = titel !== (wert?.titel ?? '') || text !== (wert?.text ?? '') || link !== (wert?.link ?? '');
  return (
    <form style={{ display: 'grid', gap: 6, paddingTop: 10, borderTop: `1px solid ${C.linie}` }}
      onSubmit={e => { e.preventDefault(); void speichern(bereich, titel.trim() ? { titel: titel.trim(), text: text.trim(), link: link.trim() } : null); }}>
      <span style={{ fontWeight: 600, color: C.ink }}>{name}</span>
      <input aria-label={`${name}: Titel des Angebots`} value={titel} onChange={e => setTitel(e.target.value)} maxLength={80} placeholder="Titel, z. B. Vertriebsaufbau" style={FELD} />
      <input aria-label={`${name}: ein Satz`} value={text} onChange={e => setText(e.target.value)} maxLength={240} placeholder="Ein Satz, was es bringt (freiwillig)" style={FELD} />
      <input aria-label={`${name}: Link`} value={link} onChange={e => setLink(e.target.value)} maxLength={300} placeholder="Link, z. B. /vertrieb/ oder https://…" style={FELD} />
      <div><Knopf leise typ="submit" aus={!geaendert}>Speichern</Knopf></div>
    </form>
  );
}

async function senden(body: Record<string, unknown>): Promise<{ ok: boolean; fehler?: string }> {
  const r = await fetch('/api/check/intern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok && d.ok !== false, fehler: d.fehler };
}

export function Checks({ zuKontakt }: { zuKontakt: (id: string) => void }) {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = useCallback(async () => {
    const r = await fetch('/api/check/intern', { cache: 'no-store' });
    const x = await r.json().catch(() => ({}));
    if (r.ok && x.ok) setD(x as Daten); else setFehler(String(x.fehler ?? 'Die Checks ließen sich nicht laden.'));
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => {
    setDetail(null);
    if (!offen) return;
    void fetch(`/api/check/intern?id=${encodeURIComponent(offen)}`, { cache: 'no-store' }).then(r => r.json()).then(x => { if (x.ok) setDetail(x.sitzung as Detail); });
  }, [offen]);

  const tun = async (body: Record<string, unknown>) => {
    setFehler('');
    const r = await senden(body);
    if (!r.ok) setFehler(r.fehler ?? 'Das hat nicht geklappt.');
    await laden();
    if (offen && body.id === offen) { const x = await fetch(`/api/check/intern?id=${encodeURIComponent(offen)}`, { cache: 'no-store' }).then(y => y.json()); if (x.ok) setDetail(x.sitzung as Detail); }
  };

  if (!d) return <Karte><Leer>{fehler || 'Lade die Checks …'}</Leer></Karte>;
  const mitKontakt = d.liste.filter(z => z.kontakt).length;
  const fertig = d.liste.filter(z => z.abgeschlossen).length;
  const belege = d.liste.reduce((n, z) => n + z.belegeOffen, 0);

  return (
    <>
      {dialog}
      <Karte>
        <Ueberschrift>Innovations-Check der Website</Ueberschrift>
        {!d.verantwortlichDa && (
          <Hinweis art="achtung" titel="Verantwortlicher fehlt">
            Ohne Verantwortlichen der Instanz bleibt der Check zu. <Link href={WEG.datenschutz('verantwortlicher')} style={{ color: C.aktiv }}>Jetzt eintragen</Link>
          </Hinweis>
        )}
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          <Schalter an={d.einstellungen.aktiv} onChange={an => void tun({ aktion: 'einstellungen', aktiv: an })} aus={!d.verantwortlichDa && !d.einstellungen.aktiv}
            erklaerungOhne="Öffentlich erreichbar unter /check, auch unter fokusinnovation.de/check. Kommt ausgeschaltet; ausgeschaltet antwortet die Seite mit „gibt es nicht“.">
            Check öffentlich
          </Schalter>
          <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>
            Buchungsseite für das Erstgespräch
            <select value={d.einstellungen.buchungSlug ?? ''} onChange={e => void tun({ aktion: 'einstellungen', buchungSlug: e.target.value || null })}
              style={{ minHeight: 44, borderRadius: 8, background: C.flaeche, color: C.ink, border: `1px solid ${C.linie}`, padding: '0 10px', fontSize: 16 }}>
              <option value="">— keine (Termin per Rückmeldung) —</option>
              {d.buchungsseiten.map(s => <option key={s.slug} value={s.slug}>{s.titel}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>
            Name im Check (z. B. die Marke der Website)
            <input defaultValue={d.einstellungen.marke ?? ''} placeholder="ohne Angabe: Name der Firma" maxLength={60}
              onBlur={e => { const v = e.target.value.trim(); if (v !== (d.einstellungen.marke ?? '')) void tun({ aktion: 'einstellungen', marke: v || null }); }}
              style={{ minHeight: 44, borderRadius: 8, background: C.flaeche, color: C.ink, border: `1px solid ${C.linie}`, padding: '0 10px', fontSize: 16 }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>
            Leitsatz unter dem Namen
            <input defaultValue={d.einstellungen.claim ?? ''} placeholder="ohne Angabe: keiner" maxLength={80}
              onBlur={e => { const v = e.target.value.trim(); if (v !== (d.einstellungen.claim ?? '')) void tun({ aktion: 'einstellungen', claim: v || null }); }}
              style={FELD} />
          </label>
          {d.einstellungen.aktiv && <Knopf leise href="/check">Check ansehen</Knopf>}
        </div>
        {fehler && <p role="alert" style={{ color: LEUCHT.kritisch, margin: '10px 0 0' }}>{fehler}</p>}
      </Karte>

      <Karte>
        <Ueberschrift>Angebote im Ergebnis</Ueberschrift>
        <p style={{ color: C.inkDim, fontSize: TYP.bedien, margin: '0 0 4px' }}>Das Ergebnis nennt für die zwei schwächsten Bereiche einen nächsten Schritt. Darunter steht, was ihr dazu anbietet.</p>
        <div style={{ display: 'grid', gap: 12 }}>
          {BEREICHE.map(x => <AngebotFeld key={`${x.key}-${d.einstellungen.angebote?.[x.key]?.titel ?? ''}`} bereich={x.key} name={x.name} wert={d.einstellungen.angebote?.[x.key]}
            speichern={async (b, a) => { await tun({ aktion: 'einstellungen', angebote: { [b]: a } }); }} />)}
        </div>
      </Karte>

      <Raster min={160}>
        <Karte><Zahl wert={String(d.liste.length)} label="Checks gestartet" /></Karte>
        <Karte><Zahl wert={String(fertig)} label="mit Ergebnis" /></Karte>
        <Karte><Zahl wert={String(mitKontakt)} label="mit Kontakt" /></Karte>
        <Karte><Zahl wert={String(belege)} label="Belege zu bewerten" farbe={belege ? LEUCHT.achtung : undefined} /></Karte>
      </Raster>

      <Karte>
        <Ueberschrift>Eingegangen</Ueberschrift>
        {!d.liste.length ? <Leer>Noch keine Checks. Sobald jemand den Check auf der Website startet, steht er hier.</Leer> : (
          <Liste>
            {d.liste.map(z => (
              <div key={z.id}>
                <Zeile
                  aktiv={offen === z.id}
                  onClick={() => setOffen(o => (o === z.id ? null : z.id))}
                  titel={z.kontakt ? `${z.kontakt.vorname} · ${z.kontakt.firma}` : z.kontaktStand === 'uebersprungen' ? 'ohne Kontaktdaten' : 'unterwegs'}
                  unter={[
                    z.ergebnis ? `Stufe ${z.ergebnis.stufe} · ${z.ergebnis.stufeName} · ${z.ergebnis.gesamt}/100${z.ergebnis.genauigkeit === 'vorlaeufig' ? ' (vorläufig)' : ''}` : `${z.beantwortet} Antworten`,
                    z.ergebnis?.saeulen ? BEREICHE.filter(x => z.ergebnis!.saeulen![x.key] !== undefined).map(x => `${x.name} ${z.ergebnis!.saeulen![x.key]}`).join(' · ') : null,
                    z.quelle ? `über ${z.quelle}` : null,
                    datum(z.geaendert.slice(0, 10)),
                  ].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'inline-flex', gap: 6 }}>
                    {z.ergebnis && <Chip farbe={KLASSE_FARBE[z.ergebnis.lead.klasse]}>{z.ergebnis.lead.klasse}-Lead</Chip>}
                    {z.belegeOffen > 0 && <Chip farbe={LEUCHT.achtung}>Beleg</Chip>}
                    {z.crm && z.crm.status !== 'ok' && <Chip farbe={LEUCHT.kritisch}>CRM</Chip>}
                  </span>}
                />
                {offen === z.id && (
                  <div style={{ padding: '8px 4px 16px', display: 'grid', gap: 10 }}>
                    {z.kontakt && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{z.kontakt.email}{z.kontakt.telefon ? ` · ${z.kontakt.telefon}` : ''}{z.kontakt.newsletterWunsch ? ' · möchte den Newsletter (noch ohne Bestätigung)' : ''}</div>}
                    {z.crm?.status !== 'ok' && z.crm?.grund && <Hinweis art="kritisch" titel="Nicht im CRM">{z.crm.grund}</Hinweis>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {z.crm?.status === 'ok' && z.crm.kontaktId && <Knopf leise onClick={() => zuKontakt(z.crm!.kontaktId!)}>Zur Person</Knopf>}
                      {z.kontakt && z.crm?.status !== 'ok' && <Knopf leise onClick={async () => { await tun({ aktion: 'crm', id: z.id }); }}>Ins CRM übernehmen</Knopf>}
                      <Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'Diesen Check endgültig löschen?', text: 'Antworten und Ergebnis sind danach weg. Ein Kontakt im CRM bleibt.', ja: 'Endgültig löschen', gefahr: true })) { await tun({ aktion: 'loeschen', id: z.id }); setOffen(null); } }}>Löschen</Knopf>
                    </div>
                    {!detail ? <Leer>Lade die Antworten …</Leer> : detail.antworten.map(a => (
                      <div key={a.frage} style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 8 }}>
                        <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{a.frage} · {a.text}</div>
                        <div style={{ color: C.ink, whiteSpace: 'pre-wrap' }}>{a.freitext ?? [a.auswahl.join(', '), a.optionText].filter(Boolean).join(': ')}</div>
                        {a.typ === 'beleg' && a.freitext && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {(a.rubrik ?? []).map(([p, t]) => (
                              <Knopf key={p} leise={a.belegScore !== p} titel={t} onClick={async () => { await tun({ aktion: 'beleg', id: z.id, frage: a.frage, score: p }); }}>{`${p} · ${t}`}</Knopf>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Liste>
        )}
      </Karte>
    </>
  );
}
