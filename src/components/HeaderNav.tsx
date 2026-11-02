import { Flower2, Music2, VolumeX } from 'lucide-react';

interface HeaderNavProps {
  isBgmPlaying: boolean;
  onToggleBgm: () => void;
}

export const HeaderNav = ({ isBgmPlaying, onToggleBgm }: HeaderNavProps) => (
  <header className="sticky top-0 z-[180] border-b border-amber-100/10 bg-[#0b0705]/88 backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
      <a href="#chanh-dien" className="flex min-w-0 items-center gap-2.5" aria-label="Đi Chùa Online - Trang chủ">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-400/10 text-amber-300">
          <Flower2 size={18} strokeWidth={1.7} />
        </span>
        <span className="truncate font-temple text-lg font-semibold text-amber-100 sm:text-xl">Đi Chùa Online</span>
      </a>

      <nav className="hidden items-center gap-7 text-sm text-stone-400 md:flex" aria-label="Điều hướng chính">
        <a href="#chanh-dien" className="transition hover:text-amber-200">Chánh điện</a>
        <a href="#gui-loi-nguyen" className="transition hover:text-amber-200">Gửi lời nguyện</a>
        <a href="#huong-dan" className="transition hover:text-amber-200">Hướng dẫn</a>
      </nav>

      <button
        type="button"
        onClick={onToggleBgm}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:px-4 ${
          isBgmPlaying
            ? 'border-amber-300/40 bg-amber-300 text-stone-950'
            : 'border-amber-100/15 bg-white/5 text-stone-300 hover:border-amber-300/30 hover:text-amber-200'
        }`}
        aria-pressed={isBgmPlaying}
      >
        {isBgmPlaying ? <Music2 size={15} /> : <VolumeX size={15} />}
        <span className="hidden sm:inline">{isBgmPlaying ? 'Đang phát nhạc' : 'Bật nhạc thiền'}</span>
        <span className="sm:hidden">Nhạc</span>
      </button>
    </div>
  </header>
);
