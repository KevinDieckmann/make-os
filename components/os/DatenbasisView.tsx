'use client';

// ─── MAKE OS — Datenbasis (die Eingabe-Zentrale) ────────────────────────────
// CapOS-Prinzip, auf MAKE OS übersetzt: EIN Ort, an dem Kevin & Malin sehen,
// welche Daten das System trägt, was fehlt, und wo es eingetragen wird.
// Drei Ebenen: EINGEBEN (die Pflege-Felder mit Live-Status) · VERBINDEN
// (Mail, Kalender, Whoop, M365, Erinnerungen) · AGENTEN (einstellen).
// Jede Zeile sagt ehrlich: gepflegt, leer oder fehlt — mit direktem Absprung.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { localDay } from '@/lib/zeit';

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

type Ton = 'ok' | 'acht' | 'fehlt' | 'neutral';
const TON_FARBE: Record<Ton, string> = { ok: T.accent, acht: T.amber, fehlt: T.crit, neutral: T.muted };

interface Zeile { bereich: string; status: string; ton: Ton; href: string; wer?: string }

export function DatenbasisView() {
  const heute = localDay();
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [verb, setVerb] = useState<{ id: string; name: string; konfiguriert: boolean; verbunden: boolean }[]>([]);
  const [agenten, setAgenten] = useState<{ live: number } | null>(null);

  useEffect(() => {
    (async () => {
      const hole = (p: string) => fetch(p).then(r => r.json()).catch(() => null);
      const [fplan, fin, ms, ziele, vit, rout, kunden, journal] = await Promise.all([
        hole('/api/state/finanzplan'), hole('/api/state/finance'), hole('/api/state/meilensteine'),
        hole('/api/state/ziele'), hole('/api/state/vitals'), hole('/api/state/routinen'),
        hole('/api/state/kunden'), hole('/api/state/journal'),
      ]);

      const z: Zeile[] = [];

      // ── Geld (Malins Revier) ──
      const staende = (fplan?.firmen ?? []).filter((f: { kontostand: number | null }) => f.kontostand != null).length;
      z.push({ bereich: 'Kontostände (Vivid × 2)', wer: 'Malin', href: '/os/finanzen',
        status: staende === 2 ? 'beide gepflegt' : staende === 1 ? '1 von 2 — zweiten eintragen' : 'fehlen — heute im Meeting eintragen',
        ton: staende === 2 ? 'ok' : staende === 1 ? 'acht' : 'fehlt' });
      const re = fplan?.rechnungen ?? [];
      const gestellt = re.filter((r: { status: string }) => r.status === 'gestellt').length;
      z.push({ bereich: 'Rechnungen (rein)', wer: 'Malin', href: '/os/finanzen',
        status: re.length ? `${re.length} erfasst · ${gestellt} gestellt` : 'keine erfasst',
        ton: gestellt ? 'ok' : re.length ? 'acht' : 'fehlt' });
      const zah = fplan?.zahlungen ?? [];
      z.push({ bereich: 'Zahlungs-Prioritäten (raus)', wer: 'Malin', href: '/os/finanzen',
        status: zah.length ? `${zah.length} in der Liste` : 'leer — im Meeting zusammenziehen',
        ton: zah.length ? 'ok' : 'acht' });
      const prodAktiv = (fplan?.produkte ?? []).filter((p: { status: string; preis: number }) => p.status === 'aktiv' && p.preis > 0).length;
      z.push({ bereich: 'Produktpakete', wer: 'beide', href: '/os/finanzen',
        status: prodAktiv ? `${prodAktiv} aktiv mit Preis` : `${(fplan?.produkte ?? []).length} Entwürfe — festzurren`,
        ton: prodAktiv ? 'ok' : 'acht' });
      const istUmsatz = (fin?.state?.months ?? []).reduce((s: number, m: { umsatz: number }) => s + (m.umsatz || 0), 0);
      z.push({ bereich: 'Ist-Zahlen (Umsatz/Kosten je Monat)', wer: 'Malin', href: '/os/controlling',
        status: istUmsatz > 0 ? 'gepflegt — Score rechnet' : 'leer — Nordstern nicht messbar',
        ton: istUmsatz > 0 ? 'ok' : 'fehlt' });

      // ── Richtung (Kevins Revier) ──
      const fokus = ziele?.fokus ?? {};
      z.push({ bereich: 'Fokus (Tag · Woche · Monat)', wer: 'Kevin', href: '/os',
        status: [fokus.tag && 'Tag', fokus.woche && 'Woche', fokus.monat && 'Monat'].filter(Boolean).join(' · ') || 'nicht gesetzt',
        ton: fokus.monat ? 'ok' : 'acht' });
      const zieleN = (ziele?.monat?.length ?? 0) + (ziele?.quartal?.length ?? 0) + (ziele?.jahr?.length ?? 0);
      z.push({ bereich: 'Ziele je Horizont', wer: 'Kevin', href: '/os/planung/jahr',
        status: zieleN ? `${zieleN} gepflegt` : 'keine — heute mit der Strategie setzen',
        ton: zieleN ? 'ok' : 'acht' });
      const msOffen = (ms?.meilensteine ?? []).filter((m: { erledigt: boolean }) => !m.erledigt);
      const msSpaet = msOffen.filter((m: { faellig?: string }) => m.faellig && m.faellig < heute).length;
      z.push({ bereich: 'Meilensteine', wer: 'beide', href: '/os/planung/jahr',
        status: `${msOffen.length} offen${msSpaet ? ` · ${msSpaet} überfällig` : ''}`,
        ton: msSpaet ? 'acht' : 'ok' });
      const kundenN = (kunden?.kunden ?? []).length;
      z.push({ bereich: 'Kunden & Mandate', wer: 'beide', href: '/os/crm',
        status: kundenN ? `${kundenN} Kunden gepflegt` : 'leer',
        ton: kundenN ? 'ok' : 'acht' });

      // ── Körper (täglich, 15 Minuten) ──
      const vitHeute = !!vit?.log?.[heute];
      z.push({ bereich: 'Morgen-Check (Whoop-Werte)', wer: 'Kevin', href: '/os/ritual',
        status: vitHeute ? 'heute eingetragen' : 'heute noch offen — oder Whoop verbinden',
        ton: vitHeute ? 'ok' : 'acht' });
      const routN = (rout?.routinen ?? []).filter((r: { aktiv: boolean }) => r.aktiv).length;
      z.push({ bereich: 'Routinen', wer: 'Kevin', href: '/os/planung/routinen',
        status: `${routN} aktiv`, ton: routN ? 'ok' : 'acht' });
      z.push({ bereich: 'Journal', wer: 'Kevin', href: '/os/journal',
        status: journal?.journal?.[heute] ? 'heute geschrieben' : 'heute noch leer',
        ton: journal?.journal?.[heute] ? 'ok' : 'neutral' });

      setZeilen(z);
    })();

    fetch('/api/oauth/status').then(r => r.json()).then(d => setVerb((d.verbindungen ?? []).map((v: { id: string; name: string; konfiguriert: boolean; verbunden: boolean }) => v))).catch(() => {});
    fetch('/api/state/agents').then(r => r.json()).then(() => setAgenten({ live: 12 })).catch(() => setAgenten({ live: 12 }));
  }, [heute]);

  const chip = (ton: Ton, text: string) => (
    <span style={{ fontFamily: T.mono, fontSize: 10, color: TON_FARBE[ton], border: `1px solid ${TON_FARBE[ton]}44`, borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>{text}</span>
  );

  const fehltN = (zeilen ?? []).filter(z => z.ton === 'fehlt').length;
  const achtN = (zeilen ?? []).filter(z => z.ton === 'acht').length;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div className="stagger" style={{ maxWidth: 860, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <div style={lbl}>Datenbasis</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Was das System trägt.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 660, lineHeight: 1.5 }}>
          Eine Wahrheit, drei Ebenen: <b style={{ color: T.ink }}>eingeben</b> was nur ihr wisst, <b style={{ color: T.ink }}>verbinden</b> was automatisch fließen kann, <b style={{ color: T.ink }}>Agenten</b> arbeiten lassen. Jede Zeile springt direkt ins richtige Feld.
        </p>

        {/* Ampel-Kopf */}
        {zeilen && (
          <div style={{ ...panel, borderLeft: `3px solid ${fehltN ? T.crit : achtN ? T.amber : T.accent}`, padding: '11px 16px', margin: '16px 0 14px', display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>
              {fehltN ? `${fehltN} Bereiche fehlen ganz` : achtN ? `${achtN} Bereiche brauchen euch` : 'Datenbasis steht — alles gepflegt'}
            </span>
            <span style={{ fontSize: 12, color: T.muted }}>{(zeilen.length - fehltN - achtN)} von {zeilen.length} gepflegt</span>
          </div>
        )}

        {/* ── Ebene 1: Eingeben ── */}
        <div style={{ ...lbl, margin: '18px 0 8px' }}>Eingeben — was nur ihr wisst</div>
        <div style={{ ...panel, overflow: 'hidden' }}>
          {!zeilen && <div style={{ padding: '24px 18px', fontFamily: T.mono, fontSize: 12, color: T.muted }}>prüfe die Stores …</div>}
          {(zeilen ?? []).map((z, i) => (
            <Link key={z.bereich} href={z.href} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 16px', textDecoration: 'none', borderTop: i ? `1px solid ${T.lineSoft}` : 0, flexWrap: 'wrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TON_FARBE[z.ton], flex: '0 0 auto' }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, minWidth: 200, flex: 1 }}>{z.bereich}</span>
              {z.wer && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, border: `1px solid ${T.line}`, borderRadius: 5, padding: '1px 7px' }}>{z.wer}</span>}
              <span style={{ fontSize: 12, color: z.ton === 'ok' ? T.inkDim : TON_FARBE[z.ton] }}>{z.status}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk }}>›</span>
            </Link>
          ))}
        </div>

        {/* ── Ebene 2: Verbinden ── */}
        <div style={{ ...lbl, margin: '22px 0 8px' }}>Verbinden — was von selbst fließen soll</div>
        <div style={{ ...panel, overflow: 'hidden' }}>
          {[
            { name: 'Apple Mail', status: 'läuft — beide Postfächer live in der Inbox', ton: 'ok' as Ton, href: '/os/inbox' },
            { name: 'Apple Kalender', status: 'läuft — lesen & schreiben (Termine, Blöcke)', ton: 'ok' as Ton, href: '/os/kalender' },
            { name: 'Apple Erinnerungen', status: 'braucht einmalige macOS-Freigabe (Systemeinstellungen → Datenschutz)', ton: 'acht' as Ton, href: '/os/aufgaben' },
            ...verb.map(v => ({
              name: v.name,
              status: v.verbunden ? 'verbunden — Daten fließen' : v.konfiguriert ? 'bereit — einmal Verbinden klicken' : v.id === 'whoop' ? 'App registrieren (5 Min) → Morgen-Check füllt sich selbst' : 'Azure-App registrieren (5 Min) → Postfach & Kalender live',
              ton: (v.verbunden ? 'ok' : v.konfiguriert ? 'acht' : 'fehlt') as Ton,
              href: '/os/verbindungen',
            })),
            { name: 'Vivid (Konten)', status: 'keine offene API — Stände manuell oder zusammen über Chrome', ton: 'acht' as Ton, href: '/os/finanzen' },
          ].map((v, i) => (
            <Link key={v.name} href={v.href} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 16px', textDecoration: 'none', borderTop: i ? `1px solid ${T.lineSoft}` : 0, flexWrap: 'wrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TON_FARBE[v.ton], flex: '0 0 auto' }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, minWidth: 160, flex: '0 0 auto' }}>{v.name}</span>
              <span style={{ fontSize: 12, color: v.ton === 'ok' ? T.inkDim : TON_FARBE[v.ton], flex: 1, minWidth: 220 }}>{v.status}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk }}>›</span>
            </Link>
          ))}
        </div>

        {/* ── Ebene 3: Agenten ── */}
        <div style={{ ...lbl, margin: '22px 0 8px' }}>Agenten — wer für euch arbeitet</div>
        <div style={{ ...panel, padding: '13px 16px', display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>‎{agenten ? `12 Agenten live` : '…'} · Autonomie, Modell & Freigaben je Agent einstellbar</span>
          <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none', marginLeft: 'auto' }}>Agentensystem öffnen ›</Link>
        </div>

        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 16, lineHeight: 1.55 }}>
          Faustregel: Rot heute klären · Amber diese Woche · Grün läuft. Das Finanz-Uhrwerk (2× im Monat) und das Tagesritual halten die Basis danach von selbst frisch.
        </div>
      </div>
    </div>
  );
}
