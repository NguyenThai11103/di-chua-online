import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TempleLightingEffects } from './TempleLightingEffects';
import { CompactBangCongDuc } from './CompactBangCongDuc';
import { DevoteeCrowd, SEATS } from './DevoteeCrowd';
import { OfferingArea } from './OfferingArea';
import { Temple3D } from '../three/Temple3D';
import type { ActorSpec } from '../three/templeScene';
import { GiftNotificationBanner } from './GiftNotificationBanner';
import { GoldenLotusBloom } from './GoldenLotusBloom';
import { FlowerRain, LikeBar } from './LikeRain';
import { CraneFlight } from './CraneFlight';
import { SpotlightCard } from './SpotlightCard';
import { MessageCircle, Move, Send, Wifi, WifiOff, X } from 'lucide-react';
import { LIKES_PER_RAIN } from '../services/likeRain';
import {
  Devotee,
  ChatMessage,
  GiftEvent,
  OfferRequest,
  LeaderboardEntry,
  ReactionEmoji,
  StreamConfig,
} from '../types/temple';

interface ChanhDienStageProps {
  config: StreamConfig;
  devotees: Devotee[];
  currentGift: GiftEvent | null;
  offerRequests: OfferRequest[];
  leaderboardDonors: LeaderboardEntry[];
  auraIntensity: number;
  isGiftActive: boolean;
  onRingBell: () => void;
  onPlayGong: () => void;
  onToggleBgm?: () => void;
  isBgmPlaying?: boolean;
  likeProgress?: number; // mindful activities toward the next flower rain
  rainUntil?: number; // flower rain lasts until this time (ms)
  spotlightRequests?: OfferRequest[]; // gift givers the camera follows up close
  onSpotlightStart?: (username: string) => void; // read their name and blessing as the close-up begins
  visitorName?: string;
  visitorId?: string;
  onSubmitPrayer?: (name: string, wish: string) => void;
  onMove?: (position: { x: number; y: number }) => void;
  onReact?: (reaction: ReactionEmoji) => void;
  chatMessages?: ChatMessage[];
  chatConnected?: boolean;
  chatSending?: boolean;
  onSendChat?: (text: string) => Promise<boolean>;
}

const MAX_AT_BURNER = 1; // one person performs the ritual; everyone else keeps an explicit FIFO place
const QUICK_REACTIONS: ReactionEmoji[] = ['🙏', '👋', '🪷', '❤️'];
const AMBIENT_NPC_ROUTES = [
  [
    { x: 14, y: 88 },
    { x: 24, y: 76 },
    { x: 17, y: 82 },
  ],
  [
    { x: 86, y: 88 },
    { x: 76, y: 76 },
    { x: 83, y: 82 },
  ],
  [
    { x: 31, y: 74 },
    { x: 69, y: 74 },
    { x: 50, y: 78 },
  ],
];

export const ChanhDienStage: React.FC<ChanhDienStageProps> = ({
  config,
  devotees,
  currentGift,
  offerRequests,
  leaderboardDonors,
  auraIntensity,
  isGiftActive,
  onRingBell,
  onPlayGong,
  onToggleBgm,
  isBgmPlaying = true,
  likeProgress = 0,
  rainUntil = 0,
  spotlightRequests = [],
  onSpotlightStart,
  visitorName = '',
  visitorId = '',
  onSubmitPrayer,
  onMove,
  onReact,
  chatMessages = [],
  chatConnected = false,
  chatSending = false,
  onSendChat,
}) => {
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [prayerText, setPrayerText] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [freeMoveEnabled, setFreeMoveEnabled] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [playerPosition, setPlayerPosition] = useState({ x: 50, y: 91 });
  const [ambientNpcStep, setAmbientNpcStep] = useState(0);
  const chatListRef = useRef<HTMLDivElement>(null);
  const movementLayerRef = useRef<HTMLDivElement>(null);

  const submitPrayer = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmitPrayer?.(visitorName, prayerText);
    setPrayerText('');
    setPrayerOpen(false);
  };

  const submitChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatDraft.trim() || chatSending || !onSendChat) return;
    if (await onSendChat(chatDraft)) setChatDraft('');
  };

  useEffect(() => {
    if (!chatOpen) return;
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, chatOpen]);

  useEffect(() => {
    if (freeMoveEnabled) movementLayerRef.current?.focus({ preventScroll: true });
  }, [freeMoveEnabled]);

  useEffect(() => {
    const interval = window.setInterval(() => setAmbientNpcStep((step) => step + 1), 6500);
    return () => window.clearInterval(interval);
  }, []);

  const setSafePlayerPosition = (x: number, y: number) => {
    const next = { x: Math.min(88, Math.max(12, x)), y: Math.min(96, Math.max(68, y)) };
    setPlayerPosition(next);
    onMove?.(next);
  };

  const movePlayerBy = (dx: number, dy: number) =>
    setPlayerPosition((current) => {
      const next = {
        x: Math.min(88, Math.max(12, current.x + dx)),
        y: Math.min(96, Math.max(68, current.y + dy)),
      };
      onMove?.(next);
      return next;
    });

  const handleMoveKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    const directions: Record<string, [number, number]> = {
      arrowleft: [-4, 0],
      a: [-4, 0],
      arrowright: [4, 0],
      d: [4, 0],
      arrowup: [0, -3],
      w: [0, -3],
      arrowdown: [0, 3],
      s: [0, 3],
    };
    const direction = directions[key];
    if (!direction) return;
    event.preventDefault();
    movePlayerBy(...direction);
  };

  // Re-render when a flower rain ends so the like bar switches back to counting
  const [raining, setRaining] = useState(false);
  useEffect(() => {
    const left = rainUntil - Date.now();
    setRaining(left > 0);
    if (left <= 0) return;
    const t = setTimeout(() => setRaining(false), left);
    return () => clearTimeout(t);
  }, [rainUntil]);

  // 3D devotees when public/assets/3d/ has the model, otherwise the 2D sprites
  const [has3D, setHas3D] = useState(false);
  const [incenseLit, setIncenseLit] = useState(false);
  // Incense offerings: one person at the burner, everyone else waits in arrival order.
  // Each person can enter the queue at most once a minute so repeated clicks cannot take extra places.
  const [activeOffers, setActiveOffers] = useState<OfferRequest[]>([]);
  const [waitingOffers, setWaitingOffers] = useState<OfferRequest[]>([]);
  const queueRef = useRef<OfferRequest[]>([]);
  const seenRef = useRef(new Set<string>());
  const lastOfferAtRef = useRef(new Map<string, number>());
  const keyUserRef = useRef(new Map<string, string>()); // actor key -> username, to end the right offering

  const activeRef = useRef<OfferRequest[]>([]);

  const settleOffers = (done?: string) => {
    const active = activeRef.current;
    const next = done ? active.filter((o) => o.username !== done) : [...active];
    while (next.length < MAX_AT_BURNER && queueRef.current.length) {
      const r = queueRef.current.shift()!;
      next.push(r);
      // Safety net: free the slot even if the person never makes it back (e.g. removed from the hall)
      setTimeout(() => settleOffers(r.username), 90000);
    }
    setWaitingOffers([...queueRef.current]);
    if (next.length === active.length && next.every((o, i) => o === active[i])) return;
    activeRef.current = next;
    setActiveOffers(next);
  };

  useEffect(() => {
    const now = Date.now();
    for (const r of offerRequests) {
      if (seenRef.current.has(r.id)) continue;
      seenRef.current.add(r.id);
      const waiting = activeRef.current.some((a) => a.username === r.username) || queueRef.current.some((q) => q.username === r.username);
      if (waiting || now - (lastOfferAtRef.current.get(r.username) ?? 0) < 60000) continue;
      lastOfferAtRef.current.set(r.username, now);
      queueRef.current.push(r);
    }
    queueRef.current = queueRef.current.slice(0, 50);
    settleOffers();
  }, [offerRequests]);

  const offerKeyRef = useRef(new Map<string, string>()); // username -> the actor doing their offering right now

  const specs = useMemo(() => {
    const list: ActorSpec[] = [
      {
        key: 'temple-abbot',
        at: { x: 50, y: 63.5 },
        mode: 'pray',
        enter: 'place',
        scale: 1.2,
        facesCamera: true,
        canBow: false,
        label: { name: 'Trụ Trì - Huy Hay Đi', always: true },
      },
    ];
    const offering = new Map(activeOffers.map((o) => [o.username, o]));
    const messageByUser = new Map(
      devotees.map((devotee) => [devotee.username.toLocaleLowerCase('vi-VN'), devotee.activeComment])
    );
    const reactionByUser = new Map(
      devotees.map((devotee) => [devotee.username.toLocaleLowerCase('vi-VN'), devotee.activeReaction])
    );
    const offerKeys = new Map<string, string>();
    offerKeyRef.current = offerKeys;

    AMBIENT_NPC_ROUTES.forEach((route, index) => {
      list.push({
        key: `ambient-npc-${index}`,
        at: route[ambientNpcStep % route.length],
        mode: 'pray',
        enter: 'place',
        scale: 0.9,
        canBow: false,
      });
    });

    const offerFor = (key: string, username: string, always = false) => {
      const o = offering.get(username);
      if (!o) return {};
      keyUserRef.current.set(key, username);
      offerKeys.set(username, key);
      offering.delete(username);
      return {
        offer: o.id,
        label: {
          name: o.displayName || o.username,
          avatar: o.avatarUrl || undefined,
          message: messageByUser.get(username.toLocaleLowerCase('vi-VN')),
          reaction: reactionByUser.get(username.toLocaleLowerCase('vi-VN')),
          always,
        },
      };
    };
    if (freeMoveEnabled) {
      const key = visitorId ? `v-online-${visitorId}` : 'free-moving-visitor';
      list.push({
        key,
        at: playerPosition,
        mode: 'pray',
        enter: 'place',
        facesCamera: true,
        canBow: false,
        label: {
          name: visitorName.trim() || 'Bạn',
          message: messageByUser.get(visitorName.trim().toLocaleLowerCase('vi-VN')),
          reaction: reactionByUser.get(visitorName.trim().toLocaleLowerCase('vi-VN')),
          always: true,
        },
        ...offerFor(key, visitorName, true),
      });
    }
    // Real participants only; an offerer leaves their own position, offers incense and comes back.
    const bySeat = new Map(
      devotees
        .filter((d) => !(freeMoveEnabled && visitorId && d.presenceId === visitorId))
        .map((d) => [(d.seat ?? 0) % SEATS.length, d])
    );
    SEATS.forEach((seatPosition, i) => {
      const d = bySeat.get(i);
      if (!d) return;
      const key = `v-${d.id}`;
      const moving = Boolean(d.livePosition);
      list.push({
        key,
        at: d.livePosition ?? seatPosition,
        mode: 'pray',
        enter: Date.now() - d.joinedAt < 3500 ? 'walk' : 'place',
        facesCamera: moving,
        canBow: !moving,
        label: moving
          ? {
              name: d.displayName || d.username,
              avatar: d.avatarUrl,
              message: messageByUser.get(d.username.toLocaleLowerCase('vi-VN')),
              reaction: reactionByUser.get(d.username.toLocaleLowerCase('vi-VN')),
              always: true,
            }
          : undefined,
        ...offerFor(key, d.username, moving),
      });
    });
    // Offerers with no place in the hall walk up from the back, offer incense and leave
    for (const o of offering.values()) {
      const key = `guest-${o.username}`;
      list.push({ key, at: { x: 50, y: 106 }, mode: 'pray', enter: 'walk', leave: true, ...offerFor(key, o.username) });
    }
    return list;
  }, [devotees, activeOffers, ambientNpcStep, freeMoveEnabled, playerPosition, visitorId, visitorName]);

  const movingPresenceIds = devotees
    .filter((devotee) => devotee.livePosition || (freeMoveEnabled && devotee.presenceId === visitorId))
    .flatMap((devotee) => (devotee.presenceId ? [devotee.presenceId] : []));


  // Spotlight: one gift giver at a time is followed up close while they walk up, light incense and bow.
  // They go to the front of the incense line (even if they offered less than a minute ago).
  const bgRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [spotKey, setSpotKey] = useState<string | null>(null);
  const [spotPerson, setSpotPerson] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const spotQueueRef = useRef<Array<OfferRequest & { at: number }>>([]);
  const spotSeenRef = useRef(new Set<string>());
  const spotBusyRef = useRef(false);
  const spotNextAtRef = useRef(0);
  const onSpotlightStartRef = useRef(onSpotlightStart);
  onSpotlightStartRef.current = onSpotlightStart;

  useEffect(() => {
    for (const r of spotlightRequests) {
      if (spotSeenRef.current.has(r.id)) continue;
      spotSeenRef.current.add(r.id);
      if (spotQueueRef.current.some((q) => q.username === r.username)) continue;
      spotQueueRef.current.push({ ...r, at: Date.now() });
      if (!activeRef.current.some((a) => a.username === r.username)) {
        queueRef.current = [{ ...r, id: `${r.id}-spot` }, ...queueRef.current.filter((q) => q.username !== r.username)];
        lastOfferAtRef.current.set(r.username, Date.now());
        settleOffers();
      }
    }
  }, [spotlightRequests]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      spotQueueRef.current = spotQueueRef.current.filter((q) => now - q.at < 120000);
      if (spotBusyRef.current || now < spotNextAtRef.current) return;
      for (const q of spotQueueRef.current) {
        // Follow the actor carrying this offering (not an older seat of the same person)
        const key = offerKeyRef.current.get(q.username);
        if (!key) continue;
        spotQueueRef.current = spotQueueRef.current.filter((x) => x !== q);
        spotBusyRef.current = true;
        setSpotKey(key);
        onSpotlightStartRef.current?.(q.username);
        setSpotPerson({ id: q.id, name: q.displayName || q.username, avatar: q.avatarUrl || undefined });
        return;
      }
    }, 400);
    return () => clearInterval(t);
  }, []);

  const endSpotlight = () => {
    spotBusyRef.current = false;
    spotNextAtRef.current = Date.now() + 6000; // a short breath before the next one
    setSpotKey(null);
    setSpotPerson(null);
  };

  // Exact background path uploaded by the user
  const templeBgUrl = '/assets/bg/chanh-dien-2-hd.webp'; // AI-upscaled (Real-ESRGAN x4) from chanh-dien-2.webp

  return (
    <div
      className={`relative mx-auto bg-[#0a0403] overflow-hidden shadow-2xl flex flex-col justify-between border border-amber-500/40 select-none ${
        config.displayRatio === '9:16'
          ? 'w-full aspect-9/16 rounded-[1.35rem] sm:rounded-[1.75rem]'
          : 'w-full h-full rounded-none'
      }`}
    >
      {/* 1. REAL TEMPLE BACKGROUND IMAGE */}
      <div ref={bgRef} className="absolute inset-0 z-0">
        <img
          src={templeBgUrl}
          alt="Chánh Điện Kim Phật"
          className="w-full h-full object-cover object-center"
          style={{ filter: 'brightness(0.8) saturate(0.95)' }}
        />
        {/* 4K copy (the full AI upscale) shown only while the camera is close on a gift giver, so the hall stays sharp */}
        <img
          src="/assets/bg/chanh-dien-2-4k.webp"
          alt=""
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
          style={{ filter: 'brightness(0.8) saturate(0.95)', opacity: spotKey ? 1 : 0 }}
        />
        {/* Slow soft halo behind the Buddha's head */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[20%] w-[38%] aspect-square rounded-full bg-radial from-amber-200/25 via-amber-400/10 to-transparent mix-blend-screen animate-pulse-gold pointer-events-none" />
        {/* Soft subtle gradient at the very top for title legibility */}
        <div className="absolute inset-0 bg-linear-to-b from-black/55 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* 2. DYNAMIC LIGHTING EFFECTS OVER THE BUDDHA (Rotating Halo at Buddha back) */}
      <TempleLightingEffects
        auraIntensity={auraIntensity}
        isGiftActive={isGiftActive}
      />

      {/* 3. Recent mindful visitors */}
      <CompactBangCongDuc topDonors={leaderboardDonors} />

      {(activeOffers.length > 0 || waitingOffers.length > 0) && (
        <div className="absolute left-[3%] top-[27%] z-[165] w-[42%] max-w-[185px] rounded-xl border border-amber-200/30 bg-[#1d100a]/92 p-2 text-left shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-[8px] uppercase tracking-[0.13em] text-amber-300">Hàng chờ nghi thức</strong>
            <span className="rounded-full bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-bold text-amber-200">
              {waitingOffers.length} chờ
            </span>
          </div>
          {activeOffers[0] && (
            <div className="mt-1.5 truncate rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] text-emerald-200">
              Đang thực hiện · <strong>{activeOffers[0].displayName || activeOffers[0].username}</strong>
            </div>
          )}
          {waitingOffers.length > 0 && (
            <ol className="mt-1 space-y-0.5">
              {waitingOffers.slice(0, 3).map((offer, index) => (
                <li key={offer.id} className="truncate text-[8px] leading-3 text-stone-300">
                  <span className="mr-1 inline-block w-3 text-right font-bold text-amber-400">{index + 1}.</span>
                  {offer.displayName || offer.username}
                </li>
              ))}
              {waitingOffers.length > 3 && (
                <li className="pl-4 text-[7px] text-stone-500">+{waitingOffers.length - 3} người tiếp theo</li>
              )}
            </ol>
          )}
        </div>
      )}

      {/* 4. GIFT: golden lotus opens and pink lotus petals fall, bigger and brighter for bigger gifts */}
      <GoldenLotusBloom giftId={currentGift?.id} diamonds={currentGift?.diamonds} />

      {/* A gentle context note beneath the activity bar */}
      <div className="absolute top-[20.3%] left-[8%] right-[8%] z-30 overflow-hidden pointer-events-none rounded-full bg-black/35 border border-[#c9973f]/40">
        <div className="w-max whitespace-nowrap py-0.5 text-[9px] text-[#f3d08a]/90 font-temple animate-notice-scroll">
          Đây là không gian mô phỏng để thư giãn và tĩnh tâm, không thay thế việc hành lễ tại cơ sở tôn giáo.
        </div>
      </div>

      {/* 5. Temple title and chant */}
      <div className="absolute top-[7.5%] inset-x-0 z-30 flex flex-col items-center pointer-events-none">
        <h1
          className="text-2xl sm:text-3xl font-black tracking-widest font-temple uppercase bg-linear-to-b from-[#FFFDF0] via-[#FDE047] to-[#B45309] bg-clip-text text-transparent filter drop-shadow-[0_2px_10px_rgba(245,158,11,1)] text-center"
          style={{ letterSpacing: '0.18em' }}
        >
          {config.channelName}
        </h1>
        <div className="mt-0.5 text-[13px] font-semibold text-[#f3d08a] font-temple tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          Nam Mô A Di Đà Phật
        </div>
      </div>

      {/* Mindful activities toward the next flower rain */}
      <LikeBar progress={likeProgress} goal={LIKES_PER_RAIN} raining={raining} />
      <FlowerRain until={rainUntil} />
      <CraneFlight />

      {/* 7. Offering effects and real participants. Empty places stay visually clear. */}
      <div ref={worldRef} className="absolute inset-0 z-20">
        <div className="absolute inset-0 z-[1]">
          <OfferingArea
            offering={currentGift}
            layer={has3D ? 'floor' : 'all'}
            burnerLit={has3D ? incenseLit : undefined}
          />
          {!has3D && (
            <DevoteeCrowd
              devotees={devotees}
              recentGiftDonor={currentGift?.username || null}
              recentGiftPrayer={currentGift?.prayerMeaning || null}
              hiddenPresenceIds={movingPresenceIds}
            />
          )}
        </div>
        <div className="absolute inset-0 z-[2]">
          <Temple3D
            specs={specs}
            onReady={setHas3D}
            onIncenseLit={() => {
              setIncenseLit(true);
              setTimeout(() => setIncenseLit(false), 8000);
            }}
            onAway={(key, away) => {
              const user = keyUserRef.current.get(key);
              if (!away && user) settleOffers(user);
            }}
            spotlightKey={spotKey}
            zoomTargets={() => [bgRef.current, worldRef.current].filter((el): el is HTMLDivElement => Boolean(el))}
            onSpotlightEnd={endSpotlight}
          />
        </div>
        {has3D && (
          <div className="absolute inset-0 z-[3]">
            <OfferingArea
              offering={currentGift}
              layer="labels"
            />
            <DevoteeCrowd
              devotees={devotees}
              recentGiftDonor={currentGift?.username || null}
              recentGiftPrayer={currentGift?.prayerMeaning || null}
              labelsOnly
              hiddenPresenceIds={movingPresenceIds}
              hiddenUsernames={activeOffers.map((offer) => offer.username)}
            />
          </div>
        )}
      </div>

      {freeMoveEnabled && !prayerOpen && !chatOpen && (
        <div
          ref={movementLayerRef}
          className="absolute inset-0 z-[145] cursor-crosshair outline-none"
          tabIndex={0}
          role="application"
          aria-label="Khu vực điều khiển nhân vật. Chạm vị trí hoặc dùng WASD và phím mũi tên để di chuyển."
          onKeyDown={handleMoveKey}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setSafePlayerPosition(
              ((event.clientX - rect.left) / rect.width) * 100,
              ((event.clientY - rect.top) / rect.height) * 100
            );
            event.currentTarget.focus({ preventScroll: true });
          }}
        >
          <div className="absolute left-1/2 top-[22%] -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-300/30 bg-black/65 px-3 py-1.5 text-[9px] font-semibold text-emerald-200 backdrop-blur-md">
            Chạm trên sàn · WASD / phím mũi tên
          </div>
        </div>
      )}

      <SpotlightCard person={spotPerson} />

      {/* 8. GIFT NOTIFICATION BANNER WITH COMBO MULTIPLIER */}
      <GiftNotificationBanner currentGift={currentGift} />

      {/* Primary visitor actions live directly on the temple screen. */}
      {!prayerOpen && !chatOpen && (
        <div className="absolute bottom-[7.2%] left-1/2 z-[170] flex -translate-x-1/2 items-center gap-1.5">
          {onSubmitPrayer && (
            <button
              type="button"
              onClick={() => setPrayerOpen(true)}
              className="whitespace-nowrap rounded-full border border-amber-200/50 bg-[#2b170d]/92 px-3 py-2 text-[10px] font-bold text-amber-100 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-amber-200 hover:bg-[#3a2113]"
            >
              ✦ Gửi lời nguyện
            </button>
          )}
          {onSendChat && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200/50 bg-amber-300 px-3 py-2 text-[10px] font-bold text-stone-950 shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition hover:-translate-y-0.5 hover:bg-amber-200"
            >
              <MessageCircle size={12} /> Chat trong chánh điện
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setFreeMoveEnabled((enabled) => {
                const next = !enabled;
                if (next) onMove?.(playerPosition);
                return next;
              })
            }
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-2 text-[10px] font-bold shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition hover:-translate-y-0.5 ${
              freeMoveEnabled
                ? 'border-emerald-200/60 bg-emerald-300 text-emerald-950'
                : 'border-amber-200/40 bg-[#2b170d]/92 text-amber-100 backdrop-blur-md'
            }`}
            aria-pressed={freeMoveEnabled}
          >
            <Move size={12} /> {freeMoveEnabled ? 'Đang di chuyển' : 'Di chuyển'}
          </button>
          {onReact && (
            <button
              type="button"
              onClick={() => setReactionsOpen((open) => !open)}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-amber-200/40 bg-[#2b170d]/92 text-base shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-amber-200"
              aria-label="Mở tương tác nhanh"
              aria-expanded={reactionsOpen}
            >
              😊
            </button>
          )}
        </div>
      )}

      {!prayerOpen && !chatOpen && reactionsOpen && onReact && (
        <div className="absolute bottom-[13.5%] left-1/2 z-[175] flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-200/35 bg-[#21120b]/94 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md">
          {QUICK_REACTIONS.map((reaction) => (
            <button
              type="button"
              key={reaction}
              onClick={() => {
                onReact(reaction);
                setReactionsOpen(false);
              }}
              className="grid size-8 place-items-center rounded-full text-lg transition hover:-translate-y-0.5 hover:bg-amber-200/15"
              aria-label={`Gửi tương tác ${reaction}`}
            >
              {reaction}
            </button>
          ))}
        </div>
      )}

      {onSubmitPrayer && prayerOpen && (
        <div className="absolute inset-0 z-[190] flex items-end bg-black/65 p-2.5 backdrop-blur-[2px] sm:p-4">
          <form
            onSubmit={submitPrayer}
            className="w-full select-text rounded-2xl border border-amber-200/30 bg-[#1a0f0a]/98 p-3.5 text-left shadow-[0_-12px_50px_rgba(0,0,0,0.55)] sm:p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400">Ngay tại chánh điện</p>
                <h2 className="mt-1 font-temple text-lg font-semibold text-amber-50">Gửi lời nguyện lành</h2>
              </div>
              <button
                type="button"
                onClick={() => setPrayerOpen(false)}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 text-stone-400 transition hover:text-white"
                aria-label="Đóng bảng gửi lời nguyện"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-3 grid gap-2.5">
              <div className="rounded-xl border border-amber-200/15 bg-amber-300/[0.06] px-3 py-2 text-[10px] text-amber-200">
                Người gửi: <strong>{visitorName}</strong>
              </div>
              <label>
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-stone-400">Điều bạn muốn gửi gắm</span>
                <textarea
                  value={prayerText}
                  onChange={(event) => setPrayerText(event.target.value)}
                  maxLength={180}
                  rows={3}
                  placeholder="Mong gia đình bình an, tâm trí nhẹ nhàng..."
                  className="w-full resize-none rounded-xl border border-amber-100/15 bg-black/25 px-3 py-2.5 text-xs leading-5 text-white outline-none placeholder:text-stone-600 focus:border-amber-300/60"
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-xs font-bold text-stone-950 transition hover:bg-amber-200"
            >
              <Send size={14} /> Gửi lời nguyện và vào chánh điện
            </button>
          </form>
        </div>
      )}

      {onSendChat && chatOpen && (
        <div className="absolute inset-0 z-[190] flex items-end bg-black/60 p-2.5 backdrop-blur-[2px] sm:p-4">
          <div className="flex max-h-[72%] w-full select-text flex-col overflow-hidden rounded-2xl border border-amber-200/30 bg-[#1a0f0a]/98 text-left shadow-[0_-12px_50px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3.5 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <MessageCircle size={15} className="text-amber-300" />
                  <h2 className="font-temple text-base font-semibold text-amber-50">Chat trong chánh điện</h2>
                </div>
                <p className={`mt-0.5 inline-flex items-center gap-1 text-[9px] ${chatConnected ? 'text-emerald-400' : 'text-stone-500'}`}>
                  {chatConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {chatConnected ? 'Đang kết nối với mọi người' : 'Đang kết nối lại'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 text-stone-400 transition hover:text-white"
                aria-label="Đóng chat"
              >
                <X size={15} />
              </button>
            </div>

            <div ref={chatListRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3" aria-live="polite">
              {chatMessages.length === 0 ? (
                <div className="py-7 text-center text-[11px] text-stone-500">Chưa có lời nhắn. Hãy gửi lời chào đầu tiên.</div>
              ) : (
                chatMessages.slice(-30).map((message) => {
                  const own =
                    visitorName.trim() &&
                    message.name.toLocaleLowerCase('vi-VN') === visitorName.trim().toLocaleLowerCase('vi-VN');
                  return (
                    <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[86%] rounded-xl px-2.5 py-1.5 ${own ? 'rounded-br-sm bg-amber-300 text-stone-950' : 'rounded-bl-sm border border-white/8 bg-black/25 text-stone-200'}`}>
                        <strong className={`block truncate text-[9px] ${own ? 'text-stone-700' : 'text-amber-300'}`}>{message.name}</strong>
                        <p className="mt-0.5 break-words text-[10px] leading-4">{message.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={submitChat} className="space-y-2 border-t border-white/8 p-3">
              <div className="text-[9px] text-stone-500">Đang chat với tên <strong className="text-amber-200">{visitorName}</strong></div>
              <div className="flex gap-2">
                <input
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  maxLength={300}
                  autoFocus
                  placeholder="Nhắn với mọi người..."
                  className="min-w-0 flex-1 rounded-xl border border-amber-100/15 bg-black/25 px-3 py-2.5 text-[11px] text-white outline-none placeholder:text-stone-600 focus:border-amber-300/60"
                  aria-label="Nội dung tin nhắn"
                />
                <button
                  type="submit"
                  disabled={!chatDraft.trim() || chatSending}
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-300 text-stone-950 transition hover:bg-amber-200 disabled:opacity-40"
                  aria-label="Gửi tin nhắn"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Sound shortcuts for the visitor */}
      <div className="absolute bottom-0 inset-x-0 z-150 px-3 pb-3 pt-1 flex items-center justify-between pointer-events-auto">
        {/* Real Buddhist Music status indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-amber-500/40 text-[10px] text-stone-200 backdrop-blur-md">
          <span className={`w-2 h-2 rounded-full ${isBgmPlaying ? 'bg-amber-400 animate-pulse' : 'bg-stone-600'}`} />
          <span className="font-medium truncate max-w-[190px]">
            {isBgmPlaying
              ? config.buddhistMusicTrack === 'chill'
                ? '🍃 Nhạc chill thư giãn'
                : config.buddhistMusicTrack === 'niem_phat'
                ? '📿 Niệm Phật Thích Trí Thoát'
                : config.buddhistMusicTrack === 'khuc_thien_dao'
                ? '🎶 Khúc Thiền Đạo Trầm Bổng'
                : '🎋 Sáo Trúc & Đàn Tranh Dịu Êm'
              : 'Nhạc Phật giáo đang tắt'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleBgm && (
            <button
              onClick={onToggleBgm}
              title={isBgmPlaying ? 'Tắt Nhạc Phật Giáo' : 'Bật Nhạc Niệm Phật Always'}
              className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm shadow-lg hover:scale-110 active:scale-95 transition-all backdrop-blur-md ${
                isBgmPlaying
                  ? 'bg-amber-950/80 border-amber-400/70 text-amber-300'
                  : 'bg-black/70 border-stone-700 text-stone-500'
              }`}
            >
              🎵
            </button>
          )}
          <button
            onClick={onRingBell}
            title="Thỉnh Chuông U Minh"
            className="w-9 h-9 rounded-full bg-black/70 border border-amber-400/50 flex items-center justify-center text-amber-300 text-sm shadow-lg hover:scale-110 active:scale-95 transition-all backdrop-blur-md"
          >
            🔔
          </button>
          <button
            onClick={onPlayGong}
            title="Gõ Mõ Tụng Kinh"
            className="w-9 h-9 rounded-full bg-black/70 border border-amber-600/50 flex items-center justify-center text-amber-300 text-sm shadow-lg hover:scale-110 active:scale-95 transition-all backdrop-blur-md"
          >
            🪵
          </button>
        </div>
      </div>
    </div>
  );
};
