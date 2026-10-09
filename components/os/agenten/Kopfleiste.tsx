'use client';

// ─── Agenten-Seite: die Bedienteile — „Neu ▾“, Budget-Balken, Not-Aus, „⋯“ (09.10., Paket 2; Aufräumen 09.10. abends) ────────
// Fragerunde 6: „+ Neu ▾ (Auftrag, an mehrere Heads, Hintergrundaufgabe, Mitarbeiter, Skill) · Freigaben (Zahl) · Geplant · Budget-Balken ·
// Not-Aus · Modell & Aufwand in den Einstellungen je Head · Leitplanken unter ⋯.“
// Aufräumen 09.10. (Auftrag: „bei Claude sieht das aufgeräumter aus — gleiches Prinzip“): die Kopfleiste über der Seite entfällt. Die Teile
// wohnen jetzt dort, wo man sie braucht — und keins geht verloren:
//   • „Neu ▾“ (jetzt mit „Thread“) oben in der Liste links; ist die Liste zu, als „+“ in der Kopfzeile des Gesprächs;
//   • Freigaben-Zahl → „Wartet auf dich“ rechts (Sprung zur Freigaben-Seite) bzw. der Zähler in der Kopfzeile, wenn rechts zu ist;
//   • Geplant → Abschnitt „Geplant“ rechts („Zeitpläne“ öffnet das Fenster);
//   • Budget-Balken, Not-Aus und „⋯“ (Leitplanken, Budget je Head, Zeitpläne, bisherige Übersicht) unten im Hintergrund.
// Budget in Euro (nie Credits), erster Monat nur messen. Not-Aus mit Rückfrage (POST /api/agenten — die Route entscheidet, wer darf).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, Plus, Power } from 'lucide-react';
import { FARBE as C, ABSTAND, ECKE, FLAECHE_STIL, LEUCHT, RAND, SCHRIFT, TIEF, TYP, ZIEL } from '@/lib/make-one/design';
import { Knopf, SymbolKnopf } from '../ui';
import { useAgenten, type DialogArt } from './kontext';
import { einstellungSenden } from './daten';
import { euro, kostenImMonat } from './regeln';

export interface MenueEintrag { label: string; satz?: string; tun: () => void; gefahr?: boolean }

/** Ein Menü unter einem Knopf: Esc und Klick daneben schließen; die Einträge sind ganze Knöpfe (≥ 44 px). */
export function Menue({ knopf, eintraege, ariaLabel, rechts, oben, voll }: { knopf: (offen: boolean, umschalten: () => void) => ReactNode; eintraege: readonly MenueEintrag[]; ariaLabel: string; rechts?: boolean; /** Öffnet nach oben (unten im Hintergrund-Feld). */ oben?: boolean; /** So breit wie der Platz der Zeile (in der schmalen Liste — sonst schnitte der Rand des Feldes das Menü ab). */ voll?: boolean }) {
  const [offen, setOffen] = useState(false);
  const wurzel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => { if (!wurzel.current?.contains(e.target as Node)) setOffen(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setOffen(false); };
    window.addEventListener('mousedown', zu);
    window.addEventListener('keydown', taste);
    return () => { window.removeEventListener('mousedown', zu); window.removeEventListener('keydown', taste); };
  }, [offen]);
  return (
    <div ref={wurzel} style={{ position: 'relative', ...(voll ? { flex: '1 1 auto', minWidth: 0 } : {}) }}>
      {knopf(offen, () => setOffen(o => !o))}
      {offen && (
        <div role="menu" aria-label={ariaLabel} style={{ position: 'absolute', [oben ? 'bottom' : 'top']: `calc(100% + ${ABSTAND.s}px)`, ...(voll ? { left: 0, right: 0 } : { [rechts ? 'right' : 'left']: 0, minWidth: 260 }), zIndex: 30,
          ...FLAECHE_STIL.gehoben, border: `1px solid ${RAND.stark}`, borderRadius: ECKE.flach, padding: ABSTAND.s, display: 'grid', gap: 2 }}>
          {eintraege.map(e => (
            <button key={e.label} type="button" role="menuitem" onClick={() => { setOffen(false); e.tun(); }} className="fassbar"
              style={{ display: 'grid', gap: 2, minHeight: ZIEL.handy, padding: `${ABSTAND.s}px ${ABSTAND.m}px`, borderRadius: ECKE.eingabe, border: 'none', background: 'transparent', color: e.gefahr ? LEUCHT.kritisch : C.ink, textAlign: 'left', cursor: 'pointer', fontFamily: SCHRIFT.text }}>
              <span style={{ fontSize: TYP.body, fontWeight: 600 }}>{e.label}</span>
              {e.satz && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{e.satz}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NEU: { label: string; satz: string; art: (headId?: string) => DialogArt }[] = [
  { label: 'Auftrag', satz: 'Jetzt an ZOE, einen Head oder einen Mitarbeiter', art: () => ({ art: 'auftrag' }) },
  { label: 'An mehrere Heads', satz: 'Ein Auftrag, je Head ein Thread', art: () => ({ art: 'mehrere' }) },
  { label: 'Hintergrundaufgabe', satz: 'Jetzt, einmal geplant oder wiederkehrend', art: () => ({ art: 'hintergrund' }) },
  { label: 'Mitarbeiter', satz: 'Aus Vorlage oder beschreiben', art: headId => ({ art: 'mitarbeiter', headId }) },
  { label: 'Skill', satz: 'Anleitung mit Beispielen, Werkzeugen und Tests', art: headId => ({ art: 'skill', headId }) },
];

/**
 * „Neu ▾“: zuerst „Thread“ (ein neues Gespräch dort, wo man gerade ist — mit ZOE, dem gewählten Head bzw. dem Mitarbeiter des offenen
 * Threads), dann die Fenster wie bisher. `symbol` = nur „+“ (Kopfzeile des Gesprächs, wenn die Liste zu ist; Handy).
 */
export function NeuMenue({ symbol }: { symbol?: boolean }) {
  const { dialog, auswahl, starteNeu, starteEntwurf, faeden, agenten } = useAgenten();
  const headId = auswahl.art === 'head' || auswahl.art === 'faden' ? auswahl.headId : undefined;
  const offenerFaden = auswahl.art === 'faden' && faeden.zustand === 'da' ? faeden.daten.faeden.find(f => f.id === auswahl.fadenId) : undefined;
  const mitarbeiter = offenerFaden?.agent.art === 'mitarbeiter' ? offenerFaden.agent : null;
  const head = headId && agenten.zustand === 'da' ? agenten.daten.heads.find(h => h.id === headId) : undefined;
  const maName = mitarbeiter ? head?.mitarbeiter.find(m => m.id === mitarbeiter.mitarbeiterId)?.name : undefined;
  const thread: MenueEintrag = mitarbeiter
    ? { label: 'Thread', satz: `Neuer Thread mit ${maName ?? 'diesem Mitarbeiter'}`, tun: () => starteEntwurf({ headId: mitarbeiter.headId, mitarbeiterId: mitarbeiter.mitarbeiterId }) }
    : { label: 'Thread', satz: head ? `Neuer Thread mit ${head.kurz}` : 'Neues Gespräch mit ZOE', tun: () => starteNeu?.(head ? head.id : 'zoe') };
  const eintraege: MenueEintrag[] = [thread, ...NEU.map(n => ({ label: n.label, satz: n.satz, tun: () => dialog(n.art(headId)) }))];
  return (
    <Menue ariaLabel="Neu anlegen" eintraege={eintraege} voll={!symbol}
      knopf={(offen, um) => symbol
        ? <SymbolKnopf ariaLabel="Neu anlegen" offen={offen} onClick={um}><Plus size={18} /></SymbolKnopf>
        : <Knopf leise onClick={um} ariaLabel={offen ? 'Menü „Neu“ schließen' : 'Neu anlegen'}><Plus size={16} aria-hidden /> Neu ▾</Knopf>} />
  );
}

/**
 * Budget-Balken in Euro: das Instanz-Budget vom Server (Paket 4b) — die strengere von Monats- und Gesamt-Grenze; ohne Grenze nur die
 * gemessene Zahl (Fragerunde 16: „erster Monat nur messen“). Ohne Server-Stand der Rückfall auf die Läufe des Monats.
 */
export function BudgetBalken({ grenzeCent: vorgabe }: { grenzeCent?: number }) {
  const { laeufe, agenten, dialog, jetzt } = useAgenten();
  const b = agenten.zustand === 'da' ? agenten.daten.budget : undefined;
  const teil = b ? (b.gesamt && (b.gesamt.prozent ?? 0) >= (b.monat.prozent ?? -1) ? b.gesamt : b.monat) : null;
  const cent = teil ? teil.verbrauchtCent : laeufe.zustand === 'da' ? kostenImMonat(laeufe.daten.laeufe, jetzt) : null;
  const grenzeCent = teil ? teil.grenzeCent ?? undefined : vorgabe;
  const anteil = cent != null && grenzeCent ? Math.min(1, cent / grenzeCent) : null;
  const farbe = anteil == null ? C.aktiv : anteil >= 0.95 ? LEUCHT.kritisch : anteil >= 0.8 ? LEUCHT.achtung : LEUCHT.gut;
  return (
    <button type="button" onClick={() => dialog({ art: 'budget' })} className="fassbar" aria-label={`${teil && b?.gesamt === teil ? 'Kosten gesamt' : 'Kosten diesen Monat'}: ${cent == null ? 'noch nicht gemessen' : euro(cent)}${grenzeCent ? ` von ${euro(grenzeCent)}` : ' — nur gemessen'} — Budget öffnen`}
      style={{ display: 'grid', gap: ABSTAND.xs, minHeight: ZIEL.rechner, minWidth: 120, width: '100%', padding: `${ABSTAND.xs}px ${ABSTAND.m}px`, borderRadius: ECKE.eingabe, border: `1px solid ${RAND.flaeche}`, background: FLAECHE_STIL.flach.background, color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, textAlign: 'left' }}>
      <span style={{ fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}>{cent == null ? '— €' : euro(cent)}{grenzeCent ? ` / ${euro(grenzeCent)}${teil && b?.gesamt === teil ? ' gesamt' : ' im Monat'}` : ' · gemessen'}</span>
      <span aria-hidden style={{ height: 4, borderRadius: ECKE.eingabe, background: RAND.haar, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.round((anteil ?? (cent ? 1 : 0)) * 100)}%`, background: anteil == null ? TIEF.rand(farbe) : TIEF.verlauf(farbe) }} />
      </span>
    </button>
  );
}

/** Not-Aus für alle: Zustand und „fragen, dann schalten“ — EINE Stelle für den Knopf unten im Hintergrund. */
export function useNotAus(): { an: boolean; fragen: () => Promise<void> } {
  const { bestaetigen, melde, agenten } = useAgenten();
  const an = agenten.zustand === 'da' && agenten.daten.notAus;
  const darf = agenten.zustand === 'da' && agenten.daten.notAusAendern !== false;
  const fragen = async () => {
    if (!darf) { melde('Den Not-Aus für alle setzen und lösen volle Mitglieder des Haushalts — einen einzelnen Head hältst du in seinen Einstellungen an.', 'info'); return; }
    const ja = await bestaetigen({
      titel: an ? 'Not-Aus lösen?' : 'Not-Aus: alle Agenten anhalten?',
      text: an ? 'Zeitpläne laufen danach wieder. Angehaltene Läufe startest du von Hand neu.' : 'Alle Agenten halten sofort an: laufende Hintergrundläufe werden abgebrochen, Zeitpläne und neue Aufträge an Heads ruhen. Mit ZOE sprechen geht weiter.',
      ja: an ? 'Lösen' : 'Alle anhalten', gefahr: !an,
    });
    if (!ja) return;
    const r = await einstellungSenden({ aktion: 'not-aus', an: !an });
    if (!r.ok) { melde(r.text, 'kritisch'); return; }
    melde(an ? 'Not-Aus gelöst.' : `Not-Aus gesetzt${r.daten.angehalten ? ` — ${r.daten.angehalten} ${r.daten.angehalten === 1 ? 'Lauf angehalten' : 'Läufe angehalten'}` : ''}.`, an ? 'gut' : 'info');
  };
  return { an, fragen };
}

export function NotAusKnopf() {
  const { an, fragen } = useNotAus();
  return (
    <Knopf leise onClick={fragen} farbe={LEUCHT.kritisch} ariaLabel={an ? 'Not-Aus ist an — lösen' : 'Not-Aus'}>
      <Power size={16} aria-hidden color={an ? LEUCHT.kritisch : undefined} /> {an ? 'Not-Aus an' : 'Not-Aus'}
    </Knopf>
  );
}

/** „⋯“ unten im Hintergrund: Leitplanken, Budget und Kosten je Head, Zeitpläne, die bisherige Übersicht. */
export function MehrMenue() {
  const { dialog } = useAgenten();
  const eintraege: MenueEintrag[] = [
    { label: 'Leitplanken', satz: 'Was Agenten dürfen — und was nie', tun: () => dialog({ art: 'leitplanken' }) },
    { label: 'Budget und Kosten', satz: 'Grenze je Monat oder gesamt, Kosten je Head', tun: () => dialog({ art: 'budget' }) },
    { label: 'Zeitpläne', satz: 'Wiederkehrende und geplante Aufgaben', tun: () => dialog({ art: 'geplant' }) },
    { label: 'Bisherige Übersicht', satz: 'Alle Agenten mit Schaltern, Modell und Autonomie', tun: () => dialog({ art: 'uebersicht' }) },
  ];
  return <Menue ariaLabel="Mehr" rechts oben eintraege={eintraege}
    knopf={(offen, um) => <SymbolKnopf ariaLabel="Mehr: Leitplanken, Budget, Zeitpläne, bisherige Übersicht" offen={offen} onClick={um}><MoreHorizontal size={20} /></SymbolKnopf>} />;
}
