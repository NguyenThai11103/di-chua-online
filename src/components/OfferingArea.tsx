import React, { useEffect, useState } from 'react';
import { GiftEvent } from '../types/temple';

const BURNER = { x: 50, y: 58 };
const MEDITATION_SEATS = [
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
];

const MeditationSeat: React.FC<{ x: number; y: number; index: number }> = ({ x, y, index }) => {
  const velvetId = `seat-velvet-${index}`;
  const goldId = `seat-gold-${index}`;
  return (
    <div
      className="absolute w-[8.5%] -translate-x-1/2 -translate-y-1/2 opacity-90"
      style={{ left: `${x}%`, top: `${y}%`, zIndex: Math.round(y) - 2 }}
    >
      <svg viewBox="0 0 150 62" className="h-auto w-full drop-shadow-[0_4px_4px_rgba(0,0,0,0.55)]" aria-hidden="true">
        <defs>
          <linearGradient id={velvetId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a91d28" />
            <stop offset="1" stopColor="#571017" />
          </linearGradient>
          <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f5d889" />
            <stop offset="0.55" stopColor="#b97824" />
            <stop offset="1" stopColor="#70400f" />
          </linearGradient>
        </defs>
        <path d="M15 31 H135 L131 53 H19 Z" fill="#25120d" stroke={`url(#${goldId})`} strokeWidth="3" />
        <path d="M20 11 Q22 5 31 5 H119 Q128 5 130 11 L137 34 H13 Z" fill={`url(#${velvetId})`} stroke={`url(#${goldId})`} strokeWidth="3" />
        <path d="M31 15 H119" fill="none" stroke="#e3bb68" strokeWidth="1.5" opacity="0.7" />
        <path d="M25 52 L20 60 M125 52 L130 60" stroke="#b97824" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
};

const LotusShape: React.FC<{ id: string }> = ({ id }) => (
  <svg viewBox="0 0 100 60" className="h-auto w-full" aria-hidden="true">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff7d1" />
        <stop offset="0.5" stopColor="#fcd34d" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <path d="M50 56 C22 54 6 40 4 26 C22 28 38 38 50 56 Z" fill={`url(#${id})`} />
    <path d="M50 56 C78 54 94 40 96 26 C78 28 62 38 50 56 Z" fill={`url(#${id})`} />
    <path d="M50 56 C30 46 22 28 26 10 C40 20 48 36 50 56 Z" fill={`url(#${id})`} />
    <path d="M50 56 C70 46 78 28 74 10 C60 20 52 36 50 56 Z" fill={`url(#${id})`} />
    <path d="M50 56 C40 40 40 18 50 2 C60 18 60 40 50 56 Z" fill={`url(#${id})`} />
  </svg>
);

const SMOKE = [
  { x: 42, delay: 0, dur: 7 },
  { x: 50, delay: 0.8, dur: 8 },
  { x: 57, delay: 1.6, dur: 7.5 },
  { x: 46, delay: 2.4, dur: 8.5 },
  { x: 54, delay: 3.2, dur: 7 },
  { x: 40, delay: 4, dur: 8 },
  { x: 60, delay: 4.8, dur: 7.5 },
  { x: 48, delay: 5.6, dur: 9 },
  { x: 52, delay: 6.4, dur: 8 },
];

const BurnerGlow: React.FC<{ on: boolean }> = ({ on }) => (
  <div
    className="pointer-events-none absolute aspect-[1/2] w-[30%] -translate-x-1/2 -translate-y-full"
    style={{ left: `${BURNER.x}%`, top: `${BURNER.y + 1}%`, zIndex: 60 }}
  >
    <span
      className={`absolute bottom-0 left-[22%] right-[22%] h-[24%] rounded-full bg-amber-300/45 blur-xl transition-opacity duration-700 ${
        on ? 'opacity-100' : 'opacity-0'
      }`}
    />
    <span className="absolute bottom-[6%] left-[30%] right-[30%] h-[70%] rounded-full bg-white/15 blur-2xl" />
    {(on ? [...SMOKE, ...SMOKE.map((w) => ({ ...w, x: w.x + 3, delay: w.delay + 0.4 }))] : SMOKE).map((w, i) => (
      <span
        key={`${w.x}-${w.delay}-${i}`}
        className="absolute bottom-[6%] h-[30%] w-[18%] rounded-full bg-white/55 blur-[7px] animate-incense-drift"
        style={{ left: `${w.x - 8}%`, animationDelay: `${w.delay}s`, animationDuration: `${w.dur}s` }}
      />
    ))}
  </div>
);

type RisingLotus = { id: string; label: string; motes: number[] };

const OfferingLotuses: React.FC<{ offering: GiftEvent | null }> = ({ offering }) => {
  const [lotuses, setLotuses] = useState<RisingLotus[]>([]);

  useEffect(() => {
    if (!offering) return;
    const lotus: RisingLotus = {
      id: offering.id,
      label: `${offering.displayName || offering.username} dâng ${offering.giftName}`,
      motes: Array.from({ length: 8 }, () => Math.random()),
    };
    setLotuses((previous) => [...previous.slice(-4), lotus]);
    window.setTimeout(
      () => setLotuses((previous) => previous.filter((item) => item.id !== lotus.id)),
      4200
    );
  }, [offering]);

  return (
    <>
      {lotuses.map((lotus) => (
        <div
          key={lotus.id}
          className="pointer-events-none absolute w-[14%]"
          style={{ left: `${BURNER.x}%`, top: `${BURNER.y - 8}%`, zIndex: 130 }}
        >
          <div className="flex -translate-x-1/2 flex-col items-center animate-lotus-rise">
            <div className="w-full drop-shadow-[0_0_10px_rgba(253,224,71,0.95)]">
              <LotusShape id={`rise-${lotus.id}`} />
            </div>
            <div className="mt-0.5 w-max max-w-[150px] truncate rounded-full bg-black/60 px-1.5 text-[8px] font-semibold text-amber-100">
              {lotus.label}
            </div>
          </div>
          {lotus.motes.map((mote, index) => (
            <span
              key={index}
              className="absolute top-[40%] h-1 w-1 rounded-full bg-amber-200 shadow-[0_0_6px_2px_rgba(253,224,71,0.8)] animate-light-mote"
              style={{ left: `${mote * 160 - 80}%`, animationDelay: `${index * 0.18}s` }}
            />
          ))}
        </div>
      ))}
    </>
  );
};

export const OfferingArea: React.FC<{
  offering: GiftEvent | null;
  layer?: 'all' | 'floor' | 'labels';
  burnerLit?: boolean;
}> = ({ offering, layer = 'all', burnerLit }) => (
  <div className="pointer-events-none absolute inset-0">
    {layer !== 'labels' && (
      <>
        <BurnerGlow on={burnerLit ?? Boolean(offering)} />
        {MEDITATION_SEATS.map((seat, index) => (
          <MeditationSeat key={`${seat.x}-${seat.y}`} {...seat} index={index} />
        ))}
      </>
    )}
    {layer !== 'floor' && <OfferingLotuses offering={offering} />}
  </div>
);
