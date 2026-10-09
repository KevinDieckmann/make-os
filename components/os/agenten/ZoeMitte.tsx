'use client';

// ─── Agenten-Seite: die Mitte ohne Auswahl — ZOE (09.10., Paket 2) ─────────────────────────────────────────────────────
// Antworten (Agenten-Bereich 1 + Fragerunde 3): oben ein Kurz-Briefing als Text von ZOE, darunter die Überblick-Karte —
// was seit dem letzten Besuch passiert ist, woran je Head gearbeitet wird, was die nächsten Tage ansteht, „Wartet auf dich“ mit
// einem Klick, Bezug zu den Jahreszielen —, eine Zeile „Vorschläge“ (Arbeit für heute) und darunter der ZOE-Chat.
// Der Chat läuft auf dem ZOE-Thread der Person (Paket 4a): derselbe Thread wie im ZoePanel und im Empfang (der jüngste ZOE-Thread, oder
// der aus der Adresse `f`), der Verlauf liegt auf dem Server. „An Head … gesendet“ und „Bericht aus …“ stehen darin, wenn ZOE einen Head
// beauftragt. Ansprechen per @Head (Feld oder Chips) schickt die Nachricht direkt in einen Thread dieses Heads.

import { useState } from 'react';
import { FARBE as C, ABSTAND, LEUCHT, MIKRO, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { FadenAntwort, Nachricht } from '@/lib/agenten/typen';
import { KiMarke } from '../KiMarke';
import { Chip, Fortschritt, Karte, Knopf, Leer, Wahl } from '../ui';
import { ZoeKopfKugel, headFarbe } from './Avatar';
import { ChatFeld, ChatVerlauf, Schreibt } from './Chat';
import { anfrageId, ENTSTEHEND_LEER, entstehendNach, fadenLoeschen, fadenSenden, ladeFaden, meldeNeu, stapelEntscheiden, useAbruf, zoeFragen, type Entstehend } from './daten';
import { sichtbareHeads, useAgenten } from './kontext';
import {
  ansprache, ansprechbarFuer, nachEisenhower, risikoVon, vorschlaegeHeute, wartendeFaeden, wiederholText, zeitKurz, zoeFadenAktuell,
  type UeberblickZeileMitHead,
} from './regeln';
import { WEG } from '@/lib/wege';
import { useStimme } from '@/hooks/useStimme';
import { fuerStimme } from '@/lib/make-one/zoe-verlauf';
import { einSpaltig } from './masse';

const zeit = () => new Date().toISOString();
let zaehler = 0;
const nr = () => `nr-lokal-${++zaehler}`;

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

/** Die Überblick-Karte über dem Chat — die EINE Fokus-Karte dieser Ansicht. */
export function Ueberblick() {
  const w = useAgenten();
  const { agenten, laeufe, stapel, faeden, jetzt, melde } = w;
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const farbeVon = (id?: string) => (id ? headFarbe(heads.find(h => h.id === id)?.farbe) : undefined);
  const ue = agenten.zustand === 'da' ? agenten.daten.ueberblick : null;
  const naechste = laeufe.zustand === 'da' ? nachEisenhower(laeufe.daten.naechstes).filter(n => n.art !== 'freigabe').slice(0, 4) : [];
  const vorschlaege = stapel.zustand === 'da' ? stapel.daten.vorschlaege : [];
  const offen = stapel.zustand === 'da' ? stapel.daten.offen : ue?.freigaben.anzahl ?? 0;
  const risikoarm = vorschlaege.filter(v => risikoVon(v) === 'risikoarm').length;
  const wartend = faeden.zustand === 'da' ? wartendeFaeden(faeden.daten.faeden).length : 0;
  const alleRisikoarmen = async () => {
    const r = await stapelEntscheiden({ alle: true });
    if (r.ok) melde(`${r.daten.erledigt ?? 0} risikoarme Freigaben erledigt${r.daten.einzeln ? ` — ${r.daten.einzeln} brauchen je einen Blick` : ''}.`, 'gut');
    else melde(r.text, 'kritisch');
  };
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
        {naechste.length > 0 && (
          <Abschnitt titel="Die nächsten Tage">
            <Zeilen zeilen={naechste.map(n => ({ id: n.id, text: n.weitere ? `${n.titel} · ${wiederholText(n, jetzt)}` : n.titel, zeit: n.wann, headId: n.headId, farbe: n.kritisch ? LEUCHT.kritisch : farbeVon(n.headId) }))} />
          </Abschnitt>
        )}
        <Abschnitt titel="Wartet auf dich">
          <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontSize: TYP.body, color: offen || wartend ? C.ink : C.inkDim, minWidth: 0 }}>
              {offen ? `${offen} Freigabe${offen === 1 ? '' : 'n'}` : 'Keine Freigabe offen'}{wartend ? ` · ${wartend} Thread${wartend === 1 ? '' : 's'} mit Rückfrage` : ''}
            </span>
            {risikoarm > 0 && <Knopf onClick={alleRisikoarmen}>{risikoarm} risikoarme freigeben</Knopf>}
            {offen > 0 && <Knopf leise href={WEG.freigaben()}>Alle ansehen ›</Knopf>}
          </div>
        </Abschnitt>
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

export function ZoeMitte() {
  const w = useAgenten();
  const { agenten, laeufe, stapel, faeden, space, melde, oeffne, form, auswahl, bestaetigen } = w;
  // Welcher ZOE-Thread: aus der Adresse (`f`), sonst der jüngste der Person — derselbe wie im ZoePanel und im Empfang. „Neues Gespräch“
  // setzt `neu`: dann entsteht beim ersten Senden ein neuer Thread.
  const [gewaehlt, setGewaehlt] = useState<{ id: string | null; neu: boolean }>({ id: null, neu: false });
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
      // Rundgang 09.10.: „steht links unter …“ stimmte nicht — links stehen nur die Mitarbeiter-Threads; die Threads des Heads stehen in seinem Chat.
      melde(`An ${an.ziel.name} gesendet — „${r.daten.faden.titel}“ steht im Chat von ${an.ziel.name} (links „${an.ziel.name}“ öffnen).`, 'gut');
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

  // Gespräch löschen (Rundgang 09.10. „Agenten live“): die Route gab es, die Oberfläche nicht. Danach beginnt ein neues Gespräch.
  const gespraechLoeschen = async () => {
    if (!thread || thread.faden.id !== fadenId) return;
    if (!(await bestaetigen({ titel: 'Gespräch löschen?', text: `„${thread.faden.titel}“ wird mit allen Nachrichten gelöscht — auch die Threads, die ZOE daraus an Heads gegeben hat. Das lässt sich nicht rückgängig machen.`, ja: 'Löschen', gefahr: true }))) return;
    const r = await fadenLoeschen(thread.faden.id, thread.stand);
    if (!r.ok) { melde(r.text, 'kritisch'); if (r.status === 409) meldeNeu(); return; }
    setGewaehlt({ id: null, neu: true }); setAusstehend(null);
    melde('Gespräch gelöscht.', 'gut');
  };

  return (
    <div style={{ ...einSpaltig(ABSTAND.l), alignContent: 'start' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.m, minWidth: 0 }}>
        <ZoeKopfKugel denkt={laeuft} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: C.ink }}>ZOE</h2>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Steuert die Heads, bündelt Freigaben und Berichte.</div>
        </div>
      </header>

      {ue?.briefing && (
        <div style={einSpaltig(ABSTAND.xs)}>
          <p style={{ margin: 0, fontSize: TYP.body, lineHeight: 1.6, color: C.ink, overflowWrap: 'anywhere' }}>{ue.briefing}</p>
          {agenten.zustand === 'da' && agenten.daten.ki && <KiMarke text="Briefing von ZOE — bitte prüfen" />}
        </div>
      )}

      <Ueberblick />

      <div style={einSpaltig(ABSTAND.xs)}>
        <span style={{ ...MIKRO }}>Vorschläge für heute</span>
        <div className="ui-pillen ui-pillen-einzeilig">
          {vorschlaege.map(v => <Wahl key={v.id} klein an={false} onClick={() => { if (!laeuft) void senden(v.frage); }}>{v.text}</Wahl>)}
        </div>
      </div>

      <ChatVerlauf nachrichten={zuege} stapel={stapel} kinder={thread?.kinder ?? []}
        leer={<Leer>Frag ZOE etwas — oder sprich einen Head direkt an: <b>@{ansprechbar[0]?.name ?? 'Head'}</b> und dein Auftrag.</Leer>}
        unten={laeuft ? <Schreibt name="ZOE" entsteht={entsteht} /> : undefined} />
      {zuege.length > 0 && (
        <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
          <Knopf leise onClick={() => { setGewaehlt({ id: null, neu: true }); setAusstehend(null); }}>Neues Gespräch</Knopf>
          {thread && thread.faden.id === fadenId && !laeuft && <Knopf leise farbe={LEUCHT.kritisch} onClick={gespraechLoeschen}>Gespräch löschen</Knopf>}
          {heads.length > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, alignSelf: 'center' }}>Heads direkt: {heads.slice(0, 3).map(h => (
            <button key={h.id} type="button" onClick={() => oeffne({ h: h.id })} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkDim, font: 'inherit', cursor: 'pointer', padding: `0 ${ABSTAND.xs}px` }}><Chip farbe={headFarbe(h.farbe)}>{h.kurz}</Chip></button>
          ))}</span>}
        </div>
      )}
      <ChatFeld platzhalter="Nachricht an ZOE … (@Head spricht einen Head an)" ansprechbar={ansprechbar} onSenden={senden} laeuft={laeuft}
        vorlesen={{ an: vorlesen, umschalten: setVorlesen }} unten={form === 'handy' ? 'var(--agenten-feld-unten, 0px)' : undefined} />
    </div>
  );
}
