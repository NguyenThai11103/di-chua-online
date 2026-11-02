import { Bell, Flame, Flower2, LampDesk, Music2, Pencil, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { MusicTrack } from '../types/temple';

export type OfferingChoice = 'incense' | 'lotus' | 'candle';

interface VisitorPanelProps {
  visitorName: string;
  isBgmPlaying: boolean;
  currentTrack: MusicTrack;
  volume: number;
  stats: Array<{ value: number; label: string }>;
  onEditName: () => void;
  onOffering: (choice: OfferingChoice) => void;
  onRingBell: () => void;
  onPlayGong: () => void;
  onToggleBgm: () => void;
  onTrackChange: (track: MusicTrack) => void;
  onVolumeChange: (volume: number) => void;
}

const tracks: Array<{ id: MusicTrack; label: string; detail: string }> = [
  { id: 'chill', label: 'An nhiên', detail: 'Piano và sáo nhẹ' },
  { id: 'sao_truc', label: 'Sáo trúc', detail: 'Trong trẻo, thư thái' },
  { id: 'niem_phat', label: 'Niệm Phật', detail: 'Nhịp chậm, tĩnh tâm' },
  { id: 'khuc_thien_dao', label: 'Khúc thiền', detail: 'Đàn tranh và tiêu' },
];

const offerings: Array<{ id: OfferingChoice; title: string; description: string; icon: typeof Flame }> = [
  { id: 'incense', title: 'Dâng hương', description: 'Gửi lòng thành kính', icon: Flame },
  { id: 'lotus', title: 'Dâng hoa sen', description: 'Nuôi dưỡng tâm lành', icon: Flower2 },
  { id: 'candle', title: 'Thắp đèn', description: 'Hướng về sáng suốt', icon: LampDesk },
];

export const VisitorPanel = ({
  visitorName,
  isBgmPlaying,
  currentTrack,
  volume,
  stats,
  onEditName,
  onOffering,
  onRingBell,
  onPlayGong,
  onToggleBgm,
  onTrackChange,
  onVolumeChange,
}: VisitorPanelProps) => {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-amber-100/10 bg-white/[0.035] px-4 py-3.5">
            <strong className="block font-temple text-2xl font-semibold text-amber-200 sm:text-3xl">{stat.value}</strong>
            <span className="mt-1 block text-[11px] leading-4 text-stone-500 sm:text-xs">{stat.label}</span>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-amber-200/15 bg-[#17100c]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-300">
            <Sparkles size={19} />
          </span>
          <div>
            <h2 className="font-temple text-2xl font-semibold text-amber-50">Tương tác ngay trên chánh điện</h2>
            <p className="mt-1 text-sm leading-6 text-stone-400">
              Chạm nút <strong className="font-semibold text-amber-200">“Gửi lời nguyện lành”</strong> trên màn hình chánh điện để nhập tên và điều bạn muốn gửi gắm.
              Bạn cũng có thể chat trực tiếp; lời nhắn và tương tác nhanh sẽ hiện trên đầu nhân vật của bạn.
              Bật <strong className="font-semibold text-amber-200">“Di chuyển”</strong> để tự điều khiển nhân vật bằng chạm, WASD hoặc phím mũi tên.
            </p>
            {visitorName && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="inline-flex rounded-full border border-amber-200/15 bg-amber-300/[0.06] px-3 py-1.5 text-xs text-amber-200">
                  Đang hành lễ: {visitorName}
                </p>
                <button type="button" onClick={onEditName} className="inline-flex items-center gap-1 text-[11px] text-stone-500 transition hover:text-amber-200">
                  <Pencil size={11} /> Đổi tên
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-100/10 bg-white/[0.025] p-4 sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Nghi thức tĩnh tâm</p>
            <h2 className="mt-1 font-temple text-2xl font-semibold text-amber-50">Chọn một hành động</h2>
          </div>
          <span className="hidden text-xs text-stone-500 sm:block">Hoàn toàn miễn phí</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {offerings.map(({ id, title, description, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => onOffering(id)}
              className="group rounded-2xl border border-amber-100/10 bg-black/15 p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-amber-300/[0.06]"
            >
              <Icon size={21} className="text-amber-300 transition group-hover:scale-110" />
              <strong className="mt-4 block text-sm text-amber-50">{title}</strong>
              <span className="mt-1 block text-xs leading-5 text-stone-500">{description}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onRingBell} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-100/10 bg-black/15 px-3 py-3 text-sm text-stone-300 transition hover:border-amber-300/30 hover:text-amber-200">
            <Bell size={16} /> Thỉnh chuông
          </button>
          <button type="button" onClick={onPlayGong} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-100/10 bg-black/15 px-3 py-3 text-sm text-stone-300 transition hover:border-amber-300/30 hover:text-amber-200">
            <span aria-hidden="true">◉</span> Gõ mõ
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-100/10 bg-white/[0.025] p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Music2 size={19} className="text-amber-300" />
            <div>
              <h2 className="font-temple text-xl font-semibold text-amber-50">Âm thanh thiền</h2>
              <p className="text-xs text-stone-500">Chọn không gian âm thanh phù hợp</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleBgm}
            className={`grid size-10 place-items-center rounded-full border transition ${
              isBgmPlaying ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-amber-100/15 text-stone-400 hover:text-amber-200'
            }`}
            aria-label={isBgmPlaying ? 'Tắt nhạc' : 'Bật nhạc'}
          >
            {isBgmPlaying ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {tracks.map((track) => (
            <button
              type="button"
              key={track.id}
              onClick={() => onTrackChange(track.id)}
              className={`rounded-xl border px-3.5 py-3 text-left transition ${
                currentTrack === track.id
                  ? 'border-amber-300/45 bg-amber-300/10 text-amber-100'
                  : 'border-amber-100/10 bg-black/10 text-stone-400 hover:border-amber-100/20'
              }`}
            >
              <strong className="block text-sm">{track.label}</strong>
              <span className="mt-0.5 block text-[11px] opacity-65">{track.detail}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-3">
          <Volume2 size={15} className="shrink-0 text-stone-500" />
          <input
            type="range"
            min="0"
            max="0.6"
            step="0.02"
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
            className="w-full accent-amber-300"
            aria-label="Âm lượng nhạc nền"
          />
          <span className="w-9 text-right text-xs tabular-nums text-stone-500">{Math.round(volume * 100)}%</span>
        </label>
      </section>
    </div>
  );
};
