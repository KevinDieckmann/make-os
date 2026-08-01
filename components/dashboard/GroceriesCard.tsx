'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Minus, Check, ChevronDown,
  Leaf, Egg, Package, Sparkles, Coffee,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Kategorie = 'Gemüse & Obst' | 'Proteine & Milchprodukte' | 'Trockenwaren' | 'Getränke' | 'Haushalt';

interface Artikel {
  id: string;
  name: string;
  kategorie: Kategorie;
  menge: number;
  einheit: string;
  erledigt: boolean;
}

// ─── Static data ─────────────────────────────────────────────────────────────

const SCHNELLAUSWAHL: Array<{ name: string; kategorie: Kategorie; einheit: string; emoji: string }> = [
  { name: 'Hafermilch',  kategorie: 'Getränke',               einheit: 'L',   emoji: '🥛' },
  { name: 'Kaffee',      kategorie: 'Trockenwaren',           einheit: 'Pkg', emoji: '☕' },
  { name: 'Eier',        kategorie: 'Proteine & Milchprodukte', einheit: 'Stk', emoji: '🥚' },
  { name: 'Beeren',      kategorie: 'Gemüse & Obst',          einheit: 'g',   emoji: '🍓' },
  { name: 'Avocado',     kategorie: 'Gemüse & Obst',          einheit: 'Stk', emoji: '🥑' },
  { name: 'Tofu',        kategorie: 'Proteine & Milchprodukte', einheit: 'g',   emoji: '🫙' },
  { name: 'Waschpulver', kategorie: 'Haushalt',               einheit: 'Pkg', emoji: '🧺' },
  { name: 'Bananen',     kategorie: 'Gemüse & Obst',          einheit: 'Stk', emoji: '🍌' },
];

const INITIAL_ARTIKEL: Artikel[] = [
  { id: 'a1', name: 'Avocados',             kategorie: 'Gemüse & Obst',           menge: 3,   einheit: 'Stk', erledigt: false },
  { id: 'a2', name: 'Spinat',               kategorie: 'Gemüse & Obst',           menge: 200, einheit: 'g',   erledigt: false },
  { id: 'a3', name: 'Griechischer Joghurt', kategorie: 'Proteine & Milchprodukte', menge: 500, einheit: 'g',   erledigt: false },
  { id: 'a4', name: 'Hühnerbrust',          kategorie: 'Proteine & Milchprodukte', menge: 600, einheit: 'g',   erledigt: false },
  { id: 'a5', name: 'Hafermilch',           kategorie: 'Getränke',                menge: 2,   einheit: 'L',   erledigt: true  },
  { id: 'a6', name: 'Vollkornbrot',         kategorie: 'Trockenwaren',            menge: 1,   einheit: 'Stk', erledigt: false },
  { id: 'a7', name: 'Waschmittel',          kategorie: 'Haushalt',                menge: 1,   einheit: 'Pkg', erledigt: false },
  { id: 'a8', name: 'Kaffee',              kategorie: 'Trockenwaren',            menge: 1,   einheit: 'Pkg', erledigt: false },
];

const KAT_REIHENFOLGE: Kategorie[] = [
  'Gemüse & Obst', 'Proteine & Milchprodukte', 'Trockenwaren', 'Getränke', 'Haushalt',
];

const KAT_CONFIG: Record<Kategorie, { icon: React.ReactNode; color: string; bg: string }> = {
  'Gemüse & Obst':           { icon: <Leaf className="h-2.5 w-2.5" />,     color: '#10b981', bg: 'rgba(16,185,129,0.09)'  },
  'Proteine & Milchprodukte':{ icon: <Egg  className="h-2.5 w-2.5" />,     color: '#f43f5e', bg: 'rgba(244,63,94,0.09)'   },
  'Trockenwaren':             { icon: <Package className="h-2.5 w-2.5" />,  color: '#f59e0b', bg: 'rgba(245,158,11,0.09)'  },
  'Getränke':                 { icon: <Coffee className="h-2.5 w-2.5" />,   color: '#0ea5e9', bg: 'rgba(14,165,233,0.09)'  },
  'Haushalt':                 { icon: <Sparkles className="h-2.5 w-2.5" />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.09)'  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function GroceriesCard() {
  const [artikel, setArtikel] = useState<Artikel[]>(INITIAL_ARTIKEL);
  const [transitioning, setTransitioning] = useState<Set<string>>(new Set());
  const [expandedKats, setExpandedKats] = useState<Set<string>>(
    new Set([...KAT_REIHENFOLGE, 'erledigt'])
  );

  const aktiveArtikel  = useMemo(() => artikel.filter(a => !a.erledigt), [artikel]);
  const erledigtArtikel = useMemo(() => artikel.filter(a => a.erledigt), [artikel]);

  const pct = useMemo(() =>
    artikel.length > 0 ? Math.round((erledigtArtikel.length / artikel.length) * 100) : 0,
    [artikel, erledigtArtikel]
  );

  const artikelByKat = useMemo(() => {
    const grouped: Partial<Record<Kategorie, Artikel[]>> = {};
    aktiveArtikel.forEach(a => {
      (grouped[a.kategorie] ??= []).push(a);
    });
    return grouped;
  }, [aktiveArtikel]);

  // Check item → strikethrough for 2 s → move to Erledigt
  const toggleArtikel = useCallback((id: string) => {
    const item = artikel.find(a => a.id === id);
    if (!item) return;

    if (item.erledigt) {
      // Uncheck: restore to active
      setArtikel(prev => prev.map(a => a.id === id ? { ...a, erledigt: false } : a));
      return;
    }

    if (transitioning.has(id)) return; // already counting down

    setTransitioning(prev => { const s = new Set(prev); s.add(id); return s; });
    setTimeout(() => {
      setArtikel(prev => prev.map(a => a.id === id ? { ...a, erledigt: true } : a));
      setTransitioning(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  }, [artikel, transitioning]);

  const updateMenge = useCallback((id: string, delta: number) => {
    setArtikel(prev =>
      prev
        .map(a => a.id === id ? { ...a, menge: Math.max(0, a.menge + delta) } : a)
        .filter(a => a.menge > 0 || a.id !== id)
    );
  }, []);

  const schnellHinzufuegen = useCallback((item: typeof SCHNELLAUSWAHL[0]) => {
    const exists = aktiveArtikel.find(a => a.name === item.name);
    if (exists) {
      updateMenge(exists.id, 1);
    } else {
      setArtikel(prev => [...prev, {
        id: `a${Date.now()}`,
        name: item.name,
        kategorie: item.kategorie,
        menge: 1,
        einheit: item.einheit,
        erledigt: false,
      }]);
    }
  }, [aktiveArtikel, updateMenge]);

  const toggleKat = useCallback((key: string) => {
    setExpandedKats(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.05 }}
      className="rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col overflow-hidden"
      style={{ minHeight: 380 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg flex items-center justify-center"
               style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <ShoppingCart className="h-3 w-3 text-emerald-400" />
          </div>
          <span className="text-[12.5px] font-semibold text-zinc-200 tracking-tight">Einkaufsliste</span>
          <span className="text-[10px] text-zinc-600 tabular-nums">{aktiveArtikel.length} offen</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-emerald-500/80 tabular-nums">{pct}%</span>
          <div className="w-20 h-[2px] bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-emerald-500/70 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* ── Schnellauswahl ── */}
      <div className="px-4 pb-3 shrink-0">
        <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">Schnellauswahl</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {SCHNELLAUSWAHL.map(item => {
            const onList = aktiveArtikel.some(a => a.name === item.name);
            return (
              <motion.button
                key={item.name}
                onClick={() => schnellHinzufuegen(item)}
                whileTap={{ scale: 0.91 }}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-150',
                  onList
                    ? 'border border-emerald-500/25 text-emerald-400'
                    : 'border border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                )}
                style={{ background: onList ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)' }}
              >
                <span className="text-[11px]">{item.emoji}</span>
                {item.name}
                {onList && <Check className="h-2 w-2 ml-0.5" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-zinc-800/50 mx-4 shrink-0" />

      {/* ── Category Sections ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2.5 space-y-1">
        {KAT_REIHENFOLGE.map(kat => {
          const items = artikelByKat[kat];
          if (!items || items.length === 0) return null;
          const cfg = KAT_CONFIG[kat];
          const open = expandedKats.has(kat);

          return (
            <div key={kat}>
              {/* Category header */}
              <button
                onClick={() => toggleKat(kat)}
                className="w-full flex items-center gap-2 py-1 group"
              >
                <div
                  className="h-4 w-4 rounded flex items-center justify-center shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  {cfg.icon}
                </div>
                <span className="text-[10px] font-semibold text-zinc-500 flex-1 text-left group-hover:text-zinc-400 transition-colors">
                  {kat}
                </span>
                <span className="text-[9px] text-zinc-700 tabular-nums">{items.length}</span>
                <motion.div
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronDown className="h-2.5 w-2.5 text-zinc-700 ml-1" />
                </motion.div>
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 mb-1 ml-1">
                      {items.map(item => {
                        const isGoing = transitioning.has(item.id);
                        return (
                          <motion.div
                            key={item.id}
                            layout
                            className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-zinc-900/60 group/row transition-colors"
                          >
                            {/* Checkbox */}
                            <motion.button
                              onClick={() => toggleArtikel(item.id)}
                              whileTap={{ scale: 0.82 }}
                              className={cn(
                                'h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition-all duration-200',
                                isGoing
                                  ? 'border-emerald-500/50 bg-emerald-500/10'
                                  : 'border-zinc-700 bg-transparent hover:border-zinc-500'
                              )}
                            >
                              <AnimatePresence>
                                {isGoing && (
                                  <motion.div
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={{ duration: 0.12 }}
                                  >
                                    <Check className="h-2.5 w-2.5 text-emerald-500" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.button>

                            {/* Name */}
                            <span className={cn(
                              'flex-1 text-[11.5px] transition-all duration-300',
                              isGoing
                                ? 'line-through text-zinc-600'
                                : 'text-zinc-300 group-hover/row:text-zinc-200'
                            )}>
                              {item.name}
                            </span>

                            {/* Quantity counter */}
                            <div className={cn(
                              'flex items-center gap-1 transition-opacity duration-300',
                              isGoing ? 'opacity-20 pointer-events-none' : 'opacity-100'
                            )}>
                              <motion.button
                                onClick={() => updateMenge(item.id, -1)}
                                whileTap={{ scale: 0.82 }}
                                className="h-5 w-5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-colors"
                              >
                                <Minus className="h-2.5 w-2.5 text-zinc-500" />
                              </motion.button>
                              <span className="text-[10.5px] text-zinc-400 font-mono w-14 text-center tabular-nums">
                                {item.menge} {item.einheit}
                              </span>
                              <motion.button
                                onClick={() => updateMenge(item.id, 1)}
                                whileTap={{ scale: 0.82 }}
                                className="h-5 w-5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center transition-colors"
                              >
                                <Plus className="h-2.5 w-2.5 text-zinc-500" />
                              </motion.button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* ── Erledigt Section ── */}
        {erledigtArtikel.length > 0 && (
          <div className="pt-1">
            <div className="h-px bg-zinc-800/40 mb-2" />
            <button
              onClick={() => toggleKat('erledigt')}
              className="w-full flex items-center gap-2 py-1 group"
            >
              <div className="h-4 w-4 rounded flex items-center justify-center shrink-0 bg-emerald-500/8">
                <Check className="h-2.5 w-2.5 text-emerald-600" />
              </div>
              <span className="text-[10px] font-semibold text-zinc-600 flex-1 text-left">
                Erledigt
              </span>
              <span className="text-[9px] text-zinc-700 tabular-nums">{erledigtArtikel.length}</span>
              <motion.div
                animate={{ rotate: expandedKats.has('erledigt') ? 180 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronDown className="h-2.5 w-2.5 text-zinc-700 ml-1" />
              </motion.div>
            </button>

            <AnimatePresence>
              {expandedKats.has('erledigt') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-0.5 ml-1 mb-1">
                    {erledigtArtikel.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-xl group/done"
                      >
                        <button
                          onClick={() => toggleArtikel(item.id)}
                          className="h-4 w-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center shrink-0 hover:border-emerald-500/50 transition-colors"
                        >
                          <Check className="h-2.5 w-2.5 text-emerald-500" />
                        </button>
                        <span className="flex-1 text-[11px] line-through text-zinc-600">
                          {item.name}
                        </span>
                        <span className="text-[9px] text-zinc-700 font-mono tabular-nums">
                          {item.menge} {item.einheit}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
