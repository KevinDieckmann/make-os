import { Suspense } from 'react';
import { HeuteView } from '@/components/os/HeuteView';
// Heute (08.10.): die eine Startseite — `?space=privat|business` zeigt nur diesen Space (HeuteView liest die Adresse).
export default function OsPage() { return <Suspense><HeuteView /></Suspense>; }
