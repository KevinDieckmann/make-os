'use client';

// ─── MAKE OS — System › Datenschutz: Gesundheit, KI, Telegram (05.10., DSGVO-Paket „KI, Gesundheit, Telegram“) ───────
// Teil der einen Datenschutz-Seite (components/os/DatenschutzView.tsx). Vier Karten, alle nur für die angemeldete Person (die Server-Routen prüfen das, die Oberfläche stellt nur ein):
//   1. Gesundheit (Art. 9): drei getrennte Einwilligungen mit Wortlaut, Fassung, Zeitpunkt und Widerruf, Nachweis-Liste
//   2. KI-Schalter: eigene (Hintergrund-KI, Web-Suche, Bereiche) — der Inhaber zusätzlich die der Instanz
//   3. Telegram: Ausnahme „ZOE-Antworten vollständig über Telegram“ mit Hinweistext (Vorgabe aus)
//   4. KI-Protokoll: was an das Modell ging — nur Metadaten — und die Auskunft nach Art. 15 als Datei

import { useCallback, useEffect, useState } from 'react';
import { Karte, Ueberschrift, Schalter, Hinweis, Liste, Zeile, useRueckfrage } from '../ui';
import { FARBE as C, TYP } from '@/lib/make-one/design';

type Zweck = 'verarbeiten' | 'ki' | 'partner';
interface ZweckStand { an: boolean; seit?: string; fassung?: string }
interface GStand { verarbeiten: ZweckStand; ki: ZweckStand; partner: ZweckStand; hinweisOffen: boolean; verarbeitungErlaubt: boolean }
interface GDaten { stand: GStand; fassung: string; texte: { zweck: Zweck; titel: string; text: string }[]; nachweis: { zeit: string; zweck: Zweck; an: boolean; fassung: string; folge?: string }[] }
type Bereich = 'crm' | 'kalender' | 'aufgaben' | 'finanzen' | 'brain';
interface Schalterwerte { hintergrund: boolean; websuche: boolean; bereiche: Record<Bereich, boolean> }
interface KDaten {
  vorgabe: 'kompatibel' | 'sparsam'; instanz: Schalterwerte; wirksam: Schalterwerte; inhaber: boolean;
  eigen: { hintergrund: boolean | null; websuche: boolean | null; bereiche: Partial<Record<Bereich, boolean>> };
  bereiche: { id: Bereich; label: string }[];
  telegramVoll: { seit: string; fassung: string } | null; telegramHinweis: { text: string; fassung: string };
}
interface PZeile { at: string; zweck: string; lauf: string; person: string | null; kategorien: string[]; anzahl?: number; pseudonym?: number; websuche?: boolean; ergebnis: string; grund?: string }
interface PDaten { zeilen: PZeile[]; gesamt: number; mitSystem: boolean; zusammenfassung: { empfaenger: string; kategorien: { kategorie: string; aufrufe: number; pseudonymisiert: number; letzter: string | null }[]; gesperrt: number } }

const zeit = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const LAUF: Record<string, string> = { gespraech: 'Gespräch', aufruf: 'Aufruf', hintergrund: 'Hintergrund' };
const ZWECK_KURZ: Record<Zweck, string> = { verarbeiten: '(a) verarbeiten', ki: '(b) an die KI', partner: '(c) Partner & dessen ZOE' };
const text = { fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55 } as const;

export function KiGesundheitKarten({ i = 0 }: { i?: number }) {
  const [g, setG] = useState<GDaten | null>(null);
  const [k, setK] = useState<KDaten | null>(null);
  const [p, setP] = useState<PDaten | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      fetch('/api/datenschutz/gesundheit', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/datenschutz/ki', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/datenschutz/ki-protokoll', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (a?.ok) setG(a); if (b?.ok) setK(b); if (c?.ok) setP(c);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const erklaeren = async (zweck: Zweck, an: boolean) => {
    if (!g) return;
    const t = g.texte.find(x => x.zweck === zweck);
    if (an && !(await bestaetigen({ titel: t?.titel ?? 'Einwilligung', text: `${t?.text ?? ''}\n\nFassung ${g.fassung}. Zeitpunkt und Fassung werden als Nachweis gespeichert.`, ja: 'Ich willige ein' }))) return;
    if (!an && !(await bestaetigen({ titel: 'Einwilligung widerrufen?', text: zweck === 'verarbeiten' ? 'Danach wird nichts Neues mehr erfasst; „An die KI geben“ und „Mit dem Partner teilen“ enden mit. Bereits Gespeichertes bleibt, bis du es löschst.' : 'Ab sofort gehen keine Gesundheitswerte mehr diesen Weg.', ja: 'Widerrufen', gefahr: true }))) return;
    const r = await fetch('/api/datenschutz/gesundheit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zweck, an, fassung: g.fassung }) });
    const d = await r.json().catch(() => ({}));
    setMeldung(r.ok ? (an ? 'Einwilligung gespeichert.' : 'Widerruf gespeichert.') : (d.error ?? 'Nicht gespeichert.'));
    await laden();
  };

  const stellen = async (ebene: 'instanz' | 'person', schalter: { hintergrund?: boolean; websuche?: boolean; bereiche?: Partial<Record<Bereich, boolean>> }) => {
    const r = await fetch('/api/datenschutz/ki', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ebene, schalter }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setK(d); else setMeldung(d.error ?? 'Nicht gespeichert.');
  };

  const telegram = async (an: boolean) => {
    if (!k) return;
    if (an && !(await bestaetigen({ titel: 'ZOE-Antworten vollständig über Telegram?', text: k.telegramHinweis.text, ja: 'Einschalten' }))) return;
    const r = await fetch('/api/datenschutz/ki', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ebene: 'person', telegramVoll: an, fassung: k.telegramHinweis.fassung }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setK(d); else setMeldung(d.error ?? 'Nicht gespeichert.');
  };

  return (
    <>
      {meldung && <Hinweis art="info" rolle="status">{meldung}</Hinweis>}

      <Karte i={i + 0} id="gesundheit">
        <Ueberschrift>Gesundheit (Art. 9 DSGVO)</Ueberschrift>
        {g?.stand.hinweisOffen && (
          <Hinweis art="achtung" titel="Bitte bestätigen">Deine Gesundheitsdaten werden bisher ohne ausdrückliche Einwilligung verarbeitet. Bitte bestätige unten „In MAKE OS verarbeiten“ — bis dahin bleibt alles wie bisher, aber nichts geht an die KI oder an deinen Partner.</Hinweis>
        )}
        {g && !g.stand.verarbeitungErlaubt && (
          <Hinweis art="info" titel="Noch keine Einwilligung">Ohne „In MAKE OS verarbeiten“ werden keine Gesundheitsdaten erfasst.</Hinweis>
        )}
        {!g && <div style={text}>Lädt …</div>}
        {g && g.texte.map(t => {
          const s = g.stand[t.zweck];
          const gesperrt = (t.zweck === 'ki' && !g.stand.verarbeiten.an) || (t.zweck === 'partner' && !(g.stand.verarbeiten.an && g.stand.ki.an));
          return (
            <div key={t.zweck} style={{ marginTop: 12 }}>
              <Schalter karte an={s.an} aus={gesperrt && !s.an} onChange={v => void erklaeren(t.zweck, v)} beschreibung={<>{t.text}<br /><span style={{ color: C.inkLeise }}>{s.an ? `Eingewilligt am ${zeit(s.seit)} (Fassung ${s.fassung})` : gesperrt ? 'Setzt die Einwilligung darüber voraus.' : 'Aus'}</span></>}>
                {t.titel}
              </Schalter>
            </div>
          );
        })}
        {g && g.nachweis.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim }}>Nachweis ({g.nachweis.length} Erklärungen, unveränderlich)</summary>
            <Liste>
              {[...g.nachweis].reverse().map((e, i) => (
                <Zeile key={`${e.zeit}-${i}`} titel={`${ZWECK_KURZ[e.zweck]} — ${e.an ? 'eingewilligt' : 'widerrufen'}${e.folge ? ' (Folge)' : ''}`} unter={`${zeit(e.zeit)} · Fassung ${e.fassung}`} />
              ))}
            </Liste>
          </details>
        )}
      </Karte>

      <Karte i={i + 1} id="ki">
        <Ueberschrift>KI-Schalter</Ueberschrift>
        <div style={text}>Was an die KI (Anthropic, USA) gehen darf. Deine Schalter schränken nur ein — über die Instanz hinaus öffnen sie nichts. Erzwungen wird auf dem Server, an der einen Stelle, an der Daten das Haus verlassen.</div>
        {k && (
          <>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <Schalter karte an={k.eigen.hintergrund ?? true} aus={!k.instanz.hintergrund} onChange={v => void stellen('person', { hintergrund: v })} beschreibung={k.instanz.hintergrund ? 'Automatische Läufe ohne aktuelle Frage (Morgen-/Abendlauf, Heads, Head of Finance, ZOE-Aufgaben) — Namen von Kontakten werden dabei durch Platzhalter ersetzt.' : 'Für die ganze Instanz ausgeschaltet.'}>Hintergrund-KI für mich</Schalter>
              <Schalter karte an={k.eigen.websuche ?? true} aus={!k.instanz.websuche} onChange={v => void stellen('person', { websuche: v })} beschreibung={k.instanz.websuche ? 'Recherche und Lage mit Web-Suche — Suchbegriffe gehen an einen Suchdienst.' : 'Für die ganze Instanz ausgeschaltet.'}>Web-Suche für mich</Schalter>
              {k.bereiche.map(b => (
                <Schalter key={b.id} karte an={k.eigen.bereiche[b.id] ?? true} aus={!k.instanz.bereiche[b.id]} onChange={v => void stellen('person', { bereiche: { [b.id]: v } })} beschreibung={k.instanz.bereiche[b.id] ? `ZOE darf ${b.label} lesen und an das Modell geben.` : 'Für die ganze Instanz ausgeschaltet.'}>{b.label}</Schalter>
              ))}
            </div>
            {k.inhaber && (
              <div style={{ marginTop: 18 }}>
                <Ueberschrift>Instanz (nur Inhaber)</Ueberschrift>
                <div style={text}>Vorgabe dieser Instanz: {k.vorgabe === 'kompatibel' ? '„kompatibel“ — lief schon vor dem 05.10., alles an wie bisher' : '„sparsam“ — Hintergrund-KI und Web-Suche aus, bis du sie einschaltest'}.</div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  <Schalter karte an={k.instanz.hintergrund} onChange={v => void stellen('instanz', { hintergrund: v })} beschreibung="Gilt für alle Personen dieser Instanz.">Hintergrund-KI</Schalter>
                  <Schalter karte an={k.instanz.websuche} onChange={v => void stellen('instanz', { websuche: v })} beschreibung="Gilt für alle Personen dieser Instanz.">Web-Suche</Schalter>
                  {k.bereiche.map(b => (
                    <Schalter key={b.id} karte an={k.instanz.bereiche[b.id]} onChange={v => void stellen('instanz', { bereiche: { [b.id]: v } })} beschreibung="ZOE darf diesen Bereich lesen (für alle).">{b.label}</Schalter>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Karte>

      <Karte i={i + 2} id="telegram">
        <Ueberschrift>Telegram</Ueberschrift>
        <div style={text}>Über Telegram kommen nur neutrale Hinweise („Neue Nachricht in MAKE OS“ mit Link) — keine Gesundheitswerte, keine Kontakt- oder Vertragsinhalte, keine ZOE-Antworten.</div>
        {k && (
          <div style={{ marginTop: 12 }}>
            <Schalter karte an={!!k.telegramVoll} onChange={v => void telegram(v)} beschreibung={<>{k.telegramHinweis.text}{k.telegramVoll ? <><br /><span style={{ color: C.inkLeise }}>Eingeschaltet am {zeit(k.telegramVoll.seit)}</span></> : null}</>}>
              ZOE-Antworten vollständig über Telegram
            </Schalter>
          </div>
        )}
      </Karte>

      <Karte i={i + 3} id="protokoll">
        <Ueberschrift rechts={
          // Datei-Download (keine Navigation) — deshalb ein echtes <a download>, kein next/link.
          <a href="/api/datenschutz/ki-protokoll?auskunft=1" download className="ui-knopf fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', borderRadius: 11, border: '1px solid rgba(255,255,255,.12)', color: C.ink, fontSize: TYP.bedien, textDecoration: 'none' }}>Auskunft als Datei</a>
        }>KI-Protokoll</Ueberschrift>
        <div style={text}>Je Modell-Aufruf nur Metadaten — wann, wofür, welche Datenkategorien, wie viele, ob pseudonymisiert. Nie Inhalte. Aufbewahrung 12 Monate. Empfänger: {p?.zusammenfassung.empfaenger ?? 'Anthropic PBC (USA)'}.</div>
        {p && p.zusammenfassung.kategorien.length > 0 && (
          <div style={{ marginTop: 10, fontSize: TYP.bedien, color: C.inkDim }}>
            Letzte 3 Monate: {p.zusammenfassung.kategorien.map(x => `${x.kategorie} ${x.aufrufe}×${x.pseudonymisiert ? ` (${x.pseudonymisiert} pseudonymisiert)` : ''}`).join(' · ')}{p.zusammenfassung.gesperrt ? ` · ${p.zusammenfassung.gesperrt} gesperrt` : ''}
          </div>
        )}
        {p && (
          <Liste>
            {p.zeilen.slice(0, 40).map((z, i) => (
              <Zeile key={`${z.at}-${i}`} titel={`${z.zweck} · ${LAUF[z.lauf] ?? z.lauf}${z.ergebnis === 'gesperrt' ? ` · gesperrt (${z.grund ?? '—'})` : z.ergebnis === 'fehler' ? ' · Fehler' : ''}`}
                unter={`${zeit(z.at)} · ${z.kategorien.join(', ')}${z.anzahl !== undefined ? ` · ${z.anzahl} Datensätze` : ''}${z.pseudonym ? ` · ${z.pseudonym} Namen ersetzt` : ''}${z.websuche ? ' · mit Web-Suche' : ''}${z.person === null ? ' · Systemlauf' : ''}`} />
            ))}
            {!p.zeilen.length && <div style={text}>Noch keine Aufrufe protokolliert.</div>}
          </Liste>
        )}
      </Karte>
      {dialog}
    </>
  );
}
