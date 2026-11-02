import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Devotee } from '../types/temple';
import { Person, hash } from './Person';

interface DevoteeCrowdProps {
  devotees: Devotee[];
  recentGiftDonor: string | null;
  recentGiftPrayer?: string | null;
  labelsOnly?: boolean; // 3D layer draws the people; keep only chat bubbles here
  hiddenPresenceIds?: string[];
  hiddenUsernames?: string[];
}

// Sparse participant positions in stage % (x = center, y = feet line).
// The centre aisle stays open and, importantly, empty positions render nothing.
export const SEATS = [
  { x: 38, y: 79 },
  { x: 62, y: 79 },
  { x: 29, y: 82 },
  { x: 40, y: 82 },
  { x: 60, y: 82 },
  { x: 71, y: 82 },
  { x: 22, y: 85 },
  { x: 34, y: 85 },
  { x: 66, y: 85 },
  { x: 78, y: 85 },
  { x: 67, y: 88 },
  { x: 78, y: 88 },
  { x: 16, y: 91 },
  { x: 27, y: 91 },
  { x: 37, y: 91 },
  { x: 44, y: 91 },
  { x: 56, y: 91 },
  { x: 63, y: 91 },
  { x: 73, y: 91 },
  { x: 84, y: 91 },
  { x: 12, y: 94 },
  { x: 23, y: 94 },
  { x: 34, y: 94 },
  { x: 43, y: 94 },
  { x: 57, y: 94 },
  { x: 66, y: 94 },
  { x: 77, y: 94 },
  { x: 88, y: 94 },
];
// Farther rows (higher on screen) are smaller
const widthAt = (y: number) => `${6.5 * (0.62 + ((y - 70) / 30) * 0.42)}%`;
const WALK_MS = 3500;

const Viewer: React.FC<{ devotee: Devotee; isVip: boolean; prayerText: string | null; reactionText: string | null; labelsOnly?: boolean }> = ({
  devotee,
  isVip,
  prayerText,
  reactionText,
  labelsOnly,
}) => {
  const { x, y } = SEATS[(devotee.seat ?? 0) % SEATS.length];
  const isNew = Date.now() - devotee.joinedAt < WALK_MS;
  const [arrived, setArrived] = useState(!isNew);

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
      style={{ width: widthAt(y), zIndex: arrived ? Math.round(y) : 120 }}
      initial={isNew ? { left: '50%', top: '108%' } : false}
      animate={
        isNew
          ? { left: ['50%', '50%', `${x}%`], top: ['108%', `${y}%`, `${y}%`] }
          : { left: `${x}%`, top: `${y}%` }
      }
      transition={{ duration: WALK_MS / 1000, times: [0, 0.75, 1], ease: 'easeInOut' }}
      onAnimationComplete={() => setArrived(true)}
    >
      {/* Each online visitor keeps a compact name tag above their character. */}
      {arrived && (
        <div className="absolute bottom-full mb-0.5 flex max-w-[76px] items-center gap-0.5 rounded-full border border-[#d9a55a] bg-[#2a1608]/90 py-0.5 pl-0.5 pr-1 shadow-[0_0_5px_rgba(217,165,90,0.6)]">
          {devotee.avatarUrl ? (
            <img src={devotee.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-3 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid size-3 shrink-0 place-items-center rounded-full bg-[#b07a3a] text-[6px] font-bold text-[#fff7e0]">
              {devotee.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-[6.5px] font-semibold leading-none text-[#fbe7b8]">{devotee.displayName}</span>
        </div>
      )}
      {prayerText && (!labelsOnly || arrived) && (
        <div className="absolute bottom-full mb-6 z-50 w-max max-w-[120px] px-2 py-0.5 rounded-lg bg-[#2a1608]/85 border border-[#b07a3a]/60 text-[#fbe7b8] text-[9px] font-semibold leading-tight text-center shadow-md animate-float-subtle">
          <div className="line-clamp-2">{prayerText}</div>
        </div>
      )}
      {reactionText && (!labelsOnly || arrived) && (
        <div className="absolute bottom-full z-[55] mb-11 grid size-8 place-items-center rounded-full border border-amber-200/50 bg-[#201108]/90 text-xl shadow-lg animate-bounce">
          {reactionText}
        </div>
      )}
      <div className={`w-full ${!labelsOnly && (isVip || !arrived) ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]' : ''}`}>
        <Person seed={hash(devotee.username)} mode={arrived ? 'pray' : 'walk'} hidden={labelsOnly} />
      </div>
    </motion.div>
  );
};

export const DevoteeCrowd: React.FC<DevoteeCrowdProps> = ({
  devotees,
  recentGiftDonor,
  recentGiftPrayer,
  labelsOnly,
  hiddenPresenceIds = [],
  hiddenUsernames = [],
}) => {
  // One real visitor per seat. Empty positions stay empty.
  const bySeat = new Map<number, Devotee>();
  const hiddenNames = new Set(hiddenUsernames.map((name) => name.toLocaleLowerCase('vi-VN')));
  for (const d of devotees) {
    if (d.presenceId && hiddenPresenceIds.includes(d.presenceId)) continue;
    if (hiddenNames.has(d.username.toLocaleLowerCase('vi-VN'))) continue;
    bySeat.set((d.seat ?? 0) % SEATS.length, d);
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {[...bySeat.values()].map((d) => {
        const isVip = Boolean(recentGiftDonor && d.username.toLowerCase() === recentGiftDonor.toLowerCase());
        return (
          <Viewer
            key={d.id}
            devotee={d}
            isVip={isVip}
            prayerText={(isVip && recentGiftPrayer) || d.activeComment || null}
            reactionText={d.activeReaction || null}
            labelsOnly={labelsOnly}
          />
        );
      })}
    </div>
  );
};
