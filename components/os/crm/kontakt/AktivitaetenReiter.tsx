'use client';

// ─── Kontakt öffnen · Reiter „Aktivitäten“ (28.09., Paket H3) ───────────────
// Kevin (HubSpot als Vorbild): „das ganze Thema Aktivitäten sauber gemacht“ —
// ohne Bezahlschranke. Unter-Reiter Alle · Notizen · E-Mails & Nachrichten ·
// Anrufe · Aufgaben · Meetings (Adresse über `unter`/`onUnter`, Werte
// alle|notizen|emails|anrufe|aufgaben|meetings), je mit Zähler; Suchfeld
// „In Aktivitäten suchen“; Filter als Wahl-Chips: Aktivität (mehrfach, nur
// unter „Alle“), Zeitraum, Person; „Systemereignisse zeigen“; „Filter
// zurücksetzen“; „Alle einklappen/ausklappen“. Oben „Kommend“ (kommende
// Meetings/Termine, offene Follow-ups), darunter je Monat, neueste zuerst.
// Je Unter-Reiter ein „+ …“ (Notiz, E-Mail festhalten, Anruf festhalten,
// Aufgabe, Meeting) — MAKE OS verschickt nichts.
//
// ANKER (für die Zusammenfassung im Reiter „Über“, Quellen-Nummern):
//   Jede Karte trägt `id=<anker>` aus lib/crm/aktivitaeten.ts:
//     Verlauf      `akt-<hash>`  → `aktivitaetAnker(k.aktivitaeten, i)` (stabil, Text egal)
//     Follow-up    `akt-fu-<id>` → `followupAnker(id)`
//     Kalender     `akt-kal-<kontaktId>` → `kalenderAnker(k.id)`
//   Sprung: Kontakt-Adresse mit Reiter Aktivitäten + `#<anker>`. Der Reiter liest
//   den Hash beim Öffnen und bei `hashchange`, stellt Unter-Reiter und Filter so,
//   dass die Karte sichtbar ist, klappt sie auf, scrollt hin und hebt sie kurz hervor.
//
// Logik rein und getestet: lib/crm/aktivitaeten.ts (tests/crm-aktivitaeten.test.ts).
// Karte und Formulare: ./aktivitaeten-teile.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Kontakt } from '@/lib/make-one/crm';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import {
  aufbereiten, filtern, zaehlen, gruppieren, unterAus, filterGesetzt, istAktAnker,
  UNTER_REITER, FILTER_ARTEN, ZEITRAEUME, PERSONEN_FILTER, FILTER_START,
  type Unter, type AktFilter, type Eintrag,
} from '@/lib/crm/aktivitaeten';
import type { CrmApi } from '../daten';
import { Karte, Leer, Knopf, feld, LEUCHT } from '../../schlank';
import { Wahl, WahlMehrfach } from '../Wahl';
import { AktivitaetKarte, NeuFormular, NEU_KNOEPFE, KATEGORIE_FARBE, type NeuArt } from './aktivitaeten-teile';
import { useTerminZeiten, useNaechsterTermin } from '../../kalender/TermineAkte';

export interface AktivitaetenReiterProps {
  k: Kontakt;
  api: CrmApi;
  /** Welcher Unter-Reiter offen ist (aus der Adresse), z. B. „notizen“. */
  unter?: string | null;
  onUnter?: (u: string) => void;
  zuKontakt?: (id: string) => void;
}

const LEER_TEXT: Record<Unter, string> = {
  alle: 'Noch nichts festgehalten.',
  notizen: 'Noch keine Notiz.',
  emails: 'Noch keine E-Mail oder Nachricht festgehalten.',
  anrufe: 'Noch kein Anruf festgehalten.',
  aufgaben: 'Keine Aufgabe und kein Follow-up zu dieser Person.',
  meetings: 'Noch kein Meeting festgehalten, kein Termin im Kalender.',
};
const NEU_FUER: Record<Exclude<Unter, 'alle'>, NeuArt> = { notizen: 'notiz', emails: 'email', anrufe: 'anruf', aufgaben: 'aufgabe', meetings: 'meeting' };
const NEU_TITEL: Record<NeuArt, string> = { notiz: 'Neue Notiz', email: 'E-Mail festhalten', anruf: 'Anruf festhalten', meeting: 'Meeting festhalten', aufgabe: 'Neue Aufgabe' };

const leiseKnopf = { background: 'none', border: 'none', padding: '6px 4px', color: C.inkDim, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SCHRIFT.text, whiteSpace: 'nowrap' } as const;

export function AktivitaetenReiter({ k, api, unter, onUnter }: AktivitaetenReiterProps) {
  // Unter-Reiter: aus der Adresse, sonst hier gemerkt (falls der Aufrufer keine Adresse führt).
  const [lokal, setLokal] = useState<Unter>(() => unterAus(unter));
  const aktiv: Unter = onUnter ? unterAus(unter) : lokal;
  const waehle = useCallback((u: Unter) => { if (onUnter) onUnter(u); else setLokal(u); }, [onUnter]);

  const [filter, setFilter] = useState<AktFilter>(FILTER_START);
  const [kompakt, setKompakt] = useState(false);
  const [zu, setZu] = useState<Set<string>>(() => new Set());
  const [neu, setNeu] = useState<NeuArt | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [markiert, setMarkiert] = useState<string | null>(null);
  const [ziel, setZiel] = useState<string | null>(null);
  const [jetzt, setJetzt] = useState(() => new Date().toISOString());
  const heute = api.crm?.heute ?? localDay();

  // „Kommend“ ist zeitabhängig — jede Minute neu bewerten.
  useEffect(() => { const t = setInterval(() => setJetzt(new Date().toISOString()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!meldung) return; const t = setTimeout(() => setMeldung(null), 4000); return () => clearTimeout(t); }, [meldung]);

  // K3: Meetings mit `terminUid` zeigen die Zeit ihres Termins (verschoben → neue Zeit).
  // F3 (29.09.): der nächste Termin aus demselben Leser (über den Bezug, abgesagte nie) — nicht mehr aus `crm-signale`.
  const terminZeiten = useTerminZeiten(k.id);
  const naechster = useNaechsterTermin(k.id);
  const alle = useMemo<Eintrag[]>(() => aufbereiten(k, api.crm?.stand, { heute, jetzt, termin: naechster ? { id: naechster.id, titel: naechster.titel, start: naechster.start } : null, ...(terminZeiten ? { termine: terminZeiten } : {}) }), [k, api.crm?.stand, naechster, heute, jetzt, terminZeiten]);
  const zahlen = useMemo(() => zaehlen(alle, filter, heute), [alle, filter, heute]);
  const sichtbar = useMemo(() => filtern(alle, aktiv, filter, heute), [alle, aktiv, filter, heute]);
  const gruppen = useMemo(() => gruppieren(sichtbar), [sichtbar]);
  const systemZahl = useMemo(() => alle.filter(e => e.kategorie === 'system').length, [alle]);

  // ── Sprung auf einen Anker (#akt-…) ──
  /** Für welchen Anker der Unter-Reiter schon angefordert wurde. */
  const korrigiert = useRef<string | null>(null);
  useEffect(() => {
    const lesen = () => { const h = decodeURIComponent(window.location.hash.slice(1)); if (istAktAnker(h)) setZiel(h); };
    lesen();
    window.addEventListener('hashchange', lesen);
    return () => window.removeEventListener('hashchange', lesen);
  }, []);
  useEffect(() => {
    if (!ziel) return;
    const e = alle.find(x => x.anker === ziel);
    if (!e) return; // Daten evtl. noch nicht da — beim nächsten Stand erneut
    const passt = filtern([e], aktiv, filter, heute).length > 0;
    if (!passt) {
      // Karte sichtbar machen: Filter zurück (System nur, wenn nötig), Unter-Reiter der Art bzw. „Alle“.
      // Nur ändern, was abweicht — so gibt es keine Schleife; den Unter-Reiter höchstens einmal je Anker anfordern
      // und dann warten, bis die Adresse ihn bringt.
      const soll: AktFilter = { ...FILTER_START, system: e.kategorie === 'system' };
      const sollUnter: Unter = aktiv === 'alle' || e.kategorie === aktiv ? aktiv : e.kategorie === 'system' ? 'alle' : e.kategorie;
      const filterAnders = JSON.stringify(filter) !== JSON.stringify(soll);
      if (filterAnders) setFilter(soll);
      if (sollUnter !== aktiv && korrigiert.current !== ziel) { korrigiert.current = ziel; waehle(sollUnter); }
      else if (!filterAnders && sollUnter === aktiv) setZiel(null); // nichts mehr zu tun und doch unsichtbar — aufgeben
      return;
    }
    setKompakt(false);
    setZu(z => { const g = e.kommend ? 'kommend' : e.tag.slice(0, 7); if (!z.has(g)) return z; const n = new Set(z); n.delete(g); return n; });
    const t = setTimeout(() => {
      document.getElementById(ziel)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setMarkiert(ziel); setZiel(null); korrigiert.current = null;
    }, 60);
    return () => clearTimeout(t);
  }, [ziel, alle, aktiv, filter, heute, waehle]);
  useEffect(() => { if (!markiert) return; const t = setTimeout(() => setMarkiert(null), 2600); return () => clearTimeout(t); }, [markiert]);

  const erledigen = useCallback(async (id: string) => {
    const r = await fetch('/api/crm/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'erledigen', id }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' })) as { ok: boolean; text?: string; fehler?: string };
    if (r.ok) { setMeldung(r.text ?? 'Erledigt.'); await api.laden(); } else api.setFehler(r.fehler ?? 'Nicht erledigt.');
  }, [api]);

  const setze = (x: Partial<AktFilter>) => setFilter(f => ({ ...f, ...x }));
  const alleZu = gruppen.length > 0 && (kompakt || gruppen.every(g => zu.has(g.id)));
  const knoepfe = aktiv === 'alle' ? NEU_KNOEPFE : NEU_KNOEPFE.filter(b => b.id === NEU_FUER[aktiv]);
  const name = k.vorname || k.nachname || k.firma || 'dieser Person';

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Unter-Reiter — einzeilig, am Handy seitlich wischbar */}
      <div role="tablist" aria-label="Aktivitäten" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', whiteSpace: 'nowrap', paddingBottom: 2 }}>
        {UNTER_REITER.map(u => {
          const an = u.id === aktiv;
          return (
            <button key={u.id} role="tab" aria-selected={an} type="button" onClick={() => { waehle(u.id); setNeu(null); }} className="fassbar"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto', padding: '7px 12px', minHeight: 34, borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, fontWeight: 600,
                border: `1px solid ${an ? C.aktiv : 'rgba(255,255,255,.1)'}`, background: an ? `${C.aktiv}22` : 'transparent', color: an ? C.aktiv : C.inkDim }}>
              {u.label}
              <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', padding: '1px 7px', borderRadius: 999, background: an ? `${C.aktiv}22` : 'rgba(255,255,255,.06)', color: an ? C.aktiv : C.inkLeise }}>{zahlen[u.id]}</span>
            </button>
          );
        })}
      </div>

      <Karte i={0}>
        {/* Suche + Aktionen */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="search" value={filter.suche} onChange={e => setze({ suche: e.target.value })} placeholder="In Aktivitäten suchen" aria-label="In Aktivitäten suchen"
            style={{ ...feld, flex: '1 1 220px', width: 'auto', fontSize: TYP.bedien, padding: '9px 12px' }} />
          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {knoepfe.map(b => (
              <button key={b.id} type="button" onClick={() => setNeu(neu === b.id ? null : b.id)} aria-expanded={neu === b.id} className="fassbar"
                style={{ fontFamily: SCHRIFT.text, fontSize: 12.5, fontWeight: 700, padding: '7px 12px', minHeight: 34, borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
                  border: `1px solid ${KATEGORIE_FARBE[b.kategorie]}55`, background: neu === b.id ? `${KATEGORIE_FARBE[b.kategorie]}22` : `${KATEGORIE_FARBE[b.kategorie]}0F`, color: C.ink }}>{b.label}</button>
            ))}
          </span>
        </div>

        {/* Filterzeile */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          {aktiv === 'alle' && (
            <WahlMehrfach label="Aktivität" liste={FILTER_ARTEN.map(a => ({ ...a, hinweis: String(zahlen[a.id]) }))} wert={filter.arten} onWahl={arten => setze({ arten })}
              leer={`Aktivität (${FILTER_ARTEN.length}/${FILTER_ARTEN.length})`} klein />
          )}
          <Wahl label="Zeitraum" liste={ZEITRAEUME} wert={filter.zeitraum} onWahl={zeitraum => setze({ zeitraum })} klein farbe={filter.zeitraum === 'beginn' ? C.inkDim : C.aktiv} />
          <Wahl label="Aktivität zugewiesen" liste={PERSONEN_FILTER} wert={filter.person} onWahl={person => setze({ person })} onLeeren={() => setze({ person: null })} leerenLabel="alle Personen" leer="Person: alle" klein />
          {aktiv === 'alle' && systemZahl > 0 && (
            <button type="button" role="switch" aria-checked={filter.system} onClick={() => setze({ system: !filter.system })} className="fassbar"
              style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, padding: '3px 9px', minHeight: 26, borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${filter.system ? C.aktiv : 'rgba(255,255,255,.1)'}`, background: filter.system ? `${C.aktiv}1A` : 'transparent', color: filter.system ? C.aktiv : C.inkDim }}>
              {filter.system ? '✓ ' : ''}Systemereignisse zeigen ({systemZahl})
            </button>
          )}
          <span style={{ flex: 1 }} />
          {filterGesetzt(filter) && <button type="button" onClick={() => setFilter(FILTER_START)} className="fassbar" style={{ ...leiseKnopf, color: C.aktiv }}>Filter zurücksetzen</button>}
          {gruppen.length > 0 && (
            <button type="button" onClick={() => { if (alleZu) { setKompakt(false); setZu(new Set()); } else setKompakt(true); }} className="fassbar" style={leiseKnopf}>
              {alleZu ? 'Alle ausklappen' : 'Alle einklappen'}
            </button>
          )}
        </div>

        {meldung && <div role="status" style={{ marginTop: 10, fontSize: 12.5, color: LEUCHT.gut }}>{meldung}</div>}

        {/* „+ …“-Formular */}
        {neu && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>{NEU_TITEL[neu]}</div>
            <NeuFormular key={neu} art={neu} k={k} api={api} heute={heute} onAbbruch={() => setNeu(null)} onFertig={t => { setNeu(null); setMeldung(t); }} />
          </div>
        )}
      </Karte>

      {/* Liste */}
      {gruppen.length === 0 ? (
        <Karte i={1}>
          {filterGesetzt(filter) && sichtbar.length === 0 && alle.some(e => filtern([e], aktiv, { ...FILTER_START, system: true }, heute).length) ? (
            <Leer>Nichts passt zu Suche und Filter. <button type="button" onClick={() => setFilter(FILTER_START)} className="fassbar" style={{ ...leiseKnopf, color: C.aktiv }}>Filter zurücksetzen</button></Leer>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Leer>{LEER_TEXT[aktiv]}{aktiv === 'alle' ? ` Was mit ${name} passiert, steht hier — das Erste gleich festhalten.` : ''}</Leer>
              {aktiv !== 'alle' && !neu && <Knopf onClick={() => setNeu(NEU_FUER[aktiv])}>{NEU_KNOEPFE.find(b => b.id === NEU_FUER[aktiv])?.label}</Knopf>}
            </div>
          )}
        </Karte>
      ) : gruppen.map((g, gi) => {
        const gZu = zu.has(g.id);
        const istKommend = g.id === 'kommend';
        const ueber = istKommend ? g.eintraege.filter(e => e.ueberfaellig).length : 0;
        return (
          <section key={g.id} aria-label={g.label} className="os-auf" style={{ ['--i' as string]: gi + 1, display: 'grid', gap: 8 }}>
            <button type="button" onClick={() => setZu(z => { const n = new Set(z); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })} aria-expanded={!gZu} className="fassbar"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', color: istKommend ? C.aktiv : C.inkDim, fontFamily: SCHRIFT.text,
                fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'left' }}>
              <span aria-hidden style={{ display: 'inline-block', transform: gZu ? 'rotate(-90deg)' : 'none', transition: 'transform .2s ease' }}>▾</span>
              {g.label}
              <span style={{ fontWeight: 600, color: C.inkLeise, letterSpacing: 0, textTransform: 'none' }}>{g.eintraege.length}{ueber ? ` · ${ueber} überfällig` : ''}</span>
            </button>
            {!gZu && g.eintraege.map(e => (
              <AktivitaetKarte key={e.anker} e={e} k={k} api={api} heute={heute} kompakt={kompakt} markiert={markiert === e.anker} onErledigen={erledigen} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
