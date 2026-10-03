'use client';

// ─── Gesprächsmodus — die Ansicht fürs Telefonat (03.10.) ───────────────────────────────────────
// Kevin: „Fragen der Reihe nach, Notizen nebenbei, am Ende ein Klick ‚Ergebnis‘: SQL / weiter qualifizieren / parken / raus.“
//   · Die Fragen sind die Sales-Kriterien aus den Scoring-Einstellungen (nicht mehr fest im Code); jede Antwort schreibt sofort
//     die Stufe am Lead, der Score rechnet live mit.
//   · Die Notizen laufen nebenbei (im Browser gesichert, bis das Ergebnis feststeht) und werden als Aktivität „Gespräch“ an
//     die Person gehängt — mit den Antworten als Erkenntnisse.
//   · Das Ergebnis setzt Status und nächste Handlung: SQL → Deal anlegen · weiter qualifizieren (nächster Schritt mit Datum
//     Pflicht) · parken (Wiedervorlage) · raus (mit Grund).
// Am Handy (375 px) bedienbar: eine Hauptaktion je Schritt, Ziele ≥ 44 px, Eingaben 16 px.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../../schlank';
import { localDay } from '@/lib/zeit';
import { anzeigename } from '@/lib/make-one/crm';
import { ampel as kanalAmpel } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { gespraechsFragen, type ScoringEinstellungen } from '@/lib/crm/scoring';
import { fehltBisSqlZeile, salesBereit, type LeadZeile } from '@/lib/crm/leads';
import type { LeadScore } from '@/lib/crm/score';
import type { CrmApi } from '../daten';
import { plusTage } from '../daten';
import { KanalAmpel } from '../teile';
import { DealAnlegen } from '../DealAnlegen';
import { ParkenDialog, RausDialog, type WeiterInfo } from './KleineDialoge';
import { SeitenChip } from './ScoreAnzeige';
import { leadPost, punkteText } from './hilfen';

type Ergebnis = 'sql' | 'weiter' | null;
const merker = (id: string) => `quali-gespraech-${id}`;

export function Gespraechsmodus({ api, z, einstellungen, score, stufen, antworten, onStufe, onAntwort, onZu, onFertig }: {
  api: CrmApi; z: LeadZeile; einstellungen: ScoringEinstellungen; score: LeadScore;
  stufen: Record<string, string>; antworten: Record<string, string>;
  onStufe: (kriteriumId: string, stufeId: string | null) => void; onAntwort: (kriteriumId: string, text: string) => void;
  onZu: () => void; onFertig: (i: WeiterInfo) => void;
}) {
  const heute = api.crm?.heute ?? localDay();
  const fragen = useMemo(() => gespraechsFragen(einstellungen), [einstellungen]);
  const ergebnis = useMemo(() => new Map((score.scoring?.sales.teile ?? []).flatMap(t => t.kriterien).map(k => [k.id, k])), [score]);
  // Beginnen bei der ersten Frage ohne eigene Antwort — wer schon qualifiziert hat, setzt dort fort.
  const [i, setI] = useState(() => { const n = fragen.findIndex(f => { const e = ergebnis.get(f.kriterium.id); return !e || e.herkunft === 'ohne' || e.herkunft === 'messung'; }); return n < 0 ? 0 : n; });
  const letzte = i >= fragen.length;
  const [partnerId, setPartnerId] = useState(z.hauptKontaktId ?? z.personen[0]?.id ?? '');
  const partner = (api.kontakte ?? []).find(k => k.id === partnerId);
  const [notiz, setNotiz] = useState(() => { try { return sessionStorage.getItem(merker(z.id)) ?? ''; } catch { return ''; } });
  const [beruehrt, setBeruehrt] = useState(false);
  const [text, setText] = useState<Record<string, string>>(antworten);
  const [weg, setWeg] = useState<'ergebnis' | 'parken' | 'raus' | null>(null);
  const [erg, setErg] = useState<Ergebnis>(null);
  const [trotzdem, setTrotzdem] = useState(false);
  const [schritt, setSchritt] = useState({ text: 'Nachfassen', datum: plusTage(heute, 7) });
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const kopf = useRef<HTMLDivElement>(null);

  useEffect(() => { try { if (notiz) sessionStorage.setItem(merker(z.id), notiz); else sessionStorage.removeItem(merker(z.id)); } catch { /* ohne Speicher: nur im Fenster */ } }, [notiz, z.id]);
  useEffect(() => { kopf.current?.scrollIntoView?.({ block: 'start' }); }, [i, erg]);
  // M3: auf dem Ergebnis-Schirm ohne Wahl zu schließen kostet nichts — aber nie still: kurze Rückfrage. Ein SQL-bereiter Lead bleibt dann in der Runde
  // („SQL bereit — Entscheidung offen“), er geht nicht verloren.
  const schliessen = useRef(() => {});
  schliessen.current = () => {
    if (letzte && !window.confirm('Noch kein Ergebnis gewählt (Deal, weiter qualifizieren, parken oder raus). Der Lead bleibt in der Runde und wartet auf die Entscheidung. Trotzdem schließen?')) return;
    onZu();
  };
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]:not([data-gespraech])')) { e.preventDefault(); schliessen.current(); } };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);

  const offenerDeal = !!api.crm?.stand.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && partner && c.kontaktIds.includes(partner.id));
  const ampel = useMemo(() => (partner ? kanalAmpel(partner, { hatMandat: false, hatChance: offenerDeal }) : []), [partner, offenerDeal]);
  const bereit = salesBereit({ kriterien: z.kriterien, score });
  const fehlt = fehltBisSqlZeile({ kriterien: z.kriterien, score });

  const aktuelle = !letzte ? fragen[i] : null;
  const e = aktuelle ? ergebnis.get(aktuelle.kriterium.id) : undefined;
  const gewaehlt = aktuelle ? stufen[aktuelle.kriterium.id] ?? (e && (e.herkunft === 'alt' || e.herkunft === 'lead') ? e.stufeId : undefined) : undefined;

  /** Das Gespräch als Aktivität an die Person: Notiz nebenbei + die Antworten als Erkenntnisse; mit nächstem Schritt, wenn das Ergebnis einen setzt. */
  const festhalten = async (naechster?: { text: string; datum: string }): Promise<boolean> => {
    if (!partner || (!beruehrt && !notiz.trim() && !naechster)) return true;
    const antwortenText = fragen.map(f => { const x = ergebnis.get(f.kriterium.id); return x && x.herkunft === 'lead' && x.stufeText ? `${f.kriterium.name}: ${x.stufeText}` : ''; }).filter(Boolean).join(' · ');
    const r = await api.aktivitaet({
      id: partner.id, art: 'gespraech', ergebnis: 'gespraech', text: notiz.trim().split('\n')[0].slice(0, 200) || 'Qualifizierungsgespräch',
      notiz: { ...(notiz.trim() ? { erkenntnisse: notiz.trim().slice(0, 1500) } : {}), ...(antwortenText ? { signale: antwortenText.slice(0, 1500) } : {}), bedarf: z.name.slice(0, 200) },
      ...(naechster ? { naechster } : {}),
    });
    if (!r.ok && !r.kontakt) { setMeldung(r.error ?? r.fehler ?? 'Das Gespräch konnte nicht festgehalten werden.'); return false; }
    return true;
  };
  const sauber = () => { try { sessionStorage.removeItem(merker(z.id)); } catch { /* egal */ } };

  const weiterQualifizieren = async () => {
    if (!schritt.text.trim() || !schritt.datum || laeuft) return;
    setLaeuft(true); setMeldung('');
    try {
      if (!(await festhalten({ text: schritt.text.trim(), datum: schritt.datum }))) return;
      const aktiv = ['neu', 'kontaktiert', 'im_gespraech'].includes(z.status);
      await leadPost({ aktion: 'setze', id: z.id, felder: { geprueft: true, ...(aktiv ? { status: 'qualifizierung' } : {}) } });
      await api.laden(true); sauber();
      onFertig({ text: `Gespräch festgehalten — nächster Schritt: ${schritt.text.trim()} am ${schritt.datum.slice(8, 10)}.${schritt.datum.slice(5, 7)}.`, weiter: true });
    } finally { setLaeuft(false); }
  };
  const zumSql = async () => { setLaeuft(true); setMeldung(''); try { if (await festhalten()) setErg('sql'); } finally { setLaeuft(false); } };
  const nachParkenOderRaus = async (info: WeiterInfo) => { await festhalten(); sauber(); onFertig(info); };

  const fortschritt = fragen.length ? Math.min(100, Math.round((100 * Math.min(i, fragen.length)) / fragen.length)) : 100;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Gespräch mit ${z.name}`} data-gespraech style={{ position: 'fixed', inset: 0, zIndex: 95, background: C.grund, color: C.ink, fontFamily: SCHRIFT.text, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column' }}>
      <div ref={kopf} style={{ position: 'sticky', top: 0, zIndex: 2, background: C.grund, borderBottom: '1px solid rgba(255,255,255,.08)', padding: '12px max(16px, env(safe-area-inset-left))', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>Gespräch</div>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name}</div>
          </div>
          <button onClick={() => schliessen.current()} aria-label="Gesprächsmodus schließen" className="fassbar" style={{ flex: '0 0 auto', width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {score.scoring && <SeitenChip s={score.scoring.sales} name="SQL" kurz />}
          <span style={{ fontSize: 12, color: C.inkLeise }}>Score {score.punkte}</span>
          <div role="progressbar" aria-valuenow={fortschritt} aria-valuemin={0} aria-valuemax={100} aria-label="Fortschritt" style={{ flex: '1 1 80px', height: 4, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><div style={{ width: `${fortschritt}%`, height: '100%', background: LEUCHT.business, transition: 'width .25s' }} /></div>
        </div>
      </div>

      <div style={{ flex: 1, width: 'min(720px, 100%)', margin: '0 auto', padding: '16px max(16px, env(safe-area-inset-left)) 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16, alignContent: 'start', minWidth: 0 }}>
        {/* Wer spricht — mit den Wegen, die zulässig sind (Telefon, Mail, LinkedIn) */}
        <div style={{ display: 'grid', gap: 8 }}>
          {z.personen.length > 1 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{z.personen.map(p => <button key={p.id} type="button" aria-pressed={partnerId === p.id} onClick={() => setPartnerId(p.id)} className="fassbar" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, color: C.ink, border: `1px solid ${partnerId === p.id ? LEUCHT.business : 'rgba(255,255,255,.12)'}`, background: partnerId === p.id ? `${LEUCHT.business}1F` : 'rgba(255,255,255,.04)' }}>{p.name}{p.id === z.hauptKontaktId ? ' ★' : ''}</button>)}</div>}
          {partner && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{anzeigename(partner)}{partner.position ? ` · ${partner.position}` : ''}</span><KanalAmpel ampel={ampel} ziele={{ telefon: partner.telefon ?? partner.sms, email: partner.email, linkedin: partner.linkedin }} /></div>}
        </div>

        {erg === 'sql' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: TYP.body, fontWeight: 700 }}>Deal anlegen — SQL</div>
            {!bereit && <div style={{ fontSize: 12.5, color: LEUCHT.achtung }}>Noch nicht alle SQL-Kriterien erfüllt (fehlt: {fehlt.join(', ')}) — der Deal entsteht trotzdem, das steht dann im Lead vermerkt.</div>}
            <DealAnlegen api={api} {...(partner ? { kontaktId: partner.id } : {})} {...(z.firmaId ? { firmaId: z.firmaId } : {})} quelle="empfehlung"
              onFertig={async () => {
                if (!bereit) await leadPost({ aktion: 'setze', id: z.id, felder: { notiz: `${z.notiz ? `${z.notiz}\n` : ''}SQL ohne alle Kriterien angelegt (${fehlt.join(', ')} offen).` } });
                await api.laden(true); sauber(); onFertig({ text: `SQL: Der Deal für „${z.name}“ steht unter Deals.`, weiter: true });
              }}
              onAbbruch={() => setErg(null)} />
          </div>
        ) : erg === 'weiter' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: TYP.body, fontWeight: 700 }}>Weiter qualifizieren — wie geht es weiter?</div>
            <input value={schritt.text} onChange={x => setSchritt({ ...schritt, text: x.target.value })} placeholder="Nächster Schritt (Pflicht)" aria-label="Nächster Schritt" maxLength={300} style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
            <input type="date" value={schritt.datum} min={heute} onChange={x => setSchritt({ ...schritt, datum: x.target.value })} aria-label="Datum" style={{ ...feld, fontSize: 16, padding: '10px 12px', width: 'auto' }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[['Morgen', 1], ['In 3 Tagen', 3], ['In einer Woche', 7], ['In 2 Wochen', 14]].map(([l, t]) => <button key={l as string} type="button" onClick={() => setSchritt({ ...schritt, datum: plusTage(heute, t as number) })} className="fassbar" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, color: C.inkDim, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)' }}>{l}</button>)}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf leise onClick={() => setErg(null)}>Zurück</Knopf><Knopf aus={!schritt.text.trim() || !schritt.datum || laeuft} onClick={() => weiterQualifizieren()}>Gespräch festhalten</Knopf></div>
          </div>
        ) : letzte ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={{ fontFamily: SCHRIFT.display, fontSize: 24, fontWeight: 700, letterSpacing: '-.02em' }}>Ergebnis</div>
              <div style={{ fontSize: TYP.body, color: C.inkDim, marginTop: 4, lineHeight: 1.5 }}>
                {score.scoring ? <>Sales-Punkte <b style={{ color: C.ink }}>{punkteText(score.scoring.sales.punkte)}</b> von mindestens {punkteText(score.scoring.sales.schwelle)} (möglich {punkteText(score.scoring.sales.max)}).</> : null}{' '}
                {bereit ? 'Alle SQL-Kriterien sind erfüllt.' : `Bis SQL fehlt: ${fehlt.join(', ') || '—'}.`}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {bereit
                ? <Knopf farbe={LEUCHT.gut} onClick={() => zumSql()}>SQL → Deal anlegen</Knopf>
                : trotzdem ? <Knopf farbe={LEUCHT.gut} onClick={() => zumSql()}>Trotzdem als SQL übergeben</Knopf> : <Knopf leise onClick={() => setTrotzdem(true)}>Trotzdem als SQL übergeben …</Knopf>}
              <Knopf onClick={() => { setMeldung(''); setErg('weiter'); }}>Weiter qualifizieren</Knopf>
              <Knopf leise onClick={() => setWeg('parken')}>Parken (Wiedervorlage)</Knopf>
              <Knopf leise onClick={() => setWeg('raus')}>Raus — Kein Fit</Knopf>
            </div>
            <div style={{ display: 'flex', gap: 8 }}><Knopf leise onClick={() => setI(fragen.length - 1)}>← Zur letzten Frage</Knopf></div>
          </div>
        ) : aktuelle && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12.5, color: C.inkLeise }}>Frage {i + 1} von {fragen.length} · {aktuelle.teil}</div>
              <div style={{ fontFamily: SCHRIFT.display, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2 }}>{aktuelle.kriterium.name}</div>
              {aktuelle.kriterium.hinweis && <div style={{ fontSize: 17, color: C.inkDim, marginTop: 6, lineHeight: 1.5 }}>{aktuelle.kriterium.hinweis}</div>}
            </div>
            <div role="radiogroup" aria-label={aktuelle.kriterium.name} style={{ display: 'grid', gap: 8 }}>
              {[...aktuelle.kriterium.stufen].sort((a, b) => b.punkte - a.punkte).map(s => {
                const an = gewaehlt === s.id;
                return (
                  <button key={s.id} type="button" role="radio" aria-checked={an} onClick={() => { setBeruehrt(true); onStufe(aktuelle.kriterium.id, an ? null : s.id); }} className="fassbar"
                    style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 12, alignItems: 'center', minHeight: 56, padding: '10px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, fontSize: 16, color: C.ink, border: `1px solid ${an ? LEUCHT.business : 'rgba(255,255,255,.12)'}`, background: an ? `${LEUCHT.business}22` : 'rgba(255,255,255,.04)' }}>
                    <b style={{ minWidth: 30, textAlign: 'center', fontSize: 18, fontVariantNumeric: 'tabular-nums', color: an ? LEUCHT.business : C.inkDim }}>{punkteText(s.punkte)}</b>
                    <span style={{ lineHeight: 1.4 }}>{s.text}</span>
                  </button>
                );
              })}
            </div>
            <textarea value={text[aktuelle.kriterium.id] ?? ''} onChange={x => { setBeruehrt(true); setText(a => ({ ...a, [aktuelle.kriterium.id]: x.target.value })); }}
              onBlur={() => { const k = aktuelle.kriterium.id; if ((text[k] ?? '') !== (antworten[k] ?? '')) onAntwort(k, text[k] ?? ''); }}
              rows={2} maxLength={1000} placeholder="Was genau — Zahlen, Beispiel, Zitat (optional) …" aria-label={`${aktuelle.kriterium.name} — was genau`} style={{ ...feld, fontSize: 16, padding: '10px 12px', width: '100%', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Knopf leise aus={i === 0} onClick={() => setI(Math.max(0, i - 1))}>← Zurück</Knopf>
              <Knopf onClick={() => { const k = aktuelle.kriterium.id; if ((text[k] ?? '') !== (antworten[k] ?? '')) onAntwort(k, text[k] ?? ''); setI(i + 1); }}>{gewaehlt ? 'Weiter →' : 'Überspringen →'}</Knopf>
            </div>
            {e && e.herkunft === 'messung' && e.stufeText && <div style={{ fontSize: 12, color: C.inkLeise }}>Aus der Liste vorbelegt: {e.stufeText} — tippen, um es im Gespräch zu bestätigen oder zu ändern.</div>}
          </div>
        )}

        {meldung && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</div>}

        <div style={{ display: 'grid', gap: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <label htmlFor="gm-notiz" style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>Notizen nebenbei</label>
          <textarea id="gm-notiz" value={notiz} onChange={x => { setBeruehrt(true); setNotiz(x.target.value); }} rows={4} maxLength={1500} placeholder="Was im Gespräch fällt — wird als Gespräch an der Person festgehalten, sobald das Ergebnis feststeht." style={{ ...feld, fontSize: 16, padding: '10px 12px', width: '100%', resize: 'vertical', lineHeight: 1.5 }} />
          <div style={{ fontSize: 12, color: C.inkLeise }}>Im Browser gesichert, bis es festgehalten ist. Gespeichert wird die Notiz an {partner ? anzeigename(partner) : 'der Person'} — Personendaten, bitte nur, was fürs Geschäft nötig ist (nichts zu Gesundheit, Religion, Politik).</div>
        </div>
      </div>
      {weg === 'parken' && <ParkenDialog api={api} z={z} onZu={() => setWeg(null)} onFertig={i2 => void nachParkenOderRaus(i2)} />}
      {weg === 'raus' && <RausDialog api={api} z={z} onZu={() => setWeg(null)} onFertig={i2 => void nachParkenOderRaus(i2)} />}
    </div>
  );
}
