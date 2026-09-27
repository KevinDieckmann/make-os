import { Suspense } from 'react';
import { SportView } from '@/components/os/sport/SportView';

export const metadata = { title: 'Sport — MAKE OS' };

export default function SportPage() { return <Suspense><SportView /></Suspense>; }
