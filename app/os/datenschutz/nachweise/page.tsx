// Alte Adresse (05.10.): die Nachweise sind Teil der einen Datenschutz-Seite.
import { redirect } from 'next/navigation';
import { WEG } from '@/lib/wege';
export default function NachweiseSeite() { redirect(WEG.datenschutz('nachweise')); }
