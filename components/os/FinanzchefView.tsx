'use client';

// ─── MAKE OS — Head of Finance ──────────────────────────────────────────────
// Kevin, 24.09.: „baue einen Finanz Agenten dazu. Der muss darauf nachher
// sitzen.“ Hier sieht man, was er sieht und vorschlägt: die Lage (vom Code
// gerechnet, ohne KI), den letzten Bericht mit geprüften Zahlen, die
// Freigabe-Liste und die Steuer-Annahmen. Er bewegt kein Geld — angenommene
// Vorschläge werden Aufgaben.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { bloecke } from '@/lib/make-one/markdown';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Punkt, Chip, Knopf, Segmente, Spalten, Spalte, Zahl, feld, LEUCHT } from './schlank';
import { block } from './WissenView';
import type { Bericht, ChefVorschlag, ChefEinstellung } from '@/lib/finanzen/chef/stand';
import type { Hinweis } from '@/lib/finanzen/chef/finanzbild';
import type { Termin } from '@/lib/finanzen/chef/steuertermine';
import type { Modus } from '@/lib/finanzen/chef/prompt';
import type { Schritt } from '@/lib/finanzen/chef/ist-stand';
import Link from 'next/link';

interface Stand {
  ok: boolean; umfang: 'business' | 'business+haushalt'; haushaltZugang: boolean;
  istStand: Schritt[];
  berichte: Bericht[]; vorschlaege: ChefVorschlag[]; letzte: Partial<Record<Modus, string>>; ruhig: { zeit: string; text: string } | null;
  einstellung: ChefEinstellung;
  lage: { hinweise: Hinweis[]; termine: Termin[]; kasse: { betrag: number; quelle: string; konten: number; stand: string | null }; runway: number | null;
    liquiditaet: { tiefpunkt: number; tiefpunkt_woche: string; engpass_woche: string | null } | null;
    haushalt: { luft: number; sparquote: number; tage_seit_letzter_buchung: number | null } | null; deckung: number | null };
}

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
const SCHWERE: Record<string, string> = { hoch: LEUCHT.kritisch, mittel: LEUCHT.achtung, niedrig: C.inkLeise };
const AMPEL: Record<string, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: C.inkLeise };
const STATUS: Record<string, { text: string; farbe: string }> = { ruhig: { text: 'ruhig', farbe: LEUCHT.gut }, beobachten: { text: 'beobachten', farbe: LEUCHT.achtung }, handeln: { text: 'handeln', farbe: LEUCHT.kritisch } };
const MODI: { id: Modus; label: string }[] = [{ id: 'tagescheck', label: 'Tagescheck' }, { id: 'wochenreview', label: 'Wochenreview' }, { id: 'monatsabschluss', label: 'Monatsabschluss' }, { id: 'steuercheck', label: 'Steuercheck' }];
const datum = (iso?: string | null) => (iso ? new Date(iso.length > 10 ? iso : `${iso}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '');
const zeit = (iso: string) => new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Nicht belegte Zahlen sichtbar machen — gelb unterstrichen, mit Erklärung. */
function markiert(text: string, unbelegt: string[]): ReactNode {
  if (!unbelegt.length || !text) return text;
  const muster = new RegExp(`(${unbelegt.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(muster).map((t, i) => unbelegt.includes(t)
    ? <span key={i} title="Diese Zahl steht so nicht in den Daten — nicht belegt." style={{ textDecoration: `underline wavy ${LEUCHT.achtung}`, textUnderlineOffset: 3 }}>{t}</span>
    : <span key={i}>{t}</span>);
}

export function FinanzchefView() {
  const [s, setS] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [modus, setModus] = useState<Modus>('wochenreview');
  const [frage, setFrage] = useState('');
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [berichtAuf, setBerichtAuf] = useState(false);

  const laden = useCallback(() => {
    fetch('/api/finanzchef').then(r => r.json()).then((d: Stand) => { if (d.ok) setS(d); else setFehler('Nicht ladbar.'); }).catch(() => setFehler('Nicht ladbar — läuft MAKE OS?'));
  }, []);
  useEffect(() => { laden(); }, [laden]);

  async function starte(m: Modus, f?: string) {
    setLaeuft(m === 'frage' ? 'Der Head of Finance denkt über deine Frage nach …' : `${MODI.find(x => x.id === m)?.label} läuft — der Head of Finance rechnet und lässt sich prüfen (bis zu zwei Minuten) …`);
    setFehler(null);
    try {
      const r = await fetch('/api/finanzchef', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'lauf', modus: m, ...(f ? { frage: f } : {}) }) });
      const d = await r.json();
      if (!d.ok) setFehler(d.fehler ?? 'Lauf fehlgeschlagen.');
      else { setGewaehlt(d.bericht?.id ?? null); if (m === 'frage') setFrage(''); }
      laden();
    } catch { setFehler('Keine Antwort — läuft MAKE OS noch?'); }
    setLaeuft(null);
  }

  async function entscheide(v: ChefVorschlag, status: ChefVorschlag['status']) {
    const grund = status === 'abgelehnt' ? window.prompt('Warum nicht? (hilft dem Head of Finance beim nächsten Mal)') ?? undefined : undefined;
    await fetch('/api/finanzchef', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'vorschlag', id: v.id, status, ...(grund ? { grund } : {}) }) });
    laden();
  }

  const bericht = useMemo(() => (s ? s.berichte.find(b => b.id === gewaehlt) ?? s.berichte.find(b => b.modus !== 'frage') ?? s.berichte[0] ?? null : null), [s, gewaehlt]);
  if (!s) return <Karte><Leer>{fehler ?? 'Lade den Head of Finance …'}</Leer></Karte>;
  const a = bericht?.antwort;
  const unbelegt = bericht?.pruefung.unbelegt.map(u => u.text) ?? [];
  const offen = s.vorschlaege.filter(v => v.status === 'offen');
  const laufend = s.vorschlaege.filter(v => v.status === 'angenommen');
  const st = a ? STATUS[a.status] : null;

  return (
    <>
      <IstStand liste={s.istStand ?? []} />
      <Karte i={0}>
        <Ueberschrift farbe={LEUCHT.geld} rechts={<Chip farbe={s.umfang === 'business' ? LEUCHT.business : LEUCHT.geld}>{s.umfang === 'business' ? 'nur Business' : 'Haushalt + Business'}</Chip>}>Head of Finance</Ueberschrift>
        {a ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
              {st && <Chip farbe={st.farbe}>{st.text}</Chip>}
              <span>{MODI.find(x => x.id === bericht!.modus)?.label ?? 'Frage'} · {zeit(bericht!.zeit)}</span>
              <span title="Jede €- und %-Angabe wurde gegen die Daten geprüft.">· {bericht!.pruefung.geprueft} Zahlen geprüft{unbelegt.length ? <b style={{ color: LEUCHT.achtung }}> · {unbelegt.length} nicht belegt</b> : ', alle belegt'}{bericht!.pruefung.korrigiert ? ' (nach Korrektur)' : ''}</span>
            </div>
            {bericht!.frage && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Frage: „{bericht!.frage}“</div>}
            {(() => {
              // Der erste Satz trägt die Antwort — groß. Der Rest liest sich in Textgröße.
              const text = a.antwort ?? a.zusammenfassung;
              const m = /^(.{20,260}?[.!?])\s+([\s\S]+)$/.exec(text);
              const kopf = m ? m[1] : text, rest = m ? m[2] : '';
              return (
                <div style={{ maxWidth: 820 }}>
                  <div style={{ fontFamily: SCHRIFT.display, fontSize: 18, lineHeight: 1.45, textWrap: 'pretty' as never }}>{markiert(kopf, unbelegt)}</div>
                  {rest && <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.6, marginTop: 6 }}>{markiert(rest, unbelegt)}</div>}
                </div>
              );
            })()}
            {!!a.ampel.length && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {a.ampel.map(x => (
                  <div key={x.bereich} style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0, flex: '1 1 220px' }}>
                    <Punkt farbe={AMPEL[x.farbe]} />
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>{x.bereich}</div><div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>{markiert(x.grund, unbelegt)}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : <Leer>Noch kein Bericht. Der Takt startet den ersten Tagescheck von selbst — oder du startest unten einen Lauf.</Leer>}
        {s.ruhig && (!bericht || s.ruhig.zeit > bericht.zeit) && <div style={{ marginTop: 10, fontSize: TYP.bedien, color: C.inkLeise }}>Tagescheck {zeit(s.ruhig.zeit)}: {s.ruhig.text}</div>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}><Segmente liste={MODI} aktiv={modus} onWahl={setModus} /></div>
          <Knopf onClick={() => starte(modus)} aus={!!laeuft} farbe={LEUCHT.geld}>Jetzt prüfen</Knopf>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <input value={frage} onChange={e => setFrage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && frage.trim() && !laeuft) starte('frage', frage.trim()); }} placeholder={s.umfang === 'business' ? 'Frag den Head of Finance — z. B. „Reicht die Liquidität bis Dezember?“' : 'Frag den Head of Finance — z. B. „Wofür geben wir im Monat am meisten aus?“'} aria-label="Frage an den Head of Finance" style={{ ...feld, flex: 1, minWidth: 0 }} />
          <Knopf onClick={() => frage.trim() && starte('frage', frage.trim())} aus={!!laeuft || !frage.trim()}>Fragen</Knopf>
        </div>
        {laeuft && <div style={{ marginTop: 10, fontSize: TYP.bedien, color: LEUCHT.geld }}>{laeuft}</div>}
        {fehler && <div style={{ marginTop: 10, fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</div>}
      </Karte>

      <Spalten verhaeltnis="3:2">
        <Spalte>
          {a && !!a.befunde.length && (
            <Karte i={1}>
              <Ueberschrift>Befunde</Ueberschrift>
              <div style={{ display: 'grid', gap: 14 }}>
                {a.befunde.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ paddingTop: 6 }}><Punkt farbe={SCHWERE[b.schwere]} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: TYP.body }}>{b.titel}</span>
                        {b.typ !== 'fakt' && <Chip farbe={C.inkLeise}>{b.typ}</Chip>}
                        {b.steuerhinweis && <Chip farbe={LEUCHT.schlaf}>Steuer</Chip>}
                      </div>
                      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginTop: 3 }}>{markiert(b.was, unbelegt)}</div>
                      <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.55, marginTop: 3 }}>{markiert(b.bedeutung, unbelegt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Karte>
          )}
          {a && (!!a.fragen.length || !!a.datenluecken.length) && (
            <Karte i={2}>
              <Ueberschrift>Offen</Ueberschrift>
              {a.fragen.map((f, i) => <Zeile key={`f${i}`} links={<Chip farbe={LEUCHT.puls}>{f.an}</Chip>} titel={f.frage} unter={f.warum} />)}
              {a.datenluecken.map((d, i) => <Zeile key={`d${i}`} links={<Chip farbe={C.inkLeise}>Daten</Chip>} titel={d.was} unter={d.auswirkung} />)}
            </Karte>
          )}
          {a?.bericht_markdown && (
            <Karte i={3}>
              <Ueberschrift rechts={<Knopf leise onClick={() => setBerichtAuf(!berichtAuf)}>{berichtAuf ? 'zuklappen' : 'ganzer Bericht'}</Knopf>}>Bericht</Ueberschrift>
              {berichtAuf && <div style={{ fontSize: TYP.body, lineHeight: 1.6, maxWidth: 760 }}>{bloecke(a.bericht_markdown).map((b, i) => block(b, i, () => {}))}</div>}
            </Karte>
          )}
          <Karte i={4}>
            <Ueberschrift>Frühere Läufe</Ueberschrift>
            {s.berichte.length ? (
              <Liste>
                {s.berichte.map(b => (
                  <Zeile key={b.id} aktiv={b.id === bericht?.id} onClick={() => setGewaehlt(b.id)} links={<Punkt farbe={STATUS[b.antwort.status]?.farbe ?? C.inkLeise} />}
                    titel={b.modus === 'frage' ? `Frage: ${b.frage ?? ''}` : `${MODI.find(x => x.id === b.modus)?.label}${b.monat ? ` ${b.monat}` : ''}`}
                    unter={`${zeit(b.zeit)} · ${b.antwort.befunde.length} Befunde · ${b.ausgeloest === 'takt' ? 'vom Takt' : b.ausgeloest === 'jarvis' ? 'über Jarvis' : 'von Hand'}${b.pruefung.unbelegt.length ? ` · ${b.pruefung.unbelegt.length} nicht belegt` : ''}`} />
                ))}
              </Liste>
            ) : <Leer>Noch keine.</Leer>}
          </Karte>
        </Spalte>

        <Spalte>
          <Karte i={1}>
            <Ueberschrift farbe={offen.length ? LEUCHT.achtung : undefined}>Zur Freigabe{offen.length ? ` · ${offen.length}` : ''}</Ueberschrift>
            {offen.length ? offen.map(v => (
              <div key={v.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Punkt farbe={SCHWERE[v.prioritaet]} />
                  <span style={{ fontWeight: 700, fontSize: TYP.body }}>{v.titel}</span>
                </div>
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: '4px 0 8px' }}>
                  {v.begruendung}
                  <span style={{ color: C.inkLeise }}>{v.betrag_eur != null ? ` · ${eur(v.betrag_eur)}` : ''}{v.frist ? ` · bis ${datum(v.frist)}` : ''} · {v.verantwortlich}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Knopf onClick={() => entscheide(v, 'angenommen')} farbe={LEUCHT.gut}>Annehmen → Aufgabe</Knopf>
                  <Knopf leise onClick={() => entscheide(v, 'abgelehnt')}>Ablehnen</Knopf>
                  <Knopf leise onClick={() => entscheide(v, 'erledigt')}>Schon erledigt</Knopf>
                </div>
              </div>
            )) : <Leer>Nichts offen. Neue Vorschläge des Head of Finance landen hier — nichts passiert ohne euch.</Leer>}
            {!!laufend.length && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, marginBottom: 4 }}>Angenommen, läuft</div>
                {laufend.map(v => <Zeile key={v.id} titel={v.titel} unter={v.frist ? `bis ${datum(v.frist)}` : 'als Aufgabe angelegt'} rechts={<Knopf leise onClick={() => entscheide(v, 'erledigt')}>erledigt</Knopf>} />)}
              </div>
            )}
          </Karte>

          <Karte i={2}>
            <Ueberschrift>Lage · vom Code gerechnet</Ueberschrift>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 12 }}>
              <Zahl wert={s.lage.kasse.quelle === 'keine' ? undefined : eur(s.lage.kasse.betrag)} label={s.lage.kasse.quelle === 'konten' ? `Kasse · ${s.lage.kasse.konten} Firmenkonten` : 'Kasse Business'} farbe={LEUCHT.geld} />
              <Zahl wert={s.lage.runway != null ? `${s.lage.runway.toFixed(1).replace('.', ',')} Mon.` : undefined} label="Runway" />
              {s.lage.haushalt && <Zahl wert={eur(s.lage.haushalt.luft)} label="Luft privat / Monat" farbe={s.lage.haushalt.luft < 0 ? LEUCHT.kritisch : LEUCHT.gut} />}
              {s.lage.deckung != null && <Zahl wert={`${Math.round(s.lage.deckung)} %`} label="Mindestumsatz gedeckt" farbe={s.lage.deckung < 100 ? LEUCHT.achtung : LEUCHT.gut} />}
            </div>
            {s.lage.hinweise.length ? s.lage.hinweise.slice(0, 8).map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', fontSize: TYP.bedien, lineHeight: 1.5 }}>
                <Punkt farbe={SCHWERE[h.schwere]} groesse={7} /><span style={{ color: C.inkDim }}>{h.text}</span>
              </div>
            )) : <Leer>Keine Hinweise — die Daten sind vollständig und nichts ist auffällig.</Leer>}
          </Karte>

          <Karte i={3}>
            <Ueberschrift>Fristen · 60 Tage</Ueberschrift>
            {s.lage.termine.length ? s.lage.termine.map(t => <Zeile key={`${t.datum}${t.art}`} links={<span style={{ fontVariantNumeric: 'tabular-nums', color: C.inkDim, fontSize: TYP.bedien, minWidth: 44 }}>{datum(t.datum)}</span>} titel={t.titel} unter={t.hinweis} />) : <Leer>Keine Steuertermine in den nächsten 60 Tagen — laut Einstellung unten.</Leer>}
            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Gerechnet aus der Einstellung, inkl. Wochenend- und Feiertagsregel. Hinweis, keine Steuerberatung.</div>
          </Karte>

          <Einstellung e={s.einstellung} onGespeichert={laden} />
        </Spalte>
      </Spalten>
    </>
  );
}

/** Ist-Stand — was für einen sauberen Finanzstand noch fehlt, aus den Daten abgeleitet. */
function IstStand({ liste }: { liste: Schritt[] }) {
  const offen = liste.filter(x => !x.erledigt);
  const [auf, setAuf] = useState(true);
  if (!liste.length) return null;
  const BEREICH: Record<Schritt['bereich'], string> = { privat: 'Privat', business: 'Business', gemeinsam: 'Gemeinsam' };
  return (
    <Karte i={0} akzent={offen.length ? LEUCHT.achtung : LEUCHT.gut}>
      <Ueberschrift farbe={offen.length ? LEUCHT.achtung : LEUCHT.gut} rechts={<Knopf leise onClick={() => setAuf(!auf)}>{auf ? 'zuklappen' : 'zeigen'}</Knopf>}>
        Ist-Stand · {liste.length - offen.length} von {liste.length} erledigt
      </Ueberschrift>
      {!offen.length && <div style={{ fontSize: TYP.body, color: C.inkDim }}>Der Finanzstand ist vollständig — darauf lässt sich planen.</div>}
      {auf && (['privat', 'gemeinsam', 'business'] as const).map(b => {
        const teil = liste.filter(x => x.bereich === b);
        if (!teil.length) return null;
        return (
          <div key={b} style={{ marginTop: 10 }}>
            <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, marginBottom: 4 }}>{BEREICH[b]}</div>
            {teil.map(x => (
              <Link key={x.id} href={x.link} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', color: 'inherit', textDecoration: 'none' }}>
                <span style={{ width: 18, flex: '0 0 auto', color: x.erledigt ? LEUCHT.gut : LEUCHT.achtung, fontWeight: 800 }}>{x.erledigt ? '✓' : '○'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: x.erledigt ? C.inkDim : C.ink }}>{x.titel}</span>
                  <span style={{ display: 'block', fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>{x.detail}</span>
                </span>
                {!x.erledigt && <Chip farbe={x.wer === 'malin' ? LEUCHT.beziehung : x.wer === 'beide' ? LEUCHT.puls : LEUCHT.geld}>{x.wer === 'beide' ? 'beide' : x.wer === 'malin' ? 'Malin' : 'Kevin'}</Chip>}
              </Link>
            ))}
          </div>
        );
      })}
    </Karte>
  );
}

function Einstellung({ e, onGespeichert }: { e: ChefEinstellung; onGespeichert: () => void }) {
  const [x, setX] = useState(e);
  const [auf, setAuf] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  useEffect(() => { setX(e); }, [e]);
  async function speichern() {
    await fetch('/api/finanzchef', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'einstellung', einstellung: x }) });
    setGespeichert(true); setTimeout(() => setGespeichert(false), 2000); onGespeichert();
  }
  const schalter = (k: 'dauerfrist' | 'estVorauszahlung' | 'gewstVorauszahlung' | 'kstVorauszahlung', label: string) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, cursor: 'pointer' }}>
      <input type="checkbox" checked={!!x.steuer[k]} onChange={ev => setX({ ...x, steuer: { ...x.steuer, [k]: ev.target.checked } })} /> {label}
    </label>
  );
  return (
    <Karte i={4}>
      <Ueberschrift rechts={<Knopf leise onClick={() => setAuf(!auf)}>{auf ? 'zu' : 'ändern'}</Knopf>}>Steuer-Annahmen</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
        USt {x.steuer.ust === 'keine' ? 'keine Voranmeldung' : x.steuer.ust === 'monatlich' ? 'monatlich' : 'quartalsweise'}{x.steuer.dauerfrist ? ' mit Dauerfrist' : ''} · {[x.steuer.estVorauszahlung && 'ESt', x.steuer.kstVorauszahlung && 'KSt', x.steuer.gewstVorauszahlung && 'GewSt'].filter(Boolean).join(', ') || 'keine'} Vorauszahlungen
        {(!x.rechtsform.kdv || !x.rechtsform.kdc) && <div style={{ color: LEUCHT.achtung, marginTop: 4 }}>Rechtsform noch offen — trag sie ein, dann fragt der Head of Finance nicht mehr.</div>}
      </div>
      {auf && (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <label style={{ fontSize: TYP.bedien, color: C.inkDim }}>Umsatzsteuer-Voranmeldung
            <select value={x.steuer.ust} onChange={ev => setX({ ...x, steuer: { ...x.steuer, ust: ev.target.value as ChefEinstellung['steuer']['ust'] } })} style={{ ...feld, marginTop: 4 }}>
              <option value="quartal">quartalsweise</option><option value="monatlich">monatlich</option><option value="keine">keine (z. B. Kleinunternehmer)</option>
            </select>
          </label>
          {schalter('dauerfrist', 'Dauerfristverlängerung')}
          {schalter('estVorauszahlung', 'Einkommensteuer-Vorauszahlungen')}
          {schalter('kstVorauszahlung', 'Körperschaftsteuer-Vorauszahlungen (UG/GmbH)')}
          {schalter('gewstVorauszahlung', 'Gewerbesteuer-Vorauszahlungen')}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 140px', fontSize: TYP.bedien, color: C.inkDim }}>Rechtsform KD Ventures<input value={x.rechtsform.kdv ?? ''} onChange={ev => setX({ ...x, rechtsform: { ...x.rechtsform, kdv: ev.target.value || null } })} placeholder="z. B. UG (haftungsbeschränkt)" style={{ ...feld, marginTop: 4 }} /></label>
            <label style={{ flex: '1 1 140px', fontSize: TYP.bedien, color: C.inkDim }}>Rechtsform Consulting<input value={x.rechtsform.kdc ?? ''} onChange={ev => setX({ ...x, rechtsform: { ...x.rechtsform, kdc: ev.target.value || null } })} placeholder="z. B. Einzelunternehmen, freiberuflich" style={{ ...feld, marginTop: 4 }} /></label>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Knopf onClick={speichern} farbe={LEUCHT.geld}>Speichern</Knopf>
            {gespeichert && <span style={{ fontSize: TYP.bedien, color: LEUCHT.gut }}>Gespeichert</span>}
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise }}>Die Annahmen steuern den Fristenkalender. Was im Bescheid steht, gilt — im Zweifel mit dem Steuerberater klären.</div>
        </div>
      )}
    </Karte>
  );
}
