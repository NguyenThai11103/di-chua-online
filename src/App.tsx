import { useEffect, useMemo, useRef, useState } from 'react';
import { ChanhDienStage } from './components/ChanhDienStage';
import { HeaderNav } from './components/HeaderNav';
import { NameSetup } from './components/NameSetup';
import { VisitorPanel, type OfferingChoice } from './components/VisitorPanel';
import type { ChatMessage, Devotee, GiftEvent, LeaderboardEntry, MusicTrack, OfferRequest, OnlineVisitor, ReactionEmoji, StreamConfig, TempleAction } from './types/temple';
import { soundEngine } from './services/soundEngine';
import { maskBanned } from './services/bannedWords';
import { pickSeat } from './services/seating';

const DEFAULT_CONFIG: StreamConfig = {
  channelName: 'Thích Chi Nói Nấy',
  liveTitle: 'THÍCH CHI NÓI NẤY',
  subTitle: 'Một khoảng lặng bình yên dành cho bạn',
  isConnected: true,
  autoTts: false,
  voiceGender: 'female',
  ttsSpeed: 0.85,
  ttsPitch: 1.08,
  bellSoundEnabled: true,
  gongSoundEnabled: true,
  chantAmbientEnabled: false,
  bgmEnabled: false,
  bgmVolume: 0.18,
  buddhistMusicTrack: 'chill',
  isDharmaLectureActive: false,
  displayRatio: '9:16',
  viewMode: 'dual',
};

const ROBE_COLORS = ['#38bdf8', '#10b981', '#a855f7', '#3b82f6', '#d97706', '#06b6d4'];

const OFFERING_META: Record<OfferingChoice, { type: GiftEvent['giftType']; name: string; meaning: string }> = {
  incense: { type: 'dang_huong', name: 'Nén hương thành tâm', meaning: 'Cầu tâm an, trí sáng' },
  lotus: { type: 'dang_hoa_sen', name: 'Đóa sen thanh tịnh', meaning: 'Cầu bình an, cát tường' },
  candle: { type: 'le_phat', name: 'Ngọn đèn tỉnh thức', meaning: 'Cầu trí tuệ và sáng suốt' },
};

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [visitorName, setVisitorName] = useState(() => window.localStorage.getItem('templeVisitorName') || '');
  const [nameConfigured, setNameConfigured] = useState(() => Boolean(window.localStorage.getItem('templeVisitorName')));
  const [devotees, setDevotees] = useState<Devotee[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [offerRequests, setOfferRequests] = useState<OfferRequest[]>([]);
  const [currentOffering, setCurrentOffering] = useState<GiftEvent | null>(null);
  const [auraIntensity, setAuraIntensity] = useState(0.1);
  const [isOfferingActive, setIsOfferingActive] = useState(false);
  const [activityCount, setActivityCount] = useState(0);
  const [rainUntil, setRainUntil] = useState(0);
  const [notice, setNotice] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatConnected, setChatConnected] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const offeringTimer = useRef<number | null>(null);
  const movementTimer = useRef<number | null>(null);
  const pendingMovement = useRef<{ x: number; y: number } | null>(null);
  const visitorIdRef = useRef('');
  const seenActionsRef = useRef(new Set<string>());
  const realtimeActionRef = useRef<(action: TempleAction) => void>(() => {});

  if (!visitorIdRef.current) {
    const savedId = window.localStorage.getItem('templeVisitorId');
    visitorIdRef.current = savedId || window.crypto.randomUUID();
    window.localStorage.setItem('templeVisitorId', visitorIdRef.current);
  }

  const activityProgress = activityCount % 20;

  useEffect(() => soundEngine.setChannelName(config.channelName), [config.channelName]);
  useEffect(() => soundEngine.setSpeechRate(config.ttsSpeed), [config.ttsSpeed]);

  useEffect(() => {
    if (config.bgmEnabled) soundEngine.startBuddhistMusic(config.buddhistMusicTrack, config.bgmVolume);
    else soundEngine.stopBuddhistMusic();
  }, [config.bgmEnabled, config.buddhistMusicTrack, config.bgmVolume]);

  useEffect(() => {
    if (auraIntensity <= 0.1) return;
    const interval = window.setInterval(() => setAuraIntensity((value) => Math.max(0.1, value - 0.05)), 180);
    return () => window.clearInterval(interval);
  }, [auraIntensity]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!nameConfigured || !visitorName) return;
    const id = visitorIdRef.current;
    const body = () => JSON.stringify({ id, name: visitorName });
    const join = () =>
      fetch('/api/visitors/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body(),
      }).catch(() => setNotice('Chưa thể tham gia chánh điện chung.'));
    const heartbeat = () =>
      fetch('/api/visitors/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: visitorName }),
      }).catch(() => {});
    const leave = () => {
      const payload = new Blob([JSON.stringify({ id })], { type: 'application/json' });
      navigator.sendBeacon('/api/visitors/leave', payload);
    };

    join();
    const timer = window.setInterval(heartbeat, 20_000);
    window.addEventListener('pagehide', leave);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', leave);
      fetch('/api/visitors/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [nameConfigured, visitorName]);

  useEffect(() => {
    fetch('/api/chat/messages')
      .then((response) => response.json())
      .then((data) => setChatMessages(Array.isArray(data.messages) ? data.messages : []))
      .catch(() => setNotice('Chưa thể tải lịch sử trò chuyện.'));

    const events = new EventSource('/api/chat/events');
    events.onopen = () => setChatConnected(true);
    events.onerror = () => setChatConnected(false);
    events.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as ChatMessage;
        setChatMessages((previous) =>
          previous.some((item) => item.id === message.id) ? previous : [...previous.slice(-99), message]
        );
        const name = maskBanned(message.name).slice(0, 36);
        const text = maskBanned(message.text).slice(0, 180);
        const bubbleAt = message.createdAt;
        setDevotees((previous) => {
          const key = name.toLocaleLowerCase('vi-VN');
          const found = previous.find((devotee) => devotee.username.toLocaleLowerCase('vi-VN') === key);
          if (found) {
            return previous.map((devotee) =>
              devotee === found
                ? { ...devotee, activeComment: text, commentTimestamp: bubbleAt, lastActive: Date.now() }
                : devotee
            );
          }
          const { seat, evict } = pickSeat(previous);
          const devotee: Devotee = {
            id: `chat-${message.id}`,
            username: name,
            displayName: name,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            robeColor: ROBE_COLORS[seat % ROBE_COLORS.length],
            bowOffset: Math.random() * 0.9,
            seat,
            activeComment: text,
            commentTimestamp: bubbleAt,
          };
          return [...previous.filter((item) => item !== evict), devotee];
        });
        window.setTimeout(() => {
          setDevotees((previous) =>
            previous.map((devotee) =>
              devotee.username.toLocaleLowerCase('vi-VN') === name.toLocaleLowerCase('vi-VN') &&
              devotee.commentTimestamp === bubbleAt
                ? { ...devotee, activeComment: undefined }
                : devotee
            )
          );
        }, 8_000);
      } catch {
        // Ignore malformed server events and keep the stream alive.
      }
    });
    events.addEventListener('presence', (event) => {
      try {
        const data = JSON.parse(event.data) as { visitors?: OnlineVisitor[] };
        const online = Array.isArray(data.visitors) ? data.visitors : [];
        const activeIds = new Set(online.map((visitor) => visitor.id));
        setDevotees((previous) => {
          let next = previous.filter((devotee) => !devotee.presenceId || activeIds.has(devotee.presenceId));
          online.forEach((visitor) => {
            const name = maskBanned(visitor.name).slice(0, 36);
            const found = next.find(
              (devotee) =>
                devotee.presenceId === visitor.id ||
                (!devotee.presenceId && devotee.username.toLocaleLowerCase('vi-VN') === name.toLocaleLowerCase('vi-VN'))
            );
            if (found) {
              next = next.map((devotee) =>
                devotee === found
                  ? {
                      ...devotee,
                      presenceId: visitor.id,
                      username: name,
                      displayName: name,
                      lastActive: Date.now(),
                      livePosition:
                        typeof visitor.x === 'number' && typeof visitor.y === 'number'
                          ? { x: visitor.x, y: visitor.y }
                          : devotee.livePosition,
                    }
                  : devotee
              );
              return;
            }
            const { seat, evict } = pickSeat(next);
            const now = Date.now();
            next = [
              ...next.filter((devotee) => devotee !== evict),
              {
                id: `online-${visitor.id}`,
                presenceId: visitor.id,
                username: name,
                displayName: name,
                joinedAt: now,
                lastActive: now,
                robeColor: ROBE_COLORS[seat % ROBE_COLORS.length],
                bowOffset: Math.random() * 0.9,
                seat,
                livePosition:
                  typeof visitor.x === 'number' && typeof visitor.y === 'number'
                    ? { x: visitor.x, y: visitor.y }
                    : undefined,
              },
            ];
          });
          return next;
        });
      } catch {
        // Keep the current crowd if a presence event is malformed.
      }
    });
    events.addEventListener('movement', (event) => {
      try {
        const movement = JSON.parse(event.data) as { id?: string; x?: number; y?: number };
        if (!movement.id || typeof movement.x !== 'number' || typeof movement.y !== 'number') return;
        setDevotees((previous) =>
          previous.map((devotee) =>
            devotee.presenceId === movement.id
              ? { ...devotee, livePosition: { x: movement.x!, y: movement.y! }, lastActive: Date.now() }
              : devotee
          )
        );
      } catch {
        // Ignore malformed movement events.
      }
    });
    events.addEventListener('temple-action', (event) => {
      try {
        realtimeActionRef.current(JSON.parse(event.data) as TempleAction);
      } catch {
        // Ignore malformed temple action events.
      }
    });
    return () => events.close();
  }, []);

  const addMerit = (name: string, points: number) => {
    setLeaderboard((previous) => {
      const key = name.toLocaleLowerCase('vi-VN');
      const found = previous.find((entry) => entry.username.toLocaleLowerCase('vi-VN') === key);
      const next = found
        ? previous.map((entry) => (entry === found ? { ...entry, score: (entry.score ?? 0) + points } : entry))
        : [...previous, { username: name, displayName: maskBanned(name), diamonds: 0, score: points, rank: previous.length + 1 }];
      return next
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    });
  };

  const addOrUpdateDevotee = (name: string, wish?: string) => {
    setDevotees((previous) => {
      const key = name.toLocaleLowerCase('vi-VN');
      const found = previous.find((devotee) => devotee.username.toLocaleLowerCase('vi-VN') === key);
      if (found) {
        return previous.map((devotee) =>
          devotee === found
            ? {
                ...devotee,
                activeComment: wish ? maskBanned(wish) : devotee.activeComment,
                commentTimestamp: Date.now(),
                lastActive: Date.now(),
              }
            : devotee
        );
      }
      const { seat, evict } = pickSeat(previous);
      const now = Date.now();
      const devotee: Devotee = {
        id: `visitor-${now}-${seat}`,
        username: name,
        displayName: maskBanned(name),
        joinedAt: now,
        lastActive: now,
        robeColor: ROBE_COLORS[seat % ROBE_COLORS.length],
        bowOffset: Math.random() * 0.9,
        seat,
        activeComment: wish ? maskBanned(wish) : undefined,
        commentTimestamp: wish ? now : undefined,
      };
      return [...previous.filter((item) => item !== evict), devotee];
    });
  };

  const requestIncenseOffering = (name: string) => {
    setOfferRequests((previous) => [
      ...previous.slice(-99),
      { id: `offering-${Date.now()}-${name}`, username: name, displayName: maskBanned(name) },
    ]);
  };

  const countActivity = () => {
    setActivityCount((previous) => {
      const next = previous + 1;
      if (next % 20 === 0) setRainUntil(Date.now() + 30_000);
      return next;
    });
  };

  const performPrayer = (nameInput: string, wishInput: string, local: boolean) => {
    const name = maskBanned(nameInput.trim() || 'Người hữu duyên').slice(0, 36);
    const wish = maskBanned(wishInput.trim()).slice(0, 180);
    if (local) setVisitorName(name);
    addOrUpdateDevotee(name, wish);
    addMerit(name, 1);
    requestIncenseOffering(name);
    countActivity();
    setAuraIntensity(0.75);
    if (local) {
      soundEngine.playMuoGong(0.7);
      setNotice(`Lời nguyện của ${name} đã được gửi vào chánh điện.`);
    }

    if (wish) {
      window.setTimeout(() => {
        setDevotees((previous) =>
          previous.map((devotee) =>
            devotee.username === name ? { ...devotee, activeComment: undefined } : devotee
          )
        );
      }, 6000);
    }
  };

  const performOffering = (choice: OfferingChoice, nameInput: string, local: boolean, actionId?: string) => {
    const name = maskBanned(nameInput.trim() || 'Người hữu duyên').slice(0, 36);
    const meta = OFFERING_META[choice];
    const now = Date.now();
    const offering: GiftEvent = {
      id: `ritual-${actionId || now}`,
      username: name,
      displayName: name,
      giftType: meta.type,
      giftName: meta.name,
      prayerMeaning: meta.meaning,
      comboCount: 1,
      diamonds: 1,
      timestamp: now,
    };

    if (local) setVisitorName(name);
    addOrUpdateDevotee(name);
    addMerit(name, 3);
    requestIncenseOffering(name);
    setCurrentOffering(offering);
    setAuraIntensity(1);
    setIsOfferingActive(true);
    countActivity();
    if (local) {
      soundEngine.playLotusBloom(0.65);
      setNotice(`${name} đã dâng ${meta.name.toLocaleLowerCase('vi-VN')}.`);
    }

    if (offeringTimer.current) window.clearTimeout(offeringTimer.current);
    offeringTimer.current = window.setTimeout(() => {
      setCurrentOffering(null);
      setIsOfferingActive(false);
    }, 4500);
  };

  const performReaction = (visitorId: string, nameInput: string, reaction: ReactionEmoji) => {
    const name = maskBanned(nameInput.trim() || 'Người hữu duyên').slice(0, 36);
    const reactionAt = Date.now();
    setDevotees((previous) => {
      const key = name.toLocaleLowerCase('vi-VN');
      const found = previous.find(
        (devotee) =>
          devotee.presenceId === visitorId || devotee.username.toLocaleLowerCase('vi-VN') === key
      );
      if (found) {
        return previous.map((devotee) =>
          devotee === found
            ? { ...devotee, activeReaction: reaction, reactionTimestamp: reactionAt, lastActive: reactionAt }
            : devotee
        );
      }
      const { seat, evict } = pickSeat(previous);
      return [
        ...previous.filter((devotee) => devotee !== evict),
        {
          id: `reaction-${visitorId}`,
          presenceId: visitorId,
          username: name,
          displayName: name,
          joinedAt: reactionAt,
          lastActive: reactionAt,
          robeColor: ROBE_COLORS[seat % ROBE_COLORS.length],
          bowOffset: Math.random() * 0.9,
          seat,
          activeReaction: reaction,
          reactionTimestamp: reactionAt,
        },
      ];
    });
    countActivity();
    window.setTimeout(() => {
      setDevotees((previous) =>
        previous.map((devotee) =>
          (devotee.presenceId === visitorId || devotee.username.toLocaleLowerCase('vi-VN') === name.toLocaleLowerCase('vi-VN')) &&
          devotee.reactionTimestamp === reactionAt
            ? { ...devotee, activeReaction: undefined, reactionTimestamp: undefined }
            : devotee
        )
      );
    }, 3200);
  };

  const publishTempleAction = (action: TempleAction) =>
    fetch('/api/temple/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    }).catch(() => setNotice('Chưa thể đồng bộ nghi thức với mọi người.'));

  const handlePrayer = (nameInput: string, wishInput: string) => {
    const action: TempleAction = {
      id: window.crypto.randomUUID(),
      visitorId: visitorIdRef.current,
      name: maskBanned(nameInput.trim() || 'Người hữu duyên').slice(0, 36),
      kind: 'prayer',
      text: maskBanned(wishInput.trim()).slice(0, 180),
      createdAt: Date.now(),
    };
    seenActionsRef.current.add(action.id);
    performPrayer(action.name, action.text || '', true);
    void publishTempleAction(action);
  };

  const handleOffering = (choice: OfferingChoice) => {
    const action: TempleAction = {
      id: window.crypto.randomUUID(),
      visitorId: visitorIdRef.current,
      name: maskBanned(visitorName.trim() || 'Người hữu duyên').slice(0, 36),
      kind: 'offering',
      choice,
      createdAt: Date.now(),
    };
    seenActionsRef.current.add(action.id);
    performOffering(choice, action.name, true, action.id);
    void publishTempleAction(action);
  };

  const handleReaction = (reaction: ReactionEmoji) => {
    const action: TempleAction = {
      id: window.crypto.randomUUID(),
      visitorId: visitorIdRef.current,
      name: maskBanned(visitorName.trim() || 'Người hữu duyên').slice(0, 36),
      kind: 'reaction',
      reaction,
      createdAt: Date.now(),
    };
    seenActionsRef.current.add(action.id);
    performReaction(action.visitorId, action.name, reaction);
    void publishTempleAction(action);
  };

  realtimeActionRef.current = (action) => {
    if (!action.id || seenActionsRef.current.has(action.id)) return;
    seenActionsRef.current.add(action.id);
    if (seenActionsRef.current.size > 200) {
      const oldest = seenActionsRef.current.values().next().value;
      if (oldest) seenActionsRef.current.delete(oldest);
    }
    if (action.kind === 'prayer') performPrayer(action.name, action.text || '', false);
    if (action.kind === 'offering' && action.choice) {
      performOffering(action.choice, action.name, false, action.id);
    }
    if (action.kind === 'reaction' && action.reaction) {
      performReaction(action.visitorId, action.name, action.reaction);
    }
  };

  const handleRingBell = () => {
    soundEngine.playTempleBell(0.85);
    setAuraIntensity(0.72);
    setNotice('Một tiếng chuông an lành vừa ngân lên.');
  };

  const handlePlayGong = () => {
    soundEngine.playMuoGong(0.85);
    setNotice('Tiếng mõ giúp nhịp thở chậm lại và tâm trí lắng xuống.');
  };

  const handleToggleBgm = () => setConfig((previous) => ({ ...previous, bgmEnabled: !previous.bgmEnabled }));

  const handleTrackChange = (track: MusicTrack) => {
    setConfig((previous) => ({ ...previous, buddhistMusicTrack: track, bgmEnabled: true }));
    soundEngine.switchBgmTrack(track);
  };

  const handleMove = (position: { x: number; y: number }) => {
    const id = visitorIdRef.current;
    pendingMovement.current = position;
    setDevotees((previous) =>
      previous.map((devotee) =>
        devotee.presenceId === id ? { ...devotee, livePosition: position, lastActive: Date.now() } : devotee
      )
    );
    if (movementTimer.current !== null) return;
    movementTimer.current = window.setTimeout(() => {
      movementTimer.current = null;
      const latest = pendingMovement.current;
      pendingMovement.current = null;
      if (!latest) return;
      fetch('/api/visitors/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...latest }),
      }).catch(() => setNotice('Chưa thể đồng bộ vị trí với mọi người.'));
    }, 80);
  };

  const handleSaveName = (nameInput: string) => {
    const name = maskBanned(nameInput.trim()).slice(0, 36);
    if (!name) return;
    window.localStorage.setItem('templeVisitorName', name);
    setVisitorName(name);
    setNameConfigured(true);
  };

  const handleSendChat = async (textInput: string) => {
    const name = maskBanned(visitorName.trim() || 'Người hữu duyên').slice(0, 36);
    const text = maskBanned(textInput.trim()).slice(0, 300);
    if (!text) return false;
    setVisitorName(name);
    setChatSending(true);
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, text }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error || 'Chưa thể gửi tin nhắn.');
        return false;
      }
      return true;
    } catch {
      setNotice('Mất kết nối chat. Vui lòng thử lại.');
      return false;
    } finally {
      setChatSending(false);
    }
  };

  const stats = useMemo(
    () => [
      { value: devotees.length, label: 'người đang tĩnh tâm' },
      { value: activityCount, label: 'lời nguyện và nghi thức' },
    ],
    [activityCount, devotees.length]
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0b0705] text-stone-100">
      <HeaderNav isBgmPlaying={config.bgmEnabled} onToggleBgm={handleToggleBgm} />

      <main>
        <section className="relative isolate overflow-hidden border-b border-amber-200/10">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(180,113,36,0.18),transparent_34%),radial-gradient(circle_at_90%_30%,rgba(120,62,24,0.16),transparent_28%)]" />
          <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-12 lg:px-10 lg:pt-16">
            <div className="mb-7 max-w-3xl sm:mb-10">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-amber-300/80">Không gian tĩnh tâm trực tuyến</p>
              <h1 className="font-temple text-3xl font-semibold leading-tight text-amber-50 sm:text-5xl lg:text-6xl">
                Dành một khoảng lặng <span className="text-amber-300">cho chính mình</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                Bước vào chánh điện, gửi một lời nguyện lành, dâng hương và lắng nghe âm thanh thiền tịnh ngay trên thiết bị của bạn.
              </p>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(360px,520px)_minmax(0,1fr)] lg:gap-8 xl:gap-12">
              <div id="chanh-dien" className="mx-auto w-full max-w-[520px] lg:sticky lg:top-24">
                <ChanhDienStage
                  config={config}
                  devotees={devotees}
                  currentGift={currentOffering}
                  offerRequests={offerRequests}
                  leaderboardDonors={leaderboard}
                  auraIntensity={auraIntensity}
                  isGiftActive={isOfferingActive}
                  onRingBell={handleRingBell}
                  onPlayGong={handlePlayGong}
                  onToggleBgm={handleToggleBgm}
                  isBgmPlaying={config.bgmEnabled}
                  likeProgress={activityProgress}
                  rainUntil={rainUntil}
                  visitorName={visitorName}
                  visitorId={visitorIdRef.current}
                  onSubmitPrayer={handlePrayer}
                  onMove={handleMove}
                  onReact={handleReaction}
                  chatMessages={chatMessages}
                  chatConnected={chatConnected}
                  chatSending={chatSending}
                  onSendChat={handleSendChat}
                />
              </div>

              <div id="gui-loi-nguyen" className="min-w-0">
                <VisitorPanel
                  visitorName={visitorName}
                  isBgmPlaying={config.bgmEnabled}
                  currentTrack={config.buddhistMusicTrack}
                  volume={config.bgmVolume}
                  stats={stats}
                  onEditName={() => setNameConfigured(false)}
                  onOffering={handleOffering}
                  onRingBell={handleRingBell}
                  onPlayGong={handlePlayGong}
                  onToggleBgm={handleToggleBgm}
                  onTrackChange={handleTrackChange}
                  onVolumeChange={(volume) => setConfig((previous) => ({ ...previous, bgmVolume: volume }))}
                />
              </div>
            </div>
          </div>
        </section>

        <section id="huong-dan" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-10">
          <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Một phút an nhiên</p>
              <h2 className="mt-3 font-temple text-3xl font-semibold text-amber-50 sm:text-4xl">Ba bước rất nhẹ nhàng</h2>
              <p className="mt-4 leading-7 text-stone-400">Không cần đăng nhập, không có quà tặng trả phí và không liên kết mạng xã hội.</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                ['01', 'Ghi tên', 'Tên chỉ được dùng trong phiên hiện tại.'],
                ['02', 'Gửi lời nguyện', 'Viết điều bạn đang muốn gửi gắm.'],
                ['03', 'Tĩnh tâm', 'Dâng hương, nghe chuông và thở chậm.'],
              ].map(([number, title, body]) => (
                <li key={number} className="rounded-2xl border border-amber-100/10 bg-white/[0.035] p-5">
                  <span className="text-xs font-bold tracking-widest text-amber-400">{number}</span>
                  <h3 className="mt-4 font-temple text-xl font-semibold text-amber-100">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-400">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-amber-100/10 px-4 py-7 text-center text-xs leading-6 text-stone-500">
        Đi Chùa Online là không gian mô phỏng để thư giãn và tĩnh tâm, không thay thế việc hành lễ tại cơ sở tôn giáo.
      </footer>

      {notice && (
        <div className="fixed bottom-4 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-amber-300/30 bg-[#21130d]/95 px-4 py-3 text-center text-sm text-amber-100 shadow-2xl backdrop-blur-xl" role="status">
          {notice}
        </div>
      )}
      {!nameConfigured && <NameSetup initialName={visitorName} onSave={handleSaveName} />}
    </div>
  );
}
