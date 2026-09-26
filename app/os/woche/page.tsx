import { redirect } from 'next/navigation';

// Der Wochen-Rhythmus war eine feste Tabelle vom 29.07. — die Woche lebt im Kalender (26.09.).
export default function WochePage() { redirect('/os/planung/woche'); }
