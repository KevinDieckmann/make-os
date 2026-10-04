import { KapazitaetAnsicht } from '@/components/os/kapazitaet/KapazitaetAnsicht';

export const dynamic = 'force-dynamic';

/** Kapazität (04.10.): Zeit und Machbarkeit je Person und Woche — Rechnung und Filter auf dem Server (lib/kapazitaet). */
export default function KapazitaetPage() {
  return <KapazitaetAnsicht />;
}
