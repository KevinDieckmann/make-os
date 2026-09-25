'use client';

// ─── Ein Head in der Markttraktion: Lauf, Vorschläge, Lernen, Gedächtnis ────
// Oben: Status, Qualität (Annahmequote, Wirkung, Läufe mit/ohne KI) und der
// Lauf-Knopf. Jeder Vorschlag zeigt, für wen er ist, ob er vom Modell oder
// vom Regelwerk stammt und was die Qualitätsprüfung bemängelt hat.
// Annehmen: der Entwurf lässt sich vorher bearbeiten — so wie ihr ihn
// übernehmt, lernt der Head euren Ton. Ablehnen: ein Tipp auf den Grund —
// daraus lernt er, was nicht passt. Mit Person und Frist wird ein angenommener
// Vorschlag deren nächster Schritt (Power Hour), sonst eine Aufgabe für die
// Person, für die er ist. Das Gedächtnis: Merksätze, die der Head wie Regeln
// befolgt. Selbst erledigt (Kevin 25.09.): interne Kleinigkeiten übernimmt
// der Head selbst — sichtbar in „Selbst erledigt“, mit Rückgängig und An/Aus.
// Versendet wird nichts.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, LEUCHT } from '../schlank';
import type { HeadVorschlag, HeadBericht } from '@/lib/heads/stand';
import type { Merksatz } from '@/lib/heads/lernen';
import { datum } from './daten';
import { Person } from './team';
import { nameVon } from '@/lib/crm/team';

interface Qualitaet { laeufe: number; mitKi: number; regelwerk: number; annahmequote: number | null; entschieden: number; wirkung: string | null; gestrichen: number; korrigiert: number; aenderungsgrad: number | null; cent: number; cacheQuote: number | null }
interface Stand {
  ok: boolean; name: string; modi: { id: string; label: string }[]; vorschlaege: HeadVorschlag[]; berichte: HeadBericht[]; ruhig: { zeit: string; text: string } | null;
  gedaechtnis: Merksatz[]; hinweise: string[]; ablehngruende: { id: string; label: string }[]; qualitaet: Qualitaet; autonomie: 'intern' | 'aus'; auto: HeadVorschlag[];
}
const STATUS_FARBE = { ruhig: LEUCHT.gut, beobachten: LEUCHT.achtung, handeln: LEUCHT.kritisch } as const;
const feld = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 11px', color: C.ink, fontSize: TYP.bedien, fontFamily: SCHRIFT.text } as const;
const leise = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 } as const;

export function HeadPanel({ head, standardModus, zuKontakt, i = 0, nachEntscheid }: { head: 'sales' | 'marketing' | 'event'; standardModus: string; zuKontakt?: (id: string) => void; i?: number; nachEntscheid?: () => void }) {
  const [s, setS] = useState<Stand | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [frage, setFrage] = useState('');
  const [offen, setOffen] = useState(false);
  const [sicht, setSicht] = useState<string | null>(null);
  const [ablehnen, setAblehnen] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState<{ id: string; text: string } | null>(null);
  const [merk, setMerk] = useState('');
  const laden = useCallback(() => fetch(`/api/heads/${head}`, { cache: 'no-store' }).then(r => r.json()).then(d => d.ok && setS(d)).catch(() => {}), [head]);
  useEffect(() => { void laden(); }, [laden]);
  const post = (body: Record<string, unknown>) => fetch(`/api/heads/${head}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));

  const lauf = async (modus: string) => {
    setLaeuft(modus); setMeldung('');
    const r = await post({ aktion: 'lauf', modus, ...(modus === 'frage' ? { frage } : {}) });
    setLaeuft(null);
    const b = r.bericht as HeadBericht | undefined;
    setMeldung(!r.ok ? r.fehler : r.ohneKi ? r.ruhigText : `${r.neu ?? 0} neue Vorschläge${r.auto ? ` · ${r.auto} selbst erledigt` : ''}${b?.quelle === 'regelwerk' ? ` · Regelwerk (${b.ohneKiGrund})` : ''}${b?.pruefung?.gestrichen?.length ? ` · ${b.pruefung.gestrichen.length} vom Prüfer gestrichen` : ''}`);
    if (modus === 'frage') setFrage('');
    void laden(); setOffen(true);
  };
  const entscheide = async (id: string, status: string, extra: Record<string, unknown> = {}) => {
    const r = await post({ aktion: 'entscheiden', id, status, ...extra });
    if (r?.wohin) setMeldung(`Angenommen → ${r.wohin}.`);
    else if (status === 'abgelehnt') setMeldung('Abgelehnt — der Head lernt daraus.');
    setAblehnen(null); setBearbeiten(null);
    void laden(); nachEntscheid?.();
  };
  const merken = async () => { if (!merk.trim()) return; await post({ aktion: 'merken', text: merk.trim() }); setMerk(''); void laden(); };
  const vergessen = async (id: string) => { await post({ aktion: 'vergessen', id }); void laden(); };
  const zuruecknehmen = async (id: string) => { const r = await post({ aktion: 'rueckgaengig', id }); setMeldung(r.ok ? `${r.text} Der Head lernt daraus.` : r.fehler); void laden(); nachEntscheid?.(); };
  const autonomie = async (an: boolean) => { await post({ aktion: 'autonomie', an }); void laden(); };

  const bericht = s?.berichte[0];
  const vorschlaege = (s?.vorschlaege ?? []).filter(v => v.status === 'offen').sort((a, b) => ['hoch', 'mittel', 'niedrig'].indexOf(a.prioritaet) - ['hoch', 'mittel', 'niedrig'].indexOf(b.prioritaet));
  const name = s?.name ?? (head === 'sales' ? 'Head of Sales' : head === 'marketing' ? 'Head of Marketing' : 'Head of Event');
  const q = s?.qualitaet;

  return (
    <Karte i={i} akzent={LEUCHT.agenten}>
      <Ueberschrift farbe={LEUCHT.agenten} rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {bericht && <Chip farbe={STATUS_FARBE[bericht.antwort.status]}>{bericht.antwort.status}</Chip>}
        <Knopf leise aus={!!laeuft} onClick={() => lauf(standardModus)}>{laeuft === standardModus ? 'denkt …' : s?.modi.find(m => m.id === standardModus)?.label ?? 'Lauf'}</Knopf>
      </span>}>{name}{vorschlaege.length ? ` · ${vorschlaege.length} zur Freigabe` : ''}</Ueberschrift>
      {bericht ? <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, margin: 0 }}>{bericht.antwort.zusammenfassung}</p>
        : s?.ruhig ? <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: 0 }}>{s.ruhig.text}</p>
        : <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: 0 }}>Noch kein Lauf. Der Head liest Kartei und Bestand, ordnet ein und legt Vorschläge zur Freigabe vor — versendet wird nichts. Ohne KI liefert das Regelwerk.</p>}
      {bericht && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>
        {datum(bericht.zeit)} · {s?.modi.find(m => m.id === bericht.modus)?.label ?? bericht.modus} · {bericht.quelle === 'regelwerk' ? `Regelwerk (${bericht.ohneKiGrund ?? 'ohne KI'})` : 'KI + Prüfer'}
        {bericht.pruefung.gestrichen.length ? ` · ${bericht.pruefung.gestrichen.length} gestrichen` : ''}{bericht.pruefung.korrigiert ? ' · korrigiert' : ''}{bericht.pruefung.unbelegt.length ? ` · ${bericht.pruefung.unbelegt.length} Zahl(en) unbelegt` : ''}
      </div>}
      {q && q.laeufe > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: C.inkDim, marginTop: 8 }} title="30 Tage">
          <span>Annahme <b style={{ color: C.ink }}>{q.annahmequote === null ? '—' : `${q.annahmequote} %`}</b>{q.entschieden ? ` (${q.entschieden})` : ''}</span>
          <span>Wirkung <b style={{ color: C.ink }}>{q.wirkung ?? '—'}</b></span>
          <span>Läufe <b style={{ color: C.ink }}>{q.laeufe}</b>{q.regelwerk ? ` · ${q.regelwerk} ohne KI` : ''}</span>
          {q.gestrichen > 0 && <span>vom Prüfer gestrichen {q.gestrichen}</span>}
          {q.aenderungsgrad !== null && <span>Entwürfe umgeschrieben Ø <b style={{ color: C.ink }}>{q.aenderungsgrad} %</b></span>}
          {q.cent > 0 && <span>Kosten <b style={{ color: C.ink }}>{(q.cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'USD' })}</b>{q.cacheQuote !== null ? ` · Cache ${q.cacheQuote} %` : ''}</span>}
        </div>
      )}
      {meldung && <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}

      {vorschlaege.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {vorschlaege.slice(0, offen ? 20 : 3).map(v => (
            <div key={v.id} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {v.fuer && <span title={`für ${nameVon(v.fuer)}`}><Person id={v.fuer} groesse={18} /></span>}
                <b style={{ fontSize: TYP.body, fontWeight: 600 }}>{v.titel}</b>
                <Chip farbe={v.prioritaet === 'hoch' ? LEUCHT.kritisch : v.prioritaet === 'mittel' ? LEUCHT.achtung : C.inkDim}>{v.prioritaet}</Chip>
                {v.herkunft === 'regelwerk' && <Chip farbe={C.inkDim}>Regelwerk</Chip>}
                {v.frist && <span style={{ fontSize: 12, color: C.inkLeise }}>bis {datum(v.frist)}</span>}
              </div>
              {v.signal && <div style={{ fontSize: 12, color: C.inkLeise }}>Warum jetzt: <span style={{ color: C.inkDim }}>{v.signal.text}</span>{v.signal.datum ? ` · ${datum(v.signal.datum)}` : ''}</div>}
              <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>{v.begruendung}</div>
              {v.belege?.length ? <details><summary style={{ cursor: 'pointer', fontSize: 11.5, color: C.inkLeise }}>Belege ({v.belege.length})</summary><div style={{ display: 'grid', gap: 2, marginTop: 4 }}>{v.belege.map((b, j) => <div key={j} style={{ fontSize: 11.5, color: C.inkLeise, fontFamily: 'ui-monospace, monospace', overflowWrap: 'anywhere' }}>{b}</div>)}</div></details> : null}
              {v.maengel?.length ? <div style={{ fontSize: 11.5, color: LEUCHT.achtung }}>Prüfer: {v.maengel.join(' · ')}</div> : null}
              {v.kampagne && (
                <div style={{ borderLeft: `2px solid ${LEUCHT.business}55`, paddingLeft: 10, fontSize: 12.5, color: C.inkDim }}>
                  <div style={{ fontSize: 11, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.06em' }}>Kampagne · {v.kampagne.playbook}</div>
                  <b style={{ color: C.ink }}>{v.kampagne.name}</b> — {v.kampagne.ziel} · {v.kampagne.kontakt_ids.length} Personen
                </div>
              )}
              {v.entwurf && (
                <div style={{ borderLeft: `2px solid ${LEUCHT.agenten}55`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 11, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.06em' }}>Entwurf · {v.entwurf.kanal}</div>
                  {bearbeiten?.id === v.id
                    ? <textarea value={bearbeiten.text} onChange={e => setBearbeiten({ id: v.id, text: e.target.value })} rows={6} aria-label="Entwurf bearbeiten" style={{ ...feld, width: '100%', marginTop: 6, lineHeight: 1.5 }} />
                    : <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: '4px 0 0', lineHeight: 1.5 }}>{v.entwurf.text}</pre>}
                </div>
              )}
              {ablehnen === v.id ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.inkLeise }}>Warum?</span>
                  {(s?.ablehngruende ?? []).map(g => <Knopf key={g.id} leise onClick={() => entscheide(v.id, 'abgelehnt', { grund: g.id })}>{g.label}</Knopf>)}
                  <button onClick={() => entscheide(v.id, 'abgelehnt')} style={leise}>ohne Grund</button>
                  <button onClick={() => setAblehnen(null)} style={leise}>zurück</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Knopf onClick={() => entscheide(v.id, 'angenommen', bearbeiten?.id === v.id ? { entwurf: bearbeiten.text } : {})}>{v.art === 'merken' ? 'Merken' : bearbeiten?.id === v.id ? 'So annehmen' : 'Annehmen'}</Knopf>
                  <Knopf leise onClick={() => setAblehnen(v.id)}>Ablehnen</Knopf>
                  {v.entwurf && bearbeiten?.id !== v.id && <Knopf leise onClick={() => setBearbeiten({ id: v.id, text: v.entwurf!.text })}>Bearbeiten</Knopf>}
                  {v.entwurf && <Knopf leise onClick={() => { try { void navigator.clipboard.writeText(bearbeiten?.id === v.id ? bearbeiten.text : v.entwurf!.text); setMeldung('Entwurf kopiert — Versand bleibt bei dir.'); } catch { /* egal */ } }}>Kopieren</Knopf>}
                  {v.kontakt_id && zuKontakt && <Knopf leise onClick={() => zuKontakt(v.kontakt_id!)}>Zur Person</Knopf>}
                </div>
              )}
            </div>
          ))}
          {vorschlaege.length > 3 && <button onClick={() => setOffen(!offen)} style={{ ...leise, textAlign: 'left' }}>{offen ? 'weniger' : `alle ${vorschlaege.length} zeigen`}</button>}
        </div>
      )}

      {(s?.auto ?? []).length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(61,226,139,.05)', display: 'grid', gap: 4 }}>
          <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>Selbst erledigt · 7 Tage</div>
          {s!.auto.map(v => (
            <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}>
              {v.fuer && <Person id={v.fuer} groesse={16} />}
              <span style={{ flex: 1, minWidth: 0 }}>{v.titel} <span style={{ color: C.inkLeise }}>→ {v.auto?.wirkung}{v.status === 'abgelehnt' ? ' · zurückgenommen' : ''}</span></span>
              {v.status !== 'abgelehnt' && <button onClick={() => zuruecknehmen(v.id)} style={leise}>rückgängig</button>}
            </div>
          ))}
        </div>
      )}

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim }}>Weitere Läufe, Frage, Gedächtnis</summary>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.inkDim, marginTop: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={(s?.autonomie ?? 'intern') === 'intern'} onChange={e => autonomie(e.target.checked)} />
          Interne Kleinigkeiten selbst erledigen (nächster Schritt an der Person, Aufgaben für euch) — Entwürfe, Kampagnen und alles nach außen bleiben zur Freigabe
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {(s?.modi ?? []).filter(m => m.id !== 'frage' && m.id !== standardModus).map(m => <Knopf key={m.id} leise aus={!!laeuft} onClick={() => lauf(m.id)}>{laeuft === m.id ? 'denkt …' : m.label}</Knopf>)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input value={frage} onChange={e => setFrage(e.target.value)} placeholder={`Frage an den ${name} …`} aria-label="Frage" onKeyDown={e => { if (e.key === 'Enter' && frage.trim()) void lauf('frage'); }} style={{ ...feld, flex: 1 }} />
          <Knopf leise aus={!frage.trim() || !!laeuft} onClick={() => lauf('frage')}>Fragen</Knopf>
        </div>
        {bericht?.modus === 'frage' && bericht.antwort.antwort && <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginTop: 10, whiteSpace: 'pre-wrap' }}>{bericht.antwort.antwort}</p>}
        {bericht && bericht.antwort.befunde.length > 0 && (
          <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
            {bericht.antwort.befunde.map((b, j) => <div key={j} style={{ fontSize: 12.5, color: C.inkDim }}><b style={{ color: C.ink, fontWeight: 600 }}>{b.titel}:</b> {b.text}</div>)}
          </div>
        )}
        {bericht?.antwort.verworfen?.length ? <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Vom Regelwerk verworfen: {bericht.antwort.verworfen.map(w => `${w.dedup_schluessel} (${w.grund})`).join(' · ')}</div> : null}

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, marginBottom: 6 }}>Gedächtnis · gilt wie eine Regel</div>
          {(s?.gedaechtnis ?? []).map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.inkDim, padding: '4px 0' }}>
              <Person id={m.von} groesse={16} /><span style={{ flex: 1 }}>{m.text}</span>
              <button onClick={() => vergessen(m.id)} style={leise} aria-label={`„${m.text}“ vergessen`}>vergessen</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input value={merk} onChange={e => setMerk(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void merken(); }} placeholder="z. B. „Kunden immer per Du“ · „freitags keine Anrufe“" aria-label="Merksatz" style={{ ...feld, flex: 1 }} />
            <Knopf leise aus={!merk.trim()} onClick={merken}>Merken</Knopf>
          </div>
          {(s?.hinweise ?? []).length > 0 && <div style={{ display: 'grid', gap: 3, marginTop: 10 }}>{s!.hinweise.map((h, j) => <div key={j} style={{ fontSize: 12, color: C.inkLeise }}>Gelernt: {h}</div>)}</div>}
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={async () => { if (sicht) return setSicht(null); const r = await post({ aktion: 'daten', modus: standardModus }); setSicht(r?.ok ? JSON.stringify(r.daten, null, 1) : 'nicht erreichbar'); }} style={leise}>{sicht ? 'Datenpaket ausblenden' : 'Was der Head sieht (Datenpaket)'}</button>
          {sicht && <pre style={{ maxHeight: 320, overflow: 'auto', fontSize: 11.5, color: C.inkDim, background: 'rgba(0,0,0,.25)', padding: 10, borderRadius: 10, marginTop: 6 }}>{sicht}</pre>}
        </div>
        {bericht && bericht.pruefung.gestrichen.length > 0 && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Gestrichen: {bericht.pruefung.gestrichen.map(g => `„${g.titel}“ (${g.grund})`).join(' · ')}</div>}
      </details>
    </Karte>
  );
}
