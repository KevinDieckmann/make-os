'use client';

// ─── Agenten-Seite: die Mitte ohne Auswahl — ZOE (09.10., Paket 2; Aufräumen 09.10. abends nach dem Claude-Muster) ─────────────
// Antworten (Agenten-Bereich 1 + Fragerunde 3): Kurz-Briefing von ZOE, was seit dem letzten Besuch passiert ist, Vorschläge für heute,
// darunter der ZOE-Chat. Aufräumen 09.10. (Kevin: „Mitte nur Gespräch“): über dem Chat steht nur die Kopfzeile. Briefing, „Seit deinem
// letzten Besuch“ (höchstens drei Zeilen) und die Vorschlag-Chips stehen NUR, solange das Gespräch leer ist — danach nur der Verlauf.
// Was vorher als Überblick-Karte darüber stand, liegt jetzt dort, wo es hingehört:
//   • „Wartet auf dich“ und „Die nächsten Tage“ → rechts im Hintergrund („Wartet auf dich“, „Geplant“);
//   • alles, was passiert ist, „Woran gearbeitet wird“ und die Jahresziele → „Info“ (Knopf ⓘ in der Kopfzeile). ZOE kennt die
//     Jahresziele ohnehin aus dem Kontext (lib/planung/jahresziele-sicht.ts).
// Der Chat läuft auf dem ZOE-Thread der Person (Paket 4a): derselbe Thread wie im ZoePanel und im Empfang (der jüngste ZOE-Thread, der aus
// der Adresse `f` oder — nach „Neues Gespräch“ — ein neuer). „An Head … gesendet“ und „Bericht aus …“ stehen darin, wenn ZOE einen Head
// beauftragt. Ansprechen per @Head (beim Tippen von „@“ erscheinen die Heads) schickt die Nachricht direkt in einen Thread dieses Heads.

import { useState } from 'react';
import { FARBE as C, ABSTAND, MIKRO, TYP } from '@/lib/make-one/design';
import type { FadenAntwort, Nachricht } from '@/lib/agenten/typen';
import { KiMarke } from '../KiMarke';
import { Fortschritt, Karte, Knopf, Leer, Wahl } from '../ui';
import { ZoeKopfKugel, headFarbe } from './Avatar';
import { ChatFeld, ChatVerlauf, Schreibt } from './Chat';
import { GespraechKopf } from './GespraechKopf';
import { anfrageId, ENTSTEHEND_LEER, entstehendNach, fadenSenden, ladeFaden, useAbruf, zoeFragen, type Entstehend } from './daten';
import { sichtbareHeads, useAgenten } from './kontext';
import { ansprache, ansprechbarFuer, vorschlaegeHeute, wartendeFaeden, zeitKurz, zoeFadenAktuell, type UeberblickZeileMitHead } from './regeln';
import { useStimme } from '@/hooks/useStimme';
import { fuerStimme } from '@/lib/make-one/zoe-verlauf';
import { einSpaltig, KUGEL_GROESSE } from './masse';

const zeit = () => new Date().toISOString();
let zaehler = 0;
const nr = () => `nr-lokal-${++zaehler}`;
/** So viele Zeilen „Seit deinem letzten Besuch“ stehen über dem leeren Gespräch — der Rest unter „Info“. */
const SEIT_ZEILEN = 3;

function Abschnitt({ titel, rechts, children }: { titel: string; rechts?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={einSpaltig(ABSTAND.xs)}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: ABSTAND.s, minWidth: 0 }}><span style={{ ...MIKRO, minWidth: 0 }}>{titel}</span>{rechts}</div>
      {children}
    </div>
  );
}

function Zeilen({ zeilen }: { zeilen: readonly UeberblickZeileMitHead[] }) {
  const { oeffne, jetzt } = useAgenten();
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, ...einSpaltig(2) }}>
      {zeilen.map(z => (
        <li key={z.id} style={{ display: 'flex', alignItems: 'flex-start', gap: ABSTAND.s, minWidth: 0, fontSize: TYP.body, lineHeight: 1.45, color: C.ink }}>
          <span aria-hidden style={{ color: z.farbe ?? C.inkLeise, flex: '0 0 auto' }}>●</span>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
            {z.headId ? <button type="button" onClick={() => oeffne({ h: z.headId })} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', maxWidth: '100%', overflowWrap: 'anywhere' }}>{z.text}</button> : z.text}
          </span>
          {z.zeit && <span style={{ flex: '0 0 auto', fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap', lineHeight: 1.7 }}>{zeitKurz(z.zeit, jetzt)}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * „Info“ zu ZOE — die EINE Fokus-Karte dieser Ansicht: was seit dem letzten Besuch passiert ist (alles), woran gerade gearbeitet wird und die
 * Jahresziele mit Fortschritt. Was wartet und was geplant ist, steht rechts im Hintergrund.
 */
export function Ueberblick() {
  const { agenten, jetzt } = useAgenten();
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const farbeVon = (id?: string) => (id ? headFarbe(heads.find(h => h.id === id)?.farbe) : undefined);
  const ue = agenten.zustand === 'da' ? agenten.daten.ueberblick : null;
  return (
    <Karte ton="fokus" netz ariaLabel="Überblick">
      <div style={einSpaltig(ABSTAND.l)}>
        <Abschnitt titel={ue?.seit ? `Seit deinem letzten Besuch (${zeitKurz(ue.seit, jetzt)})` : 'Was passiert ist'}>
          {ue ? (ue.passiert.length ? <Zeilen zeilen={ue.passiert.map(z => ({ ...z, farbe: farbeVon(z.headId) }))} /> : <span style={{ fontSize: TYP.body, color: C.inkDim }}>Seitdem ist nichts passiert.</span>)
            : <Leer>{agenten.zustand === 'laedt' ? 'Der Überblick wird geladen …' : 'Was passiert ist und woran gearbeitet wird, steht hier, sobald der Agenten-Kern läuft.'}</Leer>}
        </Abschnitt>
        {ue && (
          <Abschnitt titel="Woran gearbeitet wird">
            {ue.inArbeit.length ? <Zeilen zeilen={ue.inArbeit.map(z => ({ ...z, farbe: farbeVon(z.headId) }))} /> : <span style={{ fontSize: TYP.body, color: C.inkDim }}>Gerade arbeitet kein Head im Hintergrund.</span>}
          </Abschnitt>
        )}
        {ue && ue.ziele.length > 0 && (
          <Abschnitt titel="Jahresziele">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, ...einSpaltig(ABSTAND.s) }}>
              {ue.ziele.map(z => (
                <li key={z.id} style={einSpaltig(ABSTAND.xs)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: ABSTAND.s, minWidth: 0, fontSize: TYP.body }}>
                    {/* Ein langer Zieltitel bricht um (der Knopf bliebe sonst einzeilig und schöbe Prozent und Balken über den Rand). */}
                    <Knopf leise href={z.link} style={{ flex: '1 1 auto', minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{z.titel} ›</Knopf>
                    <span style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{z.fortschritt == null ? '—' : `${z.fortschritt} %`}</span>
                  </div>
                  {z.fortschritt != null && <Fortschritt anteil={z.fortschritt / 100} farbe={C.aktiv} />}
                </li>
              ))}
            </ul>
          </Abschnitt>
        )}
      </div>
    </Karte>
  );
}

/** Über dem LEEREN Gespräch: Briefing, höchstens drei Zeilen „Seit deinem letzten Besuch“, Vorschläge für heute. */
function Begruessung({ vorschlaege, senden, laeuft, zuInfo, ansprechName }: {
  vorschlaege: readonly { id: string; text: string; frage: string }[]; senden: (t: string) => void; laeuft: boolean; zuInfo: () => void; ansprechName?: string;
}) {
  const { agenten, jetzt } = useAgenten();
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const farbeVon = (id?: string) => (id ? headFarbe(heads.find(h => h.id === id)?.farbe) : undefined);
  const ue = agenten.zustand === 'da' ? agenten.daten.ueberblick : null;
  const seit = ue?.passiert ?? [];
  return (
    <div style={{ ...einSpaltig(ABSTAND.xl), paddingTop: ABSTAND.l }}>
      {ue?.briefing && (
        <div style={einSpaltig(ABSTAND.xs)}>
          <p style={{ margin: 0, fontSize: TYP.body, lineHeight: 1.6, color: C.ink, overflowWrap: 'anywhere' }}>{ue.briefing}</p>
          {agenten.zustand === 'da' && agenten.daten.ki && <KiMarke text="Briefing von ZOE — bitte prüfen" />}
        </div>
      )}
      {seit.length > 0 && (
        <Abschnitt titel={ue?.seit ? `Seit deinem letzten Besuch (${zeitKurz(ue.seit, jetzt)})` : 'Was passiert ist'}
          rechts={seit.length > SEIT_ZEILEN ? <Knopf leise onClick={zuInfo}>+ {seit.length - SEIT_ZEILEN} weitere</Knopf> : undefined}>
          <Zeilen zeilen={seit.slice(0, SEIT_ZEILEN).map(z => ({ ...z, farbe: farbeVon(z.headId) }))} />
        </Abschnitt>
      )}
      <div style={einSpaltig(ABSTAND.xs)}>
        <span style={{ ...MIKRO }}>Vorschläge für heute</span>
        <div className="ui-pillen ui-pillen-einzeilig">
          {vorschlaege.map(v => <Wahl key={v.id} klein an={false} onClick={() => { if (!laeuft) senden(v.frage); }}>{v.text}</Wahl>)}
        </div>
      </div>
      <Leer symbol="✦">Frag ZOE etwas — oder sprich einen Head direkt an: <b>@{ansprechName ?? 'Head'}</b> und dein Auftrag.</Leer>
    </div>
  );
}

export function ZoeMitte({ neu = false }: { /** „Neues Gespräch“ (Kopfzeile, „Neu ▾ › Thread“): beim ersten Senden entsteht ein neuer Thread. */ neu?: boolean }) {
  const w = useAgenten();
  const { agenten, laeufe, stapel, faeden, space, melde, oeffne, form, auswahl, bestaetigen, starteNeu } = w;
  // Welcher ZOE-Thread: aus der Adresse (`f`), sonst der jüngste der Person — derselbe wie im ZoePanel und im Empfang. „Neues Gespräch“
  // setzt `neu`: dann entsteht beim ersten Senden ein neuer Thread.
  const [gewaehlt, setGewaehlt] = useState<{ id: string | null; neu: boolean }>({ id: null, neu });
  const [ansicht, setAnsicht] = useState<'chat' | 'info'>('chat');
  const fadenId = gewaehlt.neu ? gewaehlt.id : (gewaehlt.id ?? (auswahl.art === 'zoe' ? auswahl.fadenId : undefined) ?? zoeFadenAktuell(faeden.zustand === 'da' ? faeden.daten.faeden : []));
  const vorgegeben = fadenId ? w.vorlage?.faeden?.[fadenId] : undefined;
  const geladen = useAbruf<FadenAntwort>(fadenId && !vorgegeben ? `zoe-faden:${fadenId}` : null, () => ladeFaden(fadenId!));
  const thread = vorgegeben ?? (geladen.stand.zustand === 'da' ? geladen.stand.daten : null);
  // Was gerade unterwegs ist (eigene Nachricht, dann die Antwort) — nur bis der Thread vom Server sie zeigt (`basis` = Länge davor).
  const [ausstehend, setAusstehend] = useState<{ basis: number; n: Nachricht[] } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  // Was gerade entsteht (Streaming): Text bisher und das laufende Werkzeug — bis der Thread vom Server die Antwort zeigt.
  const [entsteht, setEntsteht] = useState<Entstehend>(ENTSTEHEND_LEER);
  const [vorlesen, setVorlesen] = useState(false);
  const stimme = useStimme(() => { /* nur Vorlesen — Diktat sitzt im Feld */ });
  const gespeichert = thread && thread.faden.id === fadenId ? thread.faden.nachrichten : [];
  const zuege: Nachricht[] = [...gespeichert, ...(ausstehend && gespeichert.length <= ausstehend.basis ? ausstehend.n : [])];

  const heads = sichtbareHeads(w);
  const ansprechbar = ansprechbarFuer('zoe', heads);
  const ue = agenten.zustand === 'da' ? agenten.daten.ueberblick : null;
  const offen = stapel.zustand === 'da' ? stapel.daten.offen : ue?.freigaben.anzahl ?? 0;
  const vorschlaege = vorschlaegeHeute({
    freigaben: offen,
    naechstes: laeufe.zustand === 'da' ? laeufe.daten.naechstes : [],
    wartend: faeden.zustand === 'da' ? wartendeFaeden(faeden.daten.faeden).length : 0,
  });

  const senden = async (text: string): Promise<boolean> => {
    const an = ansprache(text, ansprechbar);
    const meins: Nachricht = { id: nr(), rolle: 'person', von: 'ich', text, zeit: zeit() };
    if (an && an.ziel.art === 'head') {
      if (!an.rest) { melde(`Was soll ${an.ziel.name} tun? Schreib den Auftrag hinter @${an.ziel.name}.`, 'info'); return false; }
      setLaeuft(true);
      const r = await fadenSenden({ aktion: 'senden', agent: { art: 'head', headId: an.ziel.id }, text: an.rest, anfrageId: anfrageId() });
      setLaeuft(false);
      if (!r.ok) { melde(r.kommt ? 'Head-Chats kommen mit dem Agenten-Kern — die Nachricht ist noch nicht gesendet.' : r.text, r.kommt ? 'info' : 'kritisch'); return false; }
      melde(`An ${an.ziel.name} gesendet — der Thread steht links unter ${an.ziel.name}.`, 'gut');
      return true;
    }
    const basis = gespeichert.length;
    setAusstehend({ basis, n: [meins] });
    setLaeuft(true); setEntsteht(ENTSTEHEND_LEER);
    const r = await zoeFragen({ message: text, space, zoeFaden: fadenId ?? 'neu' }, e => setEntsteht(s => entstehendNach(s, e)));
    setLaeuft(false); setEntsteht(ENTSTEHEND_LEER);
    if (!r.ok) { setAusstehend(null); melde(r.text || 'ZOE konnte gerade nicht antworten — versuch es noch einmal.', 'kritisch'); return false; }
    const neuerFaden = !!r.daten.fadenId && r.daten.fadenId !== fadenId;
    const antwort: Nachricht = { id: nr(), rolle: 'agent', von: 'zoe', text: r.daten.reply ?? '', zeit: zeit(), ...(r.daten.ki ? { ki: true as const } : {}) };
    setAusstehend({ basis: neuerFaden ? 0 : basis, n: [meins, antwort] });
    if (neuerFaden) setGewaehlt({ id: r.daten.fadenId!, neu: true });
    if (vorlesen && r.daten.reply) stimme.lies(fuerStimme(r.daten.reply));
    return true;
  };

  const neuesGespraech = () => {
    setAnsicht('chat'); setAusstehend(null);
    if (starteNeu) starteNeu('zoe'); else setGewaehlt({ id: null, neu: true });
  };
  // Ein Gespräch löschen (Server: samt aller Threads darunter, nur eigene) — mit Rückfrage; danach steht der jüngste übrige Thread.
  const loeschen = async () => {
    if (!thread) return;
    if (!(await bestaetigen({ titel: 'Gespräch löschen?', text: `„${thread.faden.titel}“ und alle Aufträge darin an Heads und Mitarbeiter werden gelöscht.`, ja: 'Löschen', gefahr: true }))) return;
    const r = await fadenSenden({ aktion: 'loeschen', fadenId: thread.faden.id, stand: thread.stand });
    if (!r.ok) { melde(r.text, 'kritisch'); return; }
    melde('Gespräch gelöscht.', 'gut');
    setAusstehend(null); setGewaehlt({ id: null, neu: false });
    oeffne({}, true);
  };
  const info = ansicht === 'info';

  return (
    <div style={{ ...einSpaltig(ABSTAND.l), alignContent: 'start' }}>
      <GespraechKopf avatar={<ZoeKopfKugel denkt={laeuft} groesse={KUGEL_GROESSE.liste} />} titel="ZOE"
        zusatz={thread && !gewaehlt.neu ? thread.faden.titel : gewaehlt.neu && !gewaehlt.id ? 'Neues Gespräch' : undefined}
        info={{ an: info, umschalten: () => setAnsicht(info ? 'chat' : 'info') }}
        neu={{ label: 'Neues Gespräch', tun: neuesGespraech }}
        menue={[
          { label: 'Neues Gespräch', satz: 'Leer anfangen — das bisherige bleibt links unter ZOE', tun: neuesGespraech },
          { label: info ? 'Zurück zum Gespräch' : 'Info', satz: info ? undefined : 'Was passiert ist, woran gearbeitet wird, Jahresziele', tun: () => setAnsicht(info ? 'chat' : 'info') },
          ...(thread && zuege.length ? [{ label: 'Gespräch löschen', satz: 'Mit allen Aufträgen darin', gefahr: true, tun: () => { void loeschen(); } }] : []),
        ]} />

      {info ? (
        <>
          <Ueberblick />
          <div><Knopf leise onClick={() => setAnsicht('chat')}>‹ Zurück zum Gespräch</Knopf></div>
        </>
      ) : (
        <>
          <ChatVerlauf nachrichten={zuege} stapel={stapel} kinder={thread?.kinder ?? []}
            leer={<Begruessung vorschlaege={vorschlaege} senden={t => { void senden(t); }} laeuft={laeuft} zuInfo={() => setAnsicht('info')} ansprechName={ansprechbar[0]?.name} />}
            unten={laeuft ? <Schreibt name="ZOE" entsteht={entsteht} /> : undefined} />
          <ChatFeld platzhalter="Nachricht an ZOE … (@Head spricht einen Head an)" ansprechbar={ansprechbar} onSenden={senden} laeuft={laeuft}
            vorlesen={{ an: vorlesen, umschalten: setVorlesen }} unten={form === 'handy' ? 'var(--agenten-feld-unten, 0px)' : undefined} />
        </>
      )}
    </div>
  );
}
