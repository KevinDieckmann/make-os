'use client';

// ─── Head of IT — die Lage (27.09.) ─────────────────────────────────────────
// Kevin: „Der HOI muss das ganze System immer überwachen, auf Sicherheit achten,
// den Code verbessern … auch von außen.“ Diese Seite ist sein Lagebild: Gesamt-
// ampel, dann je Bereich (Server · App · Sicherheit · Sicherung · Außen) die
// Befunde mit Wert und Satz. Kein KI-Aufruf — reine Zahlen aus /api/hoi/lage.
// Was noch grau ist, sagt, welcher einmalige Schritt fehlt (Cron, Secret).

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Punkt, Zahl, Raster, Hinweis, LEUCHT } from './ui';
import type { Befund, Ampel } from '@/lib/hoi/lage';
import type { Lage } from '@/lib/hoi/innen';

const FARBE: Record<Ampel, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: 'rgba(255,255,255,.25)' };
const BEREICH: { id: Befund['bereich']; label: string; was: string }[] = [
  { id: 'aussen', label: 'Von außen', was: 'was ein Fremder sieht: Erreichbarkeit, Zertifikat, Kopfzeilen' },
  { id: 'sicherheit', label: 'Sicherheit', was: 'Anmeldungen, Abwehr, Verschlüsselung, CSP' },
  { id: 'server', label: 'Server', was: 'Platte, Speicher, Last, Container' },
  { id: 'app', label: 'App', was: 'Arbeiter, Läufe, Fehler in der Oberfläche, Bestände' },
  { id: 'sicherung', label: 'Sicherung', was: 'nächtliche Sicherung und Vault-Abgleich' },
];
const WORT: Record<Ampel, string> = { gruen: 'alles grün', gelb: 'Hinweise', rot: 'Handeln', grau: 'noch keine Daten' };

export function HoiView() {
  const [lage, setLage] = useState<(Lage & { ok: true }) | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const laden = useCallback(async () => {
    setLaedt(true); setFehler(null);
    try {
      const r = await fetch('/api/hoi/lage', { cache: 'no-store' }).then(x => x.json());
      if (r.ok) setLage(r); else setFehler(r.fehler ?? 'Lage nicht lesbar.');
    } catch { setFehler('Keine Verbindung.'); }
    finally { setLaedt(false); }
  }, []);
  useEffect(() => { void laden(); const t = setInterval(() => void laden(), 5 * 60_000); return () => clearInterval(t); }, [laden]);

  const g = lage?.gesamt;
  return (
    <Seite titel="Head of IT" unter="Server, App, Sicherheit und der Blick von außen — in Ampeln. Nichts davon ist eine Person oder ein Inhalt, nur Zähler und Zustände."
      rechts={<Knopf leise onClick={() => void laden()} aus={laedt}>{laedt ? 'lädt …' : 'Neu lesen'}</Knopf>}>
      {fehler && <Hinweis art="kritisch" titel="Der Blick auf die IT ist nicht angekommen" aktion={<Knopf leise onClick={() => void laden()}>Noch einmal versuchen</Knopf>}>{fehler}</Hinweis>}
      {lage && g && (
        <>
          <Karte i={0} ton={g.ampel === 'grau' ? undefined : FARBE[g.ampel]}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <Punkt farbe={FARBE[g.ampel]} groesse={16} />
              <div style={{ fontSize: TYP.titel, fontWeight: 700 }}>{WORT[g.ampel]}</div>
              <div style={{ display: 'flex', gap: 14, marginLeft: 'auto', flexWrap: 'wrap' }}>
                <Zahl wert={String(g.rot)} label="rot" farbe={g.rot ? LEUCHT.kritisch : undefined} />
                <Zahl wert={String(g.gelb)} label="gelb" farbe={g.gelb ? LEUCHT.achtung : undefined} />
                <Zahl wert={String(g.gruen)} label="grün" farbe={LEUCHT.gut} />
                <Zahl wert={String(g.grau)} label="ohne Daten" />
              </div>
            </div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>
              Stand {new Date(lage.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}{!lage.produktion ? ' · Entwicklungsmodus: Verschlüsselung und CSP gelten nur auf dem Server' : ''} · aktualisiert sich alle 5 Minuten
            </div>
          </Karte>
          <Raster min={340}>
            {BEREICH.map((b, i) => {
              const liste = lage.befunde.filter(x => x.bereich === b.id);
              return (
                <Karte key={b.id} i={i + 1}>
                  <Ueberschrift rechts={liste.length ? <Punkt farbe={FARBE[liste.some(x => x.ampel === 'rot') ? 'rot' : liste.some(x => x.ampel === 'gelb') ? 'gelb' : liste.every(x => x.ampel === 'grau') ? 'grau' : 'gruen']} /> : undefined}>{b.label}</Ueberschrift>
                  <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: -4, marginBottom: 8 }}>{b.was}</div>
                  {liste.length ? (
                    <Liste>
                      {liste.map(x => <Zeile key={x.id} links={<Punkt farbe={FARBE[x.ampel]} />} titel={<span>{x.label} <span style={{ color: C.inkDim, fontWeight: 400 }}>· {x.wert}</span></span>} unter={x.satz} />)}
                    </Liste>
                  ) : <Leer>Noch nichts gemeldet.</Leer>}
                </Karte>
              );
            })}
          </Raster>
          <Karte i={7}>
            <Ueberschrift>Kurzbericht</Ueberschrift>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{lage.kurz}</pre>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Derselbe Text geht an Telegram, wenn etwas rot wird — sobald der Bote läuft.</div>
          </Karte>
          <Karte i={8}>
            <Ueberschrift>So sieht der HOI hin</Ueberschrift>
            <Liste>
              <Zeile titel="Innen — die App selbst" unter="Prozess, Bestände, Arbeiter-Takt, Fehlerquote der Läufe, Oberflächenfehler, Fehlanmeldungen und neue Netze, CSP-Meldungen des Browsers" />
              <Zeile titel="Host — deploy/lage-sammeln.sh" unter="alle 5 Minuten per Cron: Platte, Speicher, Last, Container und Neustarts, fail2ban, Zertifikat, Alter der Sicherung, Vault, Sicherheitsupdates" />
              <Zeile titel="Außen — GitHub-Aktion hoi-aussenblick.yml" unter="alle 6 Stunden wie ein Fremder: Status, Antwortzeit, Sicherheits-Kopfzeilen, Zertifikatsrest — meldet mit dem eingeschränkten Schlüssel MAKE_OS_KEY_HOI, der nur /api/hoi/* öffnet" />
              <Zeile titel="Code — CI-Job „sicherheit“" unter="bei jedem Push: npm audit (hoch), gitleaks (Geheimnisse), knip (tote Abhängigkeiten); Dependabot wöchentlich auf entwicklung" />
            </Liste>
          </Karte>
        </>
      )}
      {!lage && !fehler && <Leer>Lage wird gelesen …</Leer>}
    </Seite>
  );
}
