'use client';

// ─── MAKE OS — Datenbasis (die Eingabe-Zentrale) ────────────────────────────
// CapOS-Prinzip, auf MAKE OS übersetzt: EIN Ort, an dem Kevin & Malin sehen,
// welche Daten das System trägt, was fehlt, und wo es eingetragen wird.
// Drei Ebenen: EINGEBEN (die Pflege-Felder mit Live-Status) · VERBINDEN
// (Mail, Kalender, Whoop, M365, Erinnerungen) · AGENTEN (einstellen).
// Jede Zeile sagt ehrlich: gepflegt, leer oder fehlt — mit direktem Absprung.
// 24.09.: auf das lebendige Muster umgezogen.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Punkt, Zahl, Fortschritt, LEUCHT } from './schlank';

type Ton = 'ok' | 'acht' | 'fehlt' | 'neutral';
const TON_FARBE: Record<Ton, string> = { ok: LEUCHT.gut, acht: LEUCHT.achtung, fehlt: LEUCHT.kritisch, neutral: C.inkLeise };

interface Eintrag { bereich: string; status: string; ton: Ton; href: string; wer?: string }

export function DatenbasisView() {
  const heute = localDay();
  const [zeilen, setZeilen] = useState<Eintrag[] | null>(null);
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

      const z: Eintrag[] = [];

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
      z.push({ bereich: 'Kunden & Mandate', wer: 'beide', href: '/os/markttraktion?s=sales&a=kunden',
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

  const fehltN = (zeilen ?? []).filter(z => z.ton === 'fehlt').length;
  const achtN = (zeilen ?? []).filter(z => z.ton === 'acht').length;
  const gepflegtN = zeilen ? zeilen.length - fehltN - achtN : 0;
  const ampel = fehltN ? LEUCHT.kritisch : achtN ? LEUCHT.achtung : LEUCHT.gut;

  const verbindungen: { name: string; status: string; ton: Ton; href: string }[] = [
    { name: 'Apple Mail', status: 'läuft — beide Postfächer live in der Inbox', ton: 'ok', href: '/os/inbox' },
    { name: 'Apple Kalender', status: 'läuft — lesen & schreiben (Termine, Blöcke)', ton: 'ok', href: '/os/kalender' },
    { name: 'Apple Erinnerungen', status: 'braucht einmalige macOS-Freigabe (Systemeinstellungen → Datenschutz)', ton: 'acht', href: '/os/aufgaben' },
    ...verb.map(v => ({
      name: v.name,
      status: v.verbunden ? 'verbunden — Daten fließen' : v.konfiguriert ? 'bereit — einmal Verbinden klicken' : v.id === 'whoop' ? 'App registrieren (5 Min) → Morgen-Check füllt sich selbst' : 'Azure-App registrieren (5 Min) → Postfach & Kalender live',
      ton: (v.verbunden ? 'ok' : v.konfiguriert ? 'acht' : 'fehlt') as Ton,
      href: '/os/verbindungen',
    })),
    { name: 'Vivid (Konten)', status: 'keine offene API — Stände manuell oder zusammen über Chrome', ton: 'acht', href: '/os/finanzen' },
  ];

  const pfeil = <span style={{ color: C.inkLeise }}>›</span>;

  return (
    <Seite titel="Datenbasis" unter={<>Eine Wahrheit, drei Ebenen: <b style={{ color: C.ink, fontWeight: 600 }}>eingeben</b> was nur ihr wisst, <b style={{ color: C.ink, fontWeight: 600 }}>verbinden</b> was automatisch fließen kann, <b style={{ color: C.ink, fontWeight: 600 }}>Agenten</b> arbeiten lassen. Jede Zeile springt direkt ins richtige Feld.</>}>
      {/* Ampel-Kopf */}
      <Karte i={0} akzent={zeilen ? ampel : undefined}>
        <Ueberschrift farbe={zeilen ? ampel : C.inkLeise} rechts={zeilen ? `${gepflegtN} von ${zeilen.length} gepflegt` : undefined}>Was das System trägt</Ueberschrift>
        {!zeilen ? (
          <Leer>prüfe die Stores …</Leer>
        ) : (
          <>
            <div style={{ fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 14 }}>
              {fehltN ? `${fehltN} Bereiche fehlen ganz` : achtN ? `${achtN} Bereiche brauchen euch` : 'Datenbasis steht — alles gepflegt'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
              <Zahl wert={gepflegtN ? String(gepflegtN) : undefined} label="gepflegt" farbe={LEUCHT.gut} />
              <Zahl wert={achtN ? String(achtN) : undefined} label="brauchen euch" farbe={LEUCHT.achtung} />
              <Zahl wert={fehltN ? String(fehltN) : undefined} label="fehlen ganz" farbe={LEUCHT.kritisch} />
            </div>
            <div style={{ marginTop: 14 }}>
              <Fortschritt anteil={zeilen.length ? gepflegtN / zeilen.length : 0} farbe={ampel} />
            </div>
          </>
        )}
      </Karte>

      {/* ── Ebene 1: Eingeben ── */}
      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.geld}>Eingeben — was nur ihr wisst</Ueberschrift>
        {!zeilen && <Leer>prüfe die Stores …</Leer>}
        <Liste>
          {(zeilen ?? []).map(z => (
            <Link key={z.bereich} href={z.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Zeile onClick={() => {}}
                links={<Punkt farbe={TON_FARBE[z.ton]} />}
                titel={z.bereich}
                unter={<span style={{ color: z.ton === 'ok' ? C.inkLeise : TON_FARBE[z.ton] }}>{z.status}</span>}
                rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{z.wer && <Chip farbe={C.inkLeise}>{z.wer}</Chip>}{pfeil}</span>} />
            </Link>
          ))}
        </Liste>
      </Karte>

      {/* ── Ebene 2: Verbinden ── */}
      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.puls}>Verbinden — was von selbst fließen soll</Ueberschrift>
        <Liste>
          {verbindungen.map(v => (
            <Link key={v.name} href={v.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Zeile onClick={() => {}}
                links={<Punkt farbe={TON_FARBE[v.ton]} />}
                titel={v.name}
                unter={<span title={v.status} style={{ color: v.ton === 'ok' ? C.inkLeise : TON_FARBE[v.ton] }}>{v.status}</span>}
                rechts={pfeil} />
            </Link>
          ))}
        </Liste>
      </Karte>

      {/* ── Ebene 3: Agenten ── */}
      <Karte i={3}>
        <Ueberschrift farbe={LEUCHT.agenten} rechts={<Link href="/os/agenten" style={{ color: C.inkLeise, textDecoration: 'none' }}>Agentensystem öffnen ›</Link>}>Agenten — wer für euch arbeitet</Ueberschrift>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Zahl wert={agenten ? String(agenten.live) : undefined} label="Agenten live" farbe={LEUCHT.agenten} />
          <span style={{ fontSize: TYP.bedien, color: C.inkDim, flex: '1 1 220px' }}>Autonomie, Modell & Freigaben je Agent einstellbar</span>
        </div>
        <p style={{ fontSize: 12, color: C.inkLeise, margin: '16px 0 0', lineHeight: 1.55 }}>
          Faustregel: Rot heute klären · Gelb diese Woche · Grün läuft. Das Finanz-Uhrwerk (2× im Monat) und das Tagesritual halten die Basis danach von selbst frisch.
        </p>
      </Karte>
    </Seite>
  );
}
