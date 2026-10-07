import { Suspense } from 'react';
import { InboxZwei } from '@/components/os/inbox/InboxZwei';
// Inbox 2 (06.10.2026): EINE Inbox — Lagebild, Fächer, Gespräch mit Kontext (components/os/inbox/InboxZwei.tsx). /os/inbox/voll leitet hierher.
export default function InboxPage() { return <Suspense fallback={null}><InboxZwei /></Suspense>; }
