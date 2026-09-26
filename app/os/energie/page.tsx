import { redirect } from 'next/navigation';

// Körper & Aufbau ist ein Reiter der Gesundheitsseite (26.09.).
export default function EnergiePage() { redirect('/os/gesundheit?s=koerper'); }
