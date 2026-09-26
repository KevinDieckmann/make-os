'use client';

// ─── MAKE OS — Energie erhöhen (4-Wochen-Blick) ─────────────────────────────
// Kevins Frage: „Was habe ich in den nächsten 4 Wochen für meine Gesundheit
// geplant?" — Sport/Reha-Blöcke aus dem Wochenplaner, Gesundheits-Termine aus
// beiden Kalendern, fällige Gesundheits-Etappen, dazu Ernährung und Routinen.
// Privat. Lücken werden ehrlich benannt — eine leere Woche ist eine Ansage.
// 24.09.: auf das lebendige Muster umgezogen. `eingebettet` liefert nur die
// Abschnitte (GesundheitView legt die Karte drumherum).

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { PlanBlock } from '@/types/planer';
import { localDay } from '@/lib/zeit';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Punkt, Zahl, LEUCHT, Spalten, Spalte } from './schlank';

interface Termin { titel: string; date: string; zeit: string }
interface Meilenstein { id?: string; titel: string; faellig?: string; zeitfenster?: string; messlatte?: string; fortschritt: number; erledigt: boolean; bereich: string }

const GES_TERMIN = /arzt|dr\.|physio|reha|spritze|infiltration|neurolog|orthop|training|sport|gym|fitness|schwimm|massage|therapie/i;
const GES_BLOCK = /sport|train|gym|lauf|schwimm|spazier|bewegung|yoga|dehn/i;
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const link: CSSProperties = { color: C.inkDim, textDecoration: 'none' };

function montagVon(tag: string): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d);
}
const tagPlus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };

/** Eingebettet: nur ein Abschnitt mit Luft nach oben. Frei: eine eigene Karte. */
function Abschnitt({ eingebettet, i, akzent, children }: { eingebettet: boolean; i: number; akzent?: string; children: ReactNode }) {
  // 24.09.: auch eingebettet eigene Karten — die Gesundheitsseite ordnet sie in ihre Spalte ein.
  void eingebettet;
  return <Karte i={i} akzent={akzent}>{children}</Karte>;
}

export function EnergieView({ eingebettet = false }: { eingebettet?: boolean } = {}) {
  const heute = localDay();
  const startMontag = montagVon(heute);
  const wochen = [0, 1, 2, 3].map(i => tagPlus(startMontag, i * 7));

  const [bloecke, setBloecke] = useState<Record<string, PlanBlock[]>>({});
  const [termine, setTermine] = useState<Termin[]>([]);
  const [etappen, setEtappen] = useState<Meilenstein[]>([]);
  const [essenGeplant, setEssenGeplant] = useState<number | null>(null);
  const [routinen, setRoutinen] = useState<{ label: string; wann: string; kategorie: string }[]>([]);

  useEffect(() => {
    wochen.forEach(w => {
      fetch(`/api/state/wochenplan?woche=${w}`).then(r => r.json())
        .then(d => setBloecke(prev => ({ ...prev, [w]: Array.isArray(d.bloecke) ? d.bloecke : [] }))).catch(() => {});
    });
    Promise.all([
      fetch('/api/apple-calendar').then(r => r.json()).catch(() => []),
      fetch('/api/kemaris-calendar').then(r => r.json()).catch(() => ({ events: [] })),
    ]).then(([apple, kem]) => {
      const bis = tagPlus(startMontag, 28);
      const roh = [
        ...(Array.isArray(apple) ? apple : []).filter((e: { allDay?: boolean; startDate?: string }) => !e.allDay && e.startDate)
          .map((e: { title?: string; startDate?: string }) => ({ t: e.title ?? '', s: e.startDate! })),
        ...((kem?.events ?? []) as { title?: string; start?: string }[]).filter(e => e.start).map(e => ({ t: e.title ?? '', s: e.start! })),
      ];
      const gesehen = new Set<string>();
      setTermine(roh
        .filter(e => GES_TERMIN.test(e.t) && e.s.slice(0, 10) >= startMontag && e.s.slice(0, 10) < bis)
        .filter(e => { const k = `${e.t.toLowerCase()}|${e.s.slice(0, 16)}`; if (gesehen.has(k)) return false; gesehen.add(k); return true; })
        .map(e => ({ titel: e.t, date: e.s.slice(0, 10), zeit: e.s.slice(11, 16) })));
    });
    fetch('/api/state/meilensteine').then(r => r.json())
      .then(d => setEtappen((d.meilensteine ?? []).filter((m: Meilenstein) => m.bereich === 'gesundheit' && !m.erledigt))).catch(() => {});
    fetch('/api/state/ernaehrung').then(r => r.json())
      .then(d => setEssenGeplant(Object.values(d.plan ?? {}).reduce((s: number, t) => s + ['fruehstueck', 'mittag', 'abend'].filter(k => (t as Record<string, string>)[k]?.trim()).length, 0))).catch(() => {});
    fetch('/api/state/routinen').then(r => r.json())
      .then(d => setRoutinen((d.routinen ?? []).filter((x: { aktiv: boolean; kategorie: string }) => x.aktiv && x.kategorie === 'gesundheit'))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wochenDaten = wochen.map((w, wi) => {
    const tage = Array.from({ length: 7 }, (_, i) => tagPlus(w, i));
    const wb = (bloecke[w] ?? []).filter(b => !wi ? b.date >= heute : true);
    const reha = wb.filter(b => b.art === 'reha');
    const sport = wb.filter(b => b.art !== 'reha' && GES_BLOCK.test(b.titel));
    const term = termine.filter(t => tage.includes(t.date));
    const ms = etappen.filter(m => m.faellig && tage.includes(m.faellig));
    return { w, wi, tage, reha, sport, term, ms };
  });

  const wLabel = (w: string, wi: number) => wi === 0 ? 'Diese Woche' : wi === 1 ? 'Nächste Woche' : `ab ${w.slice(8)}.${w.slice(5, 7)}.`;
  const tagKurz = (d: string) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${d}T12:00:00`).getDay()];
  const wochenMitPlan = wochenDaten.filter(x => x.reha.length || x.sport.length || x.term.length || x.ms.length).length;

  const vier = (
    <>
      {/* 4 Wochen */}
      <Abschnitt eingebettet={eingebettet} i={0} akzent={LEUCHT.gut}>
        <Ueberschrift farbe={wochenMitPlan === 4 ? LEUCHT.gut : LEUCHT.achtung} rechts={<Link href="/os/planung/woche" style={link}>Wochenplaner ›</Link>}>Die nächsten 4 Wochen</Ueberschrift>
        <Liste>
          {wochenDaten.map(({ w, wi, reha, sport, term, ms }) => {
            const leer = !reha.length && !sport.length && !term.length && !ms.length;
            const einheiten = [...reha, ...sport].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
            return (
              <div key={w}>
                <Zeile
                  links={<Punkt farbe={leer ? LEUCHT.achtung : LEUCHT.gut} />}
                  titel={wLabel(w, wi)}
                  unter={<span style={{ color: reha.length ? C.inkLeise : LEUCHT.achtung }}>
                    Reha {reha.length}× {reha.length === 0 ? '— Bandscheibe braucht täglich' : reha.length < 5 ? '— Luft nach oben' : '✓'}
                  </span>}
                  rechts={leer
                    ? <span style={{ fontSize: 12, color: LEUCHT.achtung, whiteSpace: 'nowrap' }}>nichts geplant — <Link href="/os/planung/woche" style={link}>Blöcke reinziehen ›</Link></span>
                    : <Chip farbe={LEUCHT.gut}>{einheiten.length + term.length + ms.length} geplant</Chip>} />
                {!leer && (
                  <div style={{ padding: '4px 2px 12px 23px' }}>
                    {einheiten.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: term.length || ms.length ? 8 : 0 }}>
                        {einheiten.map((b, i) => (
                          <Chip key={i} farbe={b.art === 'reha' ? LEUCHT.gut : LEUCHT.puls}>{tagKurz(b.date)} {mm(b.startMin)} {b.titel}</Chip>
                        ))}
                      </div>
                    )}
                    {term.map((t, i) => (
                      <div key={i} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
                        <span style={{ color: C.inkLeise }}>🔒 {tagKurz(t.date)} {t.date.slice(8)}.{t.date.slice(5, 7)}. {t.zeit}</span> {t.titel}
                      </div>
                    ))}
                    {ms.map((m, i) => (
                      <div key={i} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
                        <span style={{ color: LEUCHT.achtung }}>◇</span> <b style={{ color: C.ink, fontWeight: 600 }}>{m.titel}</b> fällig {m.faellig!.slice(8)}.{m.faellig!.slice(5, 7)}. · {m.fortschritt}%{m.messlatte ? ` — ${m.messlatte}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Liste>
        <p style={{ fontSize: 12, color: C.inkLeise, margin: '12px 0 0', lineHeight: 1.5 }}>
          Geplant wird im <Link href="/os/planung/woche" style={link}>Wochenplaner</Link> (Reha-Baustein reinziehen) — hier siehst du, ob die 4 Wochen tragen.
        </p>
      </Abschnitt>

    </>
  );
  const rest = (
    <>
      {/* Etappen + Ernährung + Routinen */}
        <Abschnitt eingebettet={eingebettet} i={1}>
          <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href="/os/planung/jahr" style={link}>pflegen ›</Link>}>Gesundheits-Meilensteine</Ueberschrift>
          {etappen.length ? (
            <Liste>
              {etappen.map((m, i) => (
                <Link key={i} href={m.id ? `/os/planung/jahr?m=${encodeURIComponent(m.id)}` : '/os/planung/jahr'} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}><Zeile titel={m.titel} unter={[m.faellig && m.faellig < heute ? `überfällig seit ${m.faellig.slice(8)}.${m.faellig.slice(5, 7)}. — zählt 0 im Index` : m.faellig ? `fällig ${m.faellig.slice(8)}.${m.faellig.slice(5, 7)}.` : '', m.messlatte].filter(Boolean).join(' · ') || undefined} rechts={<Chip farbe={m.faellig && m.faellig < heute ? LEUCHT.kritisch : m.fortschritt >= 60 ? LEUCHT.gut : LEUCHT.schlaf}>{m.fortschritt} %</Chip>} /></Link>
              ))}
            </Liste>
          ) : <Leer>keine offenen</Leer>}
        </Abschnitt>

        <Abschnitt eingebettet={eingebettet} i={2}>
          <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href="/os/gesundheit?s=ernaehrung" style={link}>Ernährung öffnen ›</Link>}>Ernährung</Ueberschrift>
          <Zahl wert={essenGeplant ? String(essenGeplant) : undefined} label="von 21 Mahlzeiten geplant" farbe={essenGeplant ? LEUCHT.gut : undefined} />
          <p style={{ fontSize: TYP.bedien, color: essenGeplant ? C.inkLeise : LEUCHT.achtung, lineHeight: 1.55, margin: '10px 0 0' }}>
            {essenGeplant == null ? 'lade …' : essenGeplant ? `Essens-Woche: ${essenGeplant}/21 Mahlzeiten geplant.` : 'Keine Essens-Woche geplant — Jarvis macht dir in 30 Sekunden eine.'}
          </p>
        </Abschnitt>

        <Abschnitt eingebettet={eingebettet} i={3}>
          <Ueberschrift farbe={LEUCHT.puls} rechts={<Link href="/os/planung/routinen" style={link}>planen ›</Link>}>Tägliche Gesundheits-Routinen</Ueberschrift>
          {routinen.length ? (
            <Liste>
              {routinen.map((r, i) => (
                <Zeile key={i} titel={r.label} rechts={<Chip farbe={C.inkDim}>{r.wann}</Chip>} />
              ))}
            </Liste>
          ) : <Leer>keine aktiv</Leer>}
        </Abschnitt>
    </>
  );
  // Allein: 4 Wochen links, der Rest rechts. Eingebettet: gestapelt — die Gesundheitsseite gibt die Spalte vor.
  const inhalt = eingebettet ? <>{vier}{rest}</> : <Spalten verhaeltnis="2:1"><Spalte>{vier}</Spalte><Spalte>{rest}</Spalte></Spalten>;

  if (eingebettet) return inhalt;

  return (
    <Seite titel="Energie erhöhen" unter="Die nächsten 4 Wochen: was für Körper und Energie wirklich geplant ist — Sport, Reha, Termine, Etappen. Eine leere Woche ist keine freie Woche, sondern eine Ansage.">
      {inhalt}
    </Seite>
  );
}
