'use client';

import { localDay } from '@/lib/zeit';

// ─── MAKE OS — Reporting-/Board-Agent ───────────────────────────────────────
// Das Wochen-Pack: Umsatz-Kurs, Pipeline und Ausführung aus Controlling,
// Prospecting und Aufgaben — Kennzahlen exakt, Einordnung vom Agenten.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zahl aus schlank).

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { wertVon, STANDARD_MODUS } from '@/lib/make-one/kompass-data';
import { eur } from '@/lib/make-one/finance-data';
import { Seite, Karte, Ueberschrift, Leer, Knopf, Chip, Zahl, Fortschritt, LEUCHT } from './schlank';

interface Sektion { titel: string; punkte?: string[]; }
interface Stats {
  finance: { fortschritt: number; istUmsatz: number; gewinn: number; runRateNoetig: number; runway: number | null; aktiv: boolean; zielUmsatz: number; zielGewinn: number } | null;
  pipeline: { total: number; hot: number; qualifiziert: number; kontaktiert: number; avgScore: number };
  tasks: { open: number; critical: number; inProgress: number; blocked: number; overdue: number };
}
interface Pack { headline: string; sektionen: Sektion[]; risiken: string[]; naechsteWoche: string[]; stats: Stats; }

/** Nie eine Null als große Zahl — dann lieber der Strich. */
const z = (n: number | null | undefined) => (n ? String(n) : undefined);

function Punkte({ liste, zeichen, farbe }: { liste: string[]; zeichen: string; farbe: string }) {
  return (
    <div>
      {liste.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, padding: '4px 0' }}>
          <span style={{ color: farbe, flex: '0 0 auto', fontWeight: 700 }}>{zeichen}</span><span>{t}</span>
        </div>
      ))}
    </div>
  );
}

export function BoardView() {
  const [pack, setPack] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);
  // Runway-Grenze aus dem Kompass — dieselbe Zahl wie in Controlling und Shields.
  const [runwayRot, setRunwayRot] = useState(3);
  useEffect(() => {
    fetch('/api/state/kompass').then(r => r.json())
      .then(d => setRunwayRot(wertVon('runway-warnung', d.modus ?? STANDARD_MODUS, d.eigene ?? {})))
      .catch(() => {});
  }, []);

  const [ready, setReady] = useState(false);
  const [privat, setPrivat] = useState(0);
  const [payload, setPayload] = useState<{ finance: unknown; prospects: unknown[]; tasks: unknown[] } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/state/finance').then(r => r.json()).catch(() => ({ state: null })),
      fetch('/api/state/prospects').then(r => r.json()).catch(() => ({ state: null })),
      fetch('/api/state/tasks').then(r => r.json()).catch(() => ({ state: null })),
    ]).then(([f, pr, t]) => {
      // Privat bleibt privat: Das Board ist die Geschäftssicht. Aufgaben aus
      // privaten Projekten (Gesundheit, Recht/Wittner, MAKE.One) gehen NICHT in
      // den Business-Kontext. 'joint' ist MAKE.One (Malin & Kevin) und damit
      // ausdrücklich PRIVAT — nur 'business' zählt.
      // Bewusst fail-closed: kennen wir das Projekt einer Aufgabe nicht, bleibt
      // sie draußen. Lieber ein unvollständiges Board als ein Leck.
      const projects: { id: string; category?: string }[] = t.state?.projects ?? [];
      const businessIds = new Set(projects.filter(p => p.category === 'business').map(p => p.id));
      const allTasks: { projectId?: string }[] = t.state?.tasks ?? [];
      const scoped = allTasks.filter(x => x.projectId && businessIds.has(x.projectId));
      setPayload({ finance: f.state, prospects: pr.state?.prospects ?? [], tasks: scoped });
      setPrivat(allTasks.length - scoped.length);
      setReady(true);
    });
  }, []);

  async function build() {
    if (!payload) return;
    setBusy(true);
    try {
      const r = await fetch('/api/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, today: localDay() }) });
      setPack(await r.json());
    } catch { setPack(null); }
    setBusy(false);
  }

  const s = pack?.stats;
  const achtung = s ? s.tasks.overdue + s.tasks.blocked : 0;
  const runwayKritisch = s?.finance?.runway != null && s.finance.runway < runwayRot;

  return (
    <Seite
      titel="Das Wochen-Pack."
      unter="Ein Blick über alles: Umsatz-Kurs, Pipeline und Ausführung — zusammengefasst aus Controlling, Prospecting und Aufgaben. Kennzahlen exakt, Einordnung vom Agenten."
      rechts={<Chip farbe={LEUCHT.agenten}>live · Entwurf</Chip>}
    >
      <Karte i={0} akzent={LEUCHT.agenten}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Knopf onClick={build} aus={busy || !ready} farbe={LEUCHT.agenten}>
            {busy ? 'stelle Pack zusammen …' : pack ? 'Neu erstellen' : 'Board-Pack erstellen'}
          </Knopf>
          <span style={{ fontSize: 12, color: C.inkLeise }}>{ready ? `Geschäftssicht${privat > 0 ? ` · ${privat} private Aufgaben ausgeblendet` : ''}` : 'lade …'}</span>
        </div>
        {!pack && !busy && (
          <Leer>„Board-Pack erstellen" — der Agent zieht Controlling, Pipeline und Aufgaben zusammen und schreibt das Wochen-Briefing.</Leer>
        )}
      </Karte>

      {/* Kennzahlen (deterministisch) */}
      {s && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.geld}>Kennzahlen</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 }}>
            <div>
              <Zahl wert={s.finance?.aktiv ? `${s.finance.fortschritt} %` : undefined} label={s.finance ? `Umsatz-Kurs · Ziel ${eur(s.finance.zielUmsatz)}` : 'Umsatz-Kurs'} farbe={LEUCHT.geld} />
              {s.finance?.aktiv && <div style={{ marginTop: 8 }}><Fortschritt anteil={s.finance.fortschritt / 100} farbe={LEUCHT.geld} /></div>}
            </div>
            <Zahl wert={s.finance ? eur(s.finance.runRateNoetig) : undefined} label="Run-Rate nötig /Monat" />
            <Zahl wert={s.finance?.runway != null ? `${s.finance.runway.toFixed(1)} Mon.` : undefined} label="Runway" farbe={runwayKritisch ? LEUCHT.kritisch : C.ink} />
            <Zahl wert={z(s.pipeline.total)} label={`Pipeline · ${s.pipeline.hot} starker Fit · Ø ${s.pipeline.avgScore}`} farbe={LEUCHT.business} />
            <Zahl wert={z(s.tasks.open)} label={`Aufgaben offen · ${s.tasks.critical} kritisch · ${s.tasks.inProgress} in Arbeit`} />
            <Zahl wert={z(achtung)} label={`Achtung · ${s.tasks.overdue} überfällig · ${s.tasks.blocked} blockiert`} farbe={achtung > 0 ? LEUCHT.achtung : C.ink} />
          </div>
        </Karte>
      )}

      {/* Headline */}
      {pack?.headline && (
        <Karte i={2}>
          <Ueberschrift farbe={LEUCHT.agenten}>Executive Summary</Ueberschrift>
          <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.55 }}>{pack.headline}</div>
        </Karte>
      )}

      {/* Sektionen */}
      {(pack?.sektionen ?? []).map((sek, i) => (
        <Karte key={i} i={3 + i}>
          <Ueberschrift>{sek.titel}</Ueberschrift>
          <Punkte liste={sek.punkte ?? []} zeichen="›" farbe={LEUCHT.agenten} />
        </Karte>
      ))}

      {/* Risiken + Nächste Woche */}
      {(!!pack?.risiken?.length || !!pack?.naechsteWoche?.length) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {!!pack?.risiken?.length && (
            <Karte i={4 + (pack?.sektionen?.length ?? 0)}>
              <Ueberschrift farbe={LEUCHT.achtung}>Risiken</Ueberschrift>
              <Punkte liste={pack.risiken} zeichen="⚠" farbe={LEUCHT.achtung} />
            </Karte>
          )}
          {!!pack?.naechsteWoche?.length && (
            <Karte i={5 + (pack?.sektionen?.length ?? 0)}>
              <Ueberschrift farbe={LEUCHT.gut}>Fokus nächste Woche</Ueberschrift>
              <Punkte liste={pack.naechsteWoche} zeichen="→" farbe={LEUCHT.gut} />
            </Karte>
          )}
        </div>
      )}
    </Seite>
  );
}
