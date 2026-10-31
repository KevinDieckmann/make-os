'use client';

// ─── Markttraktion › Website — selbst pflegen: Angebote & Preise, Bausteine, Inhalte & SEO (31.10., Stufe 2) ─────────────────────────────
// Jeder Eintrag wird einzeln gespeichert (Stand je Eintrag, 409 lädt neu). Angebote mit Produkt-Bezug zeigen den Abgleich mit dem Katalog: weicht der Preis
// ab, steht er rot da — „übernehmen“ in beide Richtungen, nie still (Katalog → Website über diesen Weg, Website → Katalog über den CRM-Schreibweg
// `api.teil('leistungen', …)`). Bausteine: die Datei bleibt die Grundlage, hier nur die Überlagerung (Titel, Preis, Kurztext, Rang, sichtbar).

import { useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Hinweis, Leer, Schalter, Feldzeile, feld, LEUCHT } from '../../ui';
import { neueWebKennung, preisAbgleich, type WebAngebot, type WebFaq, type WebFakt } from '@/lib/website/regeln';
import type { CrmApi } from '../daten';
import { euro, centAus, centText, type WebsiteApi, type WebsiteDaten } from './daten';
import { BausteineKarte } from '../marketing/BausteineKarte';

const zeileStil = { display: 'grid', gap: 10 } as const;
const zwei = { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' } as const;

function Bearbeiten({ titel, unter, rechts, children, offenStart = false }: { titel: ReactNode; unter?: ReactNode; rechts?: ReactNode; children: (zu: () => void) => ReactNode; offenStart?: boolean }) {
  const [offen, setOffen] = useState(offenStart);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Zeile titel={titel} unter={unter} rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{rechts}<Knopf leise onClick={() => setOffen(o => !o)}>{offen ? 'Schließen' : 'Bearbeiten'}</Knopf></span>} umbrechen />
      {offen && <div style={{ padding: '4px 0 12px' }}>{children(() => setOffen(false))}</div>}
    </div>
  );
}

// ── Startwerte ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function StartwerteKarte({ w }: { w: WebsiteApi }) {
  const [vorschau, setVorschau] = useState<{ zaehler: Record<string, number>; fehler: string[]; anzahl: number } | null>(null);
  const [meldung, setMeldung] = useState('');
  if (!w.d?.startwerte || !w.d.istInhaber) return null;
  const rufe = async (vorschauNur: boolean) => {
    setMeldung('');
    const r = await fetch('/api/website/intern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'startwerte', vorschau: vorschauNur }) }).catch(() => null);
    const j = await r?.json().catch(() => ({})) as { fehler?: string; zaehler?: Record<string, number>; fehler_?: string[]; anzahl?: number } & Record<string, unknown>;
    if (!r?.ok) { setMeldung(String(j?.fehler ?? 'Nicht geklappt.')); return; }
    if (vorschauNur) setVorschau({ zaehler: j.zaehler ?? {}, fehler: (j.fehler as unknown as string[]) ?? [], anzahl: j.anzahl ?? 0 });
    else { setVorschau(null); setMeldung(`${j.anzahl ?? 0} Einträge übernommen.`); await w.laden(); }
  };
  return (
    <Karte i={0}>
      <Ueberschrift>Startwerte aus der Website</Ueberschrift>
      <div style={zeileStil}>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Übernimmt die Inhalte, die heute auf der Website stehen — nur Einträge, die hier noch fehlen. Vorhandenes wird nie überschrieben.</span>
        {!vorschau && <span><Knopf onClick={async () => { await rufe(true); }}>Vorschau ansehen</Knopf></span>}
        {vorschau && (
          <>
            <span style={{ fontSize: TYP.body }}>{vorschau.anzahl ? `Neu: ${Object.entries(vorschau.zaehler).filter(([, n]) => n).map(([l, n]) => `${n} ${l}`).join(' · ')}` : 'Nichts zu übernehmen — alles ist schon da.'}</span>
            {vorschau.fehler.length > 0 && <Hinweis art="achtung" titel="Wird nicht übernommen">{vorschau.fehler.slice(0, 6).join(' · ')}</Hinweis>}
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {vorschau.anzahl > 0 && <Knopf haupt onClick={async () => { await rufe(false); }}>Fehlende übernehmen</Knopf>}
              <Knopf leise onClick={() => setVorschau(null)}>Abbrechen</Knopf>
            </span>
          </>
        )}
        {meldung && <Hinweis art="info">{meldung}</Hinweis>}
      </div>
    </Karte>
  );
}

// ── Angebote & Preise ──────────────────────────────────────────────────────────────────────────────────────────────────────────

type AngebotForm = { bereich: string; titel: string; kurz: string; preisText: string; preis: string; ab: boolean; monatlich: boolean; bald: boolean; produktId: string; seite: string; sichtbar: boolean; rang: string };
const formAus = (a?: Partial<WebAngebot>, bereich = ''): AngebotForm => ({
  bereich: a?.bereich ?? bereich, titel: a?.titel ?? '', kurz: a?.kurz ?? '', preisText: a?.preisText ?? '', preis: centText(a?.preisNetto), ab: !!a?.ab, monatlich: !!a?.monatlich,
  bald: !!a?.bald, produktId: a?.produktId ?? '', seite: a?.seite ?? '', sichtbar: a?.sichtbar ?? false, rang: String(a?.rang ?? 0),
});

function AngebotFormular({ d, w, a, onFertig }: { d: WebsiteDaten; w: WebsiteApi; a?: WebsiteDaten['inhalt']['angebote'][number]; onFertig: () => void }) {
  const [f, setF] = useState<AngebotForm>(formAus(a, d.bereiche[0]));
  const [id, setId] = useState(a?.id ?? '');
  const [lokal, setLokal] = useState('');
  const setze = <K extends keyof AngebotForm>(k: K, v: AngebotForm[K]) => setF(x => ({ ...x, [k]: v }));
  const speichern = async () => {
    setLokal('');
    const preisNetto = centAus(f.preis);
    if (Number.isNaN(preisNetto)) { setLokal('Preis: eine Zahl in Euro, z. B. 1.900'); return; }
    if (!a && !/^[a-z0-9-]{1,60}$/.test(id)) { setLokal('Kennung: wie die Seite auf der Website, nur a–z, 0–9 und -'); return; }
    const ok = await w.senden([{ liste: 'angebote', art: 'setze', id: a?.id ?? id, ...(a ? { stand: a.stand } : {}), eintrag: {
      bereich: f.bereich, titel: f.titel, kurz: f.kurz, preisText: f.preisText, ...(preisNetto !== undefined ? { preisNetto } : {}), ab: f.ab, monatlich: f.monatlich, bald: f.bald,
      ...(f.produktId ? { produktId: f.produktId } : {}), ...(f.seite ? { seite: f.seite } : {}), sichtbar: f.sichtbar, rang: Number(f.rang) || 0,
    } }]);
    if (ok) onFertig();
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={zeileStil}>
      <div style={zwei}>
        {!a && <Feldzeile label="Kennung (= Seite auf der Website)"><input style={feld} value={id} onChange={e => setId(e.target.value.trim().toLowerCase())} placeholder="z. B. tagesworkshop" /></Feldzeile>}
        <Feldzeile label="Bereich"><select style={feld} value={f.bereich} onChange={e => setze('bereich', e.target.value)}>{d.bereiche.map(b => <option key={b} value={b}>{b}</option>)}</select></Feldzeile>
        <Feldzeile label="Titel"><input style={feld} value={f.titel} onChange={e => setze('titel', e.target.value)} /></Feldzeile>
        <Feldzeile label="Preistext (≤ 60 Zeichen)"><input style={feld} value={f.preisText} maxLength={60} onChange={e => setze('preisText', e.target.value)} placeholder="ab … € oder auf Anfrage" /></Feldzeile>
        <Feldzeile label="Preis netto in €"><input style={feld} inputMode="decimal" value={f.preis} onChange={e => setze('preis', e.target.value)} /></Feldzeile>
        <Feldzeile label="Produkt im Katalog"><select style={feld} value={f.produktId} onChange={e => setze('produktId', e.target.value)}><option value="">— ohne —</option>{d.hilfen.produkte.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Feldzeile>
        <Feldzeile label="Seite (/… oder https://…)"><input style={feld} value={f.seite} onChange={e => setze('seite', e.target.value)} /></Feldzeile>
        <Feldzeile label="Rang"><input style={feld} inputMode="numeric" value={f.rang} onChange={e => setze('rang', e.target.value)} /></Feldzeile>
      </div>
      <Feldzeile label="Kurztext"><textarea style={{ ...feld, minHeight: 72 }} value={f.kurz} onChange={e => setze('kurz', e.target.value)} /></Feldzeile>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Schalter erklaerung="website.sichtbar" an={f.sichtbar} onChange={v => setze('sichtbar', v)}>Auf der Website zeigen</Schalter>
        <Schalter erklaerung="website.preisart" an={f.ab} onChange={v => setze('ab', v)}>„ab“</Schalter>
        <Schalter erklaerung="website.preisart" an={f.monatlich} onChange={v => setze('monatlich', v)}>monatlich</Schalter>
        <Schalter erklaerung="website.preisart" an={f.bald} onChange={v => setze('bald', v)}>bald</Schalter>
      </div>
      {lokal && <Hinweis art="kritisch">{lokal}</Hinweis>}
      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf haupt typ="submit">Speichern</Knopf>
        {a && <Knopf leise onClick={async () => { if (await w.senden([{ liste: 'angebote', art: 'weg', id: a.id, stand: a.stand }])) onFertig(); }}>Entfernen</Knopf>}
      </span>
    </form>
  );
}

export function AngeboteReiter({ w, api }: { w: WebsiteApi; api: CrmApi }) {
  const d = w.d;
  const [neu, setNeu] = useState(false);
  if (!d) return null;
  const liste = [...d.inhalt.angebote].sort((a, b) => a.rang - b.rang || a.id.localeCompare(b.id));
  const uebernehmenWebsite = async (a: (typeof liste)[number], cent: number | null) => {
    await w.senden([{ liste: 'angebote', art: 'setze', id: a.id, stand: a.stand, eintrag: { ...a, preisNetto: cent ?? undefined } }]);
  };
  const uebernehmenKatalog = async (a: (typeof liste)[number]) => {
    const l = api.crm?.stand.leistungen.find(x => x.id === a.produktId);
    if (!l || typeof a.preisNetto !== 'number') return;
    if (await api.teil('leistungen', l.id, { preis: { ...l.preis, betrag: a.preisNetto / 100 } })) await w.laden();
  };
  return (
    <>
      <StartwerteKarte w={w} />
      <Karte i={1}>
        <Ueberschrift rechts={<Knopf leise onClick={() => setNeu(n => !n)}>{neu ? 'Abbrechen' : '+ Angebot'}</Knopf>}>Angebote & Preise</Ueberschrift>
        {neu && <AngebotFormular d={d} w={w} onFertig={() => setNeu(false)} />}
        {!liste.length && !neu && <Leer>Noch keine Angebote — mit „+ Angebot“ anlegen oder die Startwerte übernehmen.</Leer>}
        <Liste>
          {liste.map(a => {
            const g = preisAbgleich(a, d.hilfen.produkte);
            return (
              <Bearbeiten key={`${a.id}-${a.stand}`} titel={a.titel} unter={`${a.bereich} · ${a.preisText}${a.bald ? ' · bald' : ''}`}
                rechts={<>
                  {!a.sichtbar && <Chip farbe={C.inkLeise}>verborgen</Chip>}
                  {g.art === 'abweichung' && <Chip farbe={LEUCHT.kritisch}>Preis weicht ab</Chip>}
                  {g.art === 'produkt-fehlt' && <Chip farbe={LEUCHT.achtung}>Produkt fehlt</Chip>}
                </>}>
                {zu => (
                  <div style={zeileStil}>
                    {g.art === 'abweichung' && (
                      <Hinweis art="kritisch" titel="Preis weicht vom Produktkatalog ab">
                        Website {euro(g.website)} · Katalog {euro(g.katalog)}
                        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          <Knopf leise onClick={async () => { await uebernehmenWebsite(a, g.katalog); }}>Katalogpreis auf die Website</Knopf>
                          {typeof a.preisNetto === 'number' && <Knopf leise onClick={async () => { await uebernehmenKatalog(a); }}>Website-Preis in den Katalog</Knopf>}
                        </span>
                      </Hinweis>
                    )}
                    <AngebotFormular d={d} w={w} a={a} onFertig={zu} />
                  </div>
                )}
              </Bearbeiten>
            );
          })}
        </Liste>
      </Karte>
    </>
  );
}

// ── Bausteine & Vorlagen ───────────────────────────────────────────────────────────────────────────────────────────────────────

function BausteinFormular({ w, b, ueber, onFertig }: { w: WebsiteApi; b: WebsiteDaten['hilfen']['bausteine'][number]; ueber?: WebsiteDaten['inhalt']['bausteine'][number]; onFertig: () => void }) {
  const [titel, setTitel] = useState(ueber?.titel ?? '');
  const [preis, setPreis] = useState(centText(ueber?.preisNetto));
  const [kurz, setKurz] = useState(ueber?.kurz ?? '');
  const [rang, setRang] = useState(ueber?.rang !== undefined ? String(ueber.rang) : '');
  const [sichtbar, setSichtbar] = useState(ueber?.sichtbar !== false);
  const [lokal, setLokal] = useState('');
  const speichern = async () => {
    const preisNetto = centAus(preis);
    if (Number.isNaN(preisNetto) || preisNetto === 0) { setLokal('Preis: eine Zahl größer 0 in Euro — oder leer (dann gilt die Datei).'); return; }
    const ok = await w.senden([{ liste: 'bausteine', art: 'setze', id: b.id, ...(ueber ? { stand: ueber.stand } : {}), eintrag: {
      ...(titel.trim() ? { titel } : {}), ...(preisNetto !== undefined ? { preisNetto } : {}), ...(kurz.trim() ? { kurz } : {}), ...(rang.trim() ? { rang: Number(rang) || 0 } : {}), sichtbar,
    } }]);
    if (ok) onFertig();
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={zeileStil}>
      <div style={zwei}>
        <Feldzeile label={`Titel (leer = ${b.datei.titel})`}><input style={feld} value={titel} onChange={e => setTitel(e.target.value)} /></Feldzeile>
        <Feldzeile label={`Preis netto in € (leer = ${euro(b.datei.preisNetto)})`}><input style={feld} inputMode="decimal" value={preis} onChange={e => setPreis(e.target.value)} /></Feldzeile>
        <Feldzeile label="Rang"><input style={feld} inputMode="numeric" value={rang} onChange={e => setRang(e.target.value)} /></Feldzeile>
      </div>
      <Feldzeile label="Kurztext"><textarea style={{ ...feld, minHeight: 64 }} value={kurz} onChange={e => setKurz(e.target.value)} /></Feldzeile>
      <Schalter erklaerung="website.sichtbar" an={sichtbar} onChange={setSichtbar}>Auf der Website zeigen und bestellbar</Schalter>
      {lokal && <Hinweis art="kritisch">{lokal}</Hinweis>}
      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf haupt typ="submit">Speichern</Knopf>
        {ueber && <Knopf leise onClick={async () => { if (await w.senden([{ liste: 'bausteine', art: 'weg', id: b.id, stand: ueber.stand }])) onFertig(); }}>Zurück auf die Datei</Knopf>}
      </span>
    </form>
  );
}

export function BausteineReiter({ w }: { w: WebsiteApi }) {
  const d = w.d;
  if (!d) return null;
  return (
    <>
      <BausteineKarte />
      <Karte i={1}>
        <Ueberschrift>Bausteine auf der Website</Ueberschrift>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Grundlage ist der Katalog der Website (Dateien, Seiten, Pakete). Hier überschreibt ihr Titel, Preis und Kurztext — ohne Eintrag gilt die Datei.</span>
        {!d.hilfen.bausteine.length && <Leer>Der Katalog ist leer.</Leer>}
        <Liste>
          {d.hilfen.bausteine.map(b => {
            const u = d.inhalt.bausteine.find(x => x.id === b.id);
            return (
              <Bearbeiten key={`${b.id}-${u?.stand ?? 'datei'}`} titel={b.wirksam.titel} unter={`${b.bereich} · ${euro(b.wirksam.preisNetto)}${b.paket ? ' · Paket' : ''}`}
                rechts={<>{u && <Chip farbe={C.aktiv}>angepasst</Chip>}{b.wirksam.ausgeblendet && <Chip farbe={C.inkLeise}>ausgeblendet</Chip>}</>}>
                {zu => <BausteinFormular w={w} b={b} ueber={u} onFertig={zu} />}
              </Bearbeiten>
            );
          })}
        </Liste>
      </Karte>
      <Karte i={2}>
        <Ueberschrift>Vorlagen per E-Mail (Unterlagen)</Ueberschrift>
        {!d.hilfen.unterlagen.length ? <Leer>Keine Vorlagen im Katalog.</Leer> : (
          <Liste>{d.hilfen.unterlagen.map(u => <Zeile key={u.id} titel={u.titel} unter={`${u.seite} · ${u.arten.join(', ').toUpperCase()}`} />)}</Liste>
        )}
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Die Vorlagen selbst liegen im Ordner der Website; angefordert wird über die Website, die Anfrage landet unter Eingänge.</span>
      </Karte>
    </>
  );
}

// ── Inhalte & SEO: Events, FAQ, Fakten, Texte, Bereiche ─────────────────────────────────────────────────────────────────────────

function EventsKarte({ w }: { w: WebsiteApi }) {
  const d = w.d!;
  const [links, setLinks] = useState<Record<string, string>>({});
  const kommend = d.hilfen.events.filter(e => e.status === 'geplant' || e.status === 'einladung' || d.inhalt.events.some(x => x.eventId === e.id));
  return (
    <Karte i={0}>
      <Ueberschrift>Events auf der Website</Ueberschrift>
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Nur eigene Abende (geplant oder eingeladen), nur Titel, Datum, Ort, Format und Anmeldelink — nie Gäste.</span>
      {!kommend.length ? <Leer>Keine geplanten eigenen Events.</Leer> : (
        <Liste>
          {kommend.map(e => {
            const x = d.inhalt.events.find(y => y.eventId === e.id);
            const link = links[e.id] ?? x?.anmeldeLink ?? '';
            const setze = (sichtbar: boolean) => w.senden([{ liste: 'events', art: 'setze', id: x?.id ?? neueWebKennung('events'), ...(x ? { stand: x.stand } : {}), eintrag: { eventId: e.id, sichtbar, ...(link.trim() ? { anmeldeLink: link.trim() } : {}) } }]);
            return (
              <div key={e.id} style={{ display: 'grid', gap: 6, padding: '6px 0' }}>
                <Zeile titel={e.titel} unter={`${e.datum.slice(0, 10)}${e.uhrzeit ? ` ${e.uhrzeit}` : ''}${e.ort ? ` · ${e.ort}` : ''}`} rechts={<Schalter erklaerung="website.ereignis" an={!!x?.sichtbar} onChange={v => void setze(v)} ariaLabel={`${e.titel} auf der Website zeigen`} />} umbrechen />
                <form onSubmit={ev => { ev.preventDefault(); void setze(!!x?.sichtbar); }} style={{ display: 'flex', gap: 8 }}>
                  <input style={feld} aria-label="Anmeldelink" placeholder="Anmeldelink (https://… oder /…)" value={link} onChange={ev => setLinks(l => ({ ...l, [e.id]: ev.target.value }))} />
                  <Knopf leise typ="submit">Speichern</Knopf>
                </form>
              </div>
            );
          })}
        </Liste>
      )}
    </Karte>
  );
}

function FaqFormular({ w, f, bereiche, onFertig }: { w: WebsiteApi; f?: WebsiteDaten['inhalt']['faq'][number]; bereiche: string[]; onFertig: () => void }) {
  const [x, setX] = useState<Pick<WebFaq, 'frage' | 'antwort' | 'sichtbar'> & { bereich: string; gruppe: string; rang: string }>({ frage: f?.frage ?? '', antwort: f?.antwort ?? '', bereich: f?.bereich ?? '', gruppe: f?.gruppe ?? '', sichtbar: f?.sichtbar ?? true, rang: String(f?.rang ?? 0) });
  const speichern = async () => {
    if (await w.senden([{ liste: 'faq', art: 'setze', id: f?.id ?? neueWebKennung('faq'), ...(f ? { stand: f.stand } : {}), eintrag: { ...x, rang: Number(x.rang) || 0 } }])) onFertig();
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={zeileStil}>
      <Feldzeile label="Frage"><input style={feld} value={x.frage} onChange={e => setX(v => ({ ...v, frage: e.target.value }))} /></Feldzeile>
      <Feldzeile label="Antwort"><textarea style={{ ...feld, minHeight: 90 }} value={x.antwort} onChange={e => setX(v => ({ ...v, antwort: e.target.value }))} /></Feldzeile>
      <div style={zwei}>
        <Feldzeile label="Bereich (frei)"><input style={feld} list="website-bereiche" value={x.bereich} onChange={e => setX(v => ({ ...v, bereich: e.target.value }))} /></Feldzeile>
        <Feldzeile label="Gruppe"><input style={feld} value={x.gruppe} onChange={e => setX(v => ({ ...v, gruppe: e.target.value }))} /></Feldzeile>
        <Feldzeile label="Rang"><input style={feld} inputMode="numeric" value={x.rang} onChange={e => setX(v => ({ ...v, rang: e.target.value }))} /></Feldzeile>
      </div>
      <datalist id="website-bereiche">{bereiche.map(b => <option key={b} value={b} />)}</datalist>
      <Schalter erklaerung="website.sichtbar" an={x.sichtbar} onChange={v => setX(y => ({ ...y, sichtbar: v }))}>Auf der Website zeigen</Schalter>
      <span style={{ display: 'flex', gap: 8 }}>
        <Knopf haupt typ="submit">Speichern</Knopf>
        {f && <Knopf leise onClick={async () => { if (await w.senden([{ liste: 'faq', art: 'weg', id: f.id, stand: f.stand }])) onFertig(); }}>Entfernen</Knopf>}
      </span>
    </form>
  );
}

function FaktFormular({ w, f, onFertig }: { w: WebsiteApi; f?: WebsiteDaten['inhalt']['fakten'][number]; onFertig: () => void }) {
  const [x, setX] = useState<Pick<WebFakt, 'text' | 'sichtbar'> & { titel: string; rang: string }>({ titel: f?.titel ?? '', text: f?.text ?? '', sichtbar: f?.sichtbar ?? true, rang: String(f?.rang ?? 0) });
  const speichern = async () => {
    if (await w.senden([{ liste: 'fakten', art: 'setze', id: f?.id ?? neueWebKennung('fakten'), ...(f ? { stand: f.stand } : {}), eintrag: { ...x, rang: Number(x.rang) || 0 } }])) onFertig();
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={zeileStil}>
      <div style={zwei}>
        <Feldzeile label="Titel"><input style={feld} value={x.titel} onChange={e => setX(v => ({ ...v, titel: e.target.value }))} /></Feldzeile>
        <Feldzeile label="Rang"><input style={feld} inputMode="numeric" value={x.rang} onChange={e => setX(v => ({ ...v, rang: e.target.value }))} /></Feldzeile>
      </div>
      <Feldzeile label="Fakt (eine Zeile, für die KI-Suche)"><input style={feld} value={x.text} onChange={e => setX(v => ({ ...v, text: e.target.value }))} /></Feldzeile>
      <Schalter erklaerung="website.sichtbar" an={x.sichtbar} onChange={v => setX(y => ({ ...y, sichtbar: v }))}>Ausliefern</Schalter>
      <span style={{ display: 'flex', gap: 8 }}>
        <Knopf haupt typ="submit">Speichern</Knopf>
        {f && <Knopf leise onClick={async () => { if (await w.senden([{ liste: 'fakten', art: 'weg', id: f.id, stand: f.stand }])) onFertig(); }}>Entfernen</Knopf>}
      </span>
    </form>
  );
}

function TextFormular({ w, t, onFertig }: { w: WebsiteApi; t?: WebsiteDaten['inhalt']['texte'][number]; onFertig: () => void }) {
  const [schluessel, setSchluessel] = useState(t?.id ?? '');
  const [text, setText] = useState(t?.text ?? '');
  const speichern = async () => {
    if (await w.senden([{ liste: 'texte', art: 'setze', id: schluessel.trim(), ...(t ? { stand: t.stand } : {}), eintrag: { text } }])) onFertig();
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={zeileStil}>
      {!t && <Feldzeile label="Schlüssel (z. B. events.einleitung)"><input style={feld} value={schluessel} onChange={e => setSchluessel(e.target.value.toLowerCase())} /></Feldzeile>}
      <Feldzeile label="Text (≤ 2.000 Zeichen)"><textarea style={{ ...feld, minHeight: 90 }} value={text} maxLength={2000} onChange={e => setText(e.target.value)} /></Feldzeile>
      <span style={{ display: 'flex', gap: 8 }}>
        <Knopf haupt typ="submit">Speichern</Knopf>
        {t && <Knopf leise onClick={async () => { if (await w.senden([{ liste: 'texte', art: 'weg', id: t.id, stand: t.stand }])) onFertig(); }}>Entfernen</Knopf>}
      </span>
    </form>
  );
}

function ListenKarte<T extends { id: string; stand: string }>({ titel, i, liste, neuText, zeile, formular }: {
  titel: string; i: number; liste: T[]; neuText: string; zeile: (x: T) => { titel: string; unter?: string; verborgen?: boolean }; formular: (x: T | undefined, zu: () => void) => ReactNode;
}) {
  const [neu, setNeu] = useState(false);
  return (
    <Karte i={i}>
      <Ueberschrift rechts={<Knopf leise onClick={() => setNeu(n => !n)}>{neu ? 'Abbrechen' : neuText}</Knopf>}>{titel}</Ueberschrift>
      {neu && formular(undefined, () => setNeu(false))}
      {!liste.length && !neu && <Leer>Noch nichts eingetragen.</Leer>}
      <Liste>
        {liste.map(x => { const z = zeile(x); return <Bearbeiten key={`${x.id}-${x.stand}`} titel={z.titel} unter={z.unter} rechts={z.verborgen ? <Chip farbe={C.inkLeise}>verborgen</Chip> : undefined}>{zu => formular(x, zu)}</Bearbeiten>; })}
      </Liste>
    </Karte>
  );
}

function BereicheKarte({ w }: { w: WebsiteApi }) {
  const d = w.d!;
  const [text, setText] = useState(d.bereiche.join(', '));
  return (
    <Karte i={5}>
      <Ueberschrift>Bereiche</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void w.senden([{ liste: 'einstellungen', art: 'setze', stand: d.inhalt.einstellungenStand, eintrag: { ...d.inhalt.einstellungen, bereiche: text.split(',').map(x => x.trim()).filter(Boolean) } }]); }} style={{ display: 'flex', gap: 8 }}>
        <input style={feld} aria-label="Bereiche, mit Komma getrennt" value={text} onChange={e => setText(e.target.value)} />
        <Knopf leise typ="submit">Speichern</Knopf>
      </form>
    </Karte>
  );
}

export function InhalteReiter({ w }: { w: WebsiteApi }) {
  const d = w.d;
  if (!d) return null;
  const nachRang = <T extends { rang: number; id: string },>(l: T[]) => [...l].sort((a, b) => a.rang - b.rang || a.id.localeCompare(b.id));
  return (
    <>
      <StartwerteKarte w={w} />
      <EventsKarte w={w} />
      <ListenKarte titel="Häufige Fragen" i={1} neuText="+ Frage" liste={nachRang(d.inhalt.faq)} zeile={f => ({ titel: f.frage, unter: [f.gruppe, f.bereich].filter(Boolean).join(' · '), verborgen: !f.sichtbar })}
        formular={(f, zu) => <FaqFormular w={w} f={f} bereiche={d.bereiche} onFertig={zu} />} />
      <ListenKarte titel="Fakten für die KI-Suche" i={2} neuText="+ Fakt" liste={nachRang(d.inhalt.fakten)} zeile={f => ({ titel: f.titel ? `${f.titel}: ${f.text}` : f.text, verborgen: !f.sichtbar })}
        formular={(f, zu) => <FaktFormular w={w} f={f} onFertig={zu} />} />
      <ListenKarte titel="Texte" i={3} neuText="+ Text" liste={[...d.inhalt.texte].sort((a, b) => a.id.localeCompare(b.id))} zeile={t => ({ titel: t.id, unter: t.text.slice(0, 90) })}
        formular={(t, zu) => <TextFormular w={w} t={t} onFertig={zu} />} />
      <BereicheKarte w={w} />
    </>
  );
}
