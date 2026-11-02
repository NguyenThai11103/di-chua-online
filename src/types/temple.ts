/**
 * Shared types for the interactive Đi Chùa Online relaxation experience.
 */

export type MusicTrack = 'chill' | 'niem_phat' | 'sao_truc' | 'khuc_thien_dao';
export type ReactionEmoji = '🙏' | '👋' | '🪷' | '❤️';

export type GiftCategory = 'dang_huong' | 'le_phat' | 'dang_hoa_sen' | 'qua_dao' | 'ban_tim';

export interface Devotee {
  id: string;
  presenceId?: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: number;
  robeColor: string; // colorful traditional áo lam/áo dài
  activeComment?: string;
  commentTimestamp?: number;
  activeReaction?: ReactionEmoji;
  reactionTimestamp?: number;
  isVip?: boolean;
  totalDiamonds?: number;
  bowOffset: number;
  seat?: number; // seat index 0..SEAT_COUNT-1 (services/seating.ts), kept while they stay
  lastActive?: number; // last join/comment/gift time; the longest-idle person gives up their seat when the hall is full
  livePosition?: { x: number; y: number };
}

export interface GiftEvent {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  giftType: GiftCategory;
  giftName: string;
  prayerMeaning: string; // e.g. "Cầu Bình An", "Cầu Sức Khỏe", "Cầu Gia Đình", "Cầu Có Người Yêu"
  comboCount: number;
  diamonds: number;
  timestamp: number;
  readStatus?: boolean;
}

export interface LeaderboardEntry {
  username: string;
  displayName: string;
  avatarUrl?: string;
  diamonds: number;
  score?: number;
  giftType?: string;
  rank: number;
}

export interface StreamConfig {
  channelName: string;
  liveTitle: string; // legacy field retained for scene compatibility
  subTitle: string;
  isConnected: boolean;
  autoTts: boolean;
  voiceGender: 'female' | 'male'; // Giọng Nữ Phật Giáo (Default) vs Giọng Nam
  ttsSpeed: number;
  ttsPitch: number;
  bellSoundEnabled: boolean;
  gongSoundEnabled: boolean;
  chantAmbientEnabled: boolean;
  bgmEnabled: boolean;
  bgmVolume: number;
  buddhistMusicTrack: MusicTrack;
  isDharmaLectureActive: boolean;
  activeDharmaId?: string;
  activeDharmaParagraph?: number;
  displayRatio: '9:16' | 'fill';
  viewMode: 'dual' | 'stage_only' | 'control_only';
}

export interface CommentEvent {
  id: string;
  username: string;
  displayName: string;
  comment: string;
  timestamp: number;
  category?: 'peace' | 'wealth' | 'family' | 'health' | 'love' | 'general';
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  createdAt: number;
}

export interface OnlineVisitor {
  id: string;
  name: string;
  x?: number;
  y?: number;
}

export interface TempleAction {
  id: string;
  visitorId: string;
  name: string;
  kind: 'prayer' | 'offering' | 'reaction';
  choice?: 'incense' | 'lotus' | 'candle';
  reaction?: ReactionEmoji;
  text?: string;
  createdAt: number;
}

export interface AiTrendReport {
  sentimentSummary: string;
  prayerBreakdown: {
    peace: number;
    wealth: number;
    health: number;
    family: number;
    love: number;
  };
  predictedNextGift: string;
  suggestedBlessing: string;
  monkChantSuggestion: string;
  timestamp: number;
}

// Someone who should walk up and offer incense in the interactive hall.
export interface OfferRequest {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}
