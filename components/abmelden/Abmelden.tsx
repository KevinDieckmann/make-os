'use client';

// ─── Abmelden (öffentlich, 05.10.) — eine Frage, ein Knopf, eine Antwort. Stil wie die Buchungsseite (components/buchen/stil.ts). ──
// Die Antwort kommt immer vom Server und ist immer dieselbe — die Seite weiß nie, ob es die Adresse gibt.

import { useState } from 'react';
import { seite, rahmen, karte, titel, leise, klein, knopf, C } from '@/components/buchen/stil';

export function Abmelden({ token }: { token: string }) {
  const [stand, setStand] = useState<'frage' | 'sendet' | 'fertig' | 'fehler'>('frage');
  const [text, setText] = useState('');
  async function abmelden() {
    setStand('sendet');
    const r = await fetch(`/api/abmelden/${token}`, { method: 'POST', cache: 'no-store' }).then(x => x.json()).catch(() => null) as { ok?: boolean; text?: string } | null;
    setText(r?.text ?? 'Keine Verbindung — bitte später noch einmal oder antworten Sie einfach auf die Mail.');
    setStand(r?.ok ? 'fertig' : 'fehler');
  }
  return (
    <main style={seite}>
      <div style={{ ...rahmen, maxWidth: 560 }}>
        <div style={karte}>
          <h1 style={titel}>{stand === 'fertig' ? 'Abgemeldet' : 'Keine Werbung mehr?'}</h1>
          {stand === 'fertig'
            ? <p style={{ ...leise, marginTop: 12 }} role="status">{text}</p>
            : <>
                <p style={{ ...leise, marginTop: 12 }}>Mit einem Klick widersprechen Sie der Werbung per E-Mail (Art. 21 DSGVO) und widerrufen Ihre Einwilligung in Newsletter und Einladungen. Persönliche Antworten auf Ihre eigenen Anfragen bekommen Sie weiterhin.</p>
                {stand === 'fehler' && <p style={{ ...leise, color: C.achtung }} role="alert">{text}</p>}
                <button onClick={() => void abmelden()} disabled={stand === 'sendet'} aria-busy={stand === 'sendet'} style={{ ...knopf(stand !== 'sendet'), marginTop: 8 }}>{stand === 'sendet' ? 'Wird abgemeldet …' : 'Jetzt abmelden'}</button>
                <p style={{ ...klein, marginTop: 14 }}>Wir speichern dazu nur den Widerspruch, damit wir Sie nicht wieder anschreiben. Ihre weiteren Rechte (Auskunft, Löschung) nennt der Datenschutzhinweis in der Mail.</p>
              </>}
        </div>
      </div>
    </main>
  );
}
