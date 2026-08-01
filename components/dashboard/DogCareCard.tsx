'use client';

import { motion } from 'framer-motion';
import { PawPrint, Check } from 'lucide-react';
import { BentoCard } from './BentoCard';
import { MOCK_DOG } from '@/lib/mock-data/dog';
import { OWNER_CONFIG } from '@/lib/constants';

export function DogCareCard() {
  const dog = MOCK_DOG;
  const todayWalks = dog.walks;
  const morningFed = dog.feedingLogs.some(f => f.mealTime === 'morning');
  const eveningFed = dog.feedingLogs.some(f => f.mealTime === 'evening');
  const food = dog.foodStock[0];
  const foodPct = food ? Math.round((food.quantityGrams / (food.quantityGrams + food.lowThresholdGrams)) * 100) : 0;
  const foodLow = food ? food.quantityGrams < food.lowThresholdGrams : false;

  const totalKm = todayWalks.reduce((sum, w) => sum + (w.distanceKm ?? 0), 0);

  return (
    <BentoCard className="col-span-1 row-span-1" glowColor="none">
      <div className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <PawPrint className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-white/50 tracking-tight">Luna</span>
          </div>
          <span className="text-[10px] text-white/20">{dog.dogBreed}</span>
        </div>

        {/* Walks today */}
        <div className="space-y-1.5 mb-3">
          {todayWalks.map((walk, i) => {
            const ownerCfg = OWNER_CONFIG[walk.walkedBy];
            return (
              <motion.div
                key={walk.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-2"
              >
                <div className="h-4 w-4 rounded-full flex items-center justify-center shrink-0"
                     style={{ background: ownerCfg.bg }}>
                  <Check className="h-2 w-2" style={{ color: ownerCfg.color }} />
                </div>
                <span className="text-[10px] text-white/50 flex-1">
                  Gassi · {walk.durationMinutes} min · {walk.distanceKm} km
                </span>
                <span className="text-[10px] font-medium" style={{ color: ownerCfg.color }}>
                  {ownerCfg.initials}
                </span>
              </motion.div>
            );
          })}
          {todayWalks.length === 0 && (
            <p className="text-[10px] text-white/20">Noch kein Spaziergang heute</p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-center">
            <p className="text-base font-bold text-white/80">{totalKm.toFixed(1)}</p>
            <p className="text-[9px] text-white/25">km heute</p>
          </div>
          <div className="h-6 w-px bg-white/[0.06]" />
          <div className="flex gap-2">
            {(['morning', 'evening'] as const).map(meal => {
              const fed = meal === 'morning' ? morningFed : eveningFed;
              return (
                <div key={meal} className="text-center">
                  <div className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${fed ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/20 bg-white/[0.03]'}`}>
                    {meal === 'morning' ? 'AM' : 'PM'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Food stock */}
        {food && (
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-white/25 truncate flex-1 mr-2">{food.productName.split(' ').slice(0, 3).join(' ')}</span>
              <span className={`text-[9px] font-semibold ${foodLow ? 'text-red-400' : 'text-white/30'}`}>
                {(food.quantityGrams / 1000).toFixed(1)}kg
              </span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${foodPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: foodLow ? '#ef4444' : '#f59e0b' }}
              />
            </div>
          </div>
        )}
      </div>
    </BentoCard>
  );
}
