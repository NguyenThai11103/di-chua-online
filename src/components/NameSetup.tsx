import { useState, type FormEvent } from 'react';
import { ArrowRight, UserRound } from 'lucide-react';

interface NameSetupProps {
  initialName?: string;
  onSave: (name: string) => void;
}

export const NameSetup = ({ initialName = '', onSave }: NameSetupProps) => {
  const [name, setName] = useState(initialName);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSave(name);
  };

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center bg-[#080403]/88 p-4 backdrop-blur-md">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-amber-200/20 bg-[#17100c] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.6)] sm:p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-amber-300/10 text-amber-300">
          <UserRound size={22} />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Thiết lập một lần</p>
        <h2 className="mt-2 font-temple text-3xl font-semibold text-amber-50">Bạn muốn được gọi là gì?</h2>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          Tên này sẽ hiển thị trên nhân vật của bạn và tự động dùng cho chat, lời nguyện, dâng hương.
        </p>
        <label className="mt-6 block">
          <span className="mb-2 block text-xs font-semibold text-stone-400">Tên hiển thị</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={36}
            autoFocus
            placeholder="Ví dụ: Minh An"
            className="w-full rounded-xl border border-amber-100/15 bg-black/25 px-4 py-3.5 text-sm text-white outline-none placeholder:text-stone-600 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/10"
          />
        </label>
        <button
          type="submit"
          disabled={!name.trim()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3.5 text-sm font-bold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Vào chánh điện <ArrowRight size={16} />
        </button>
        <p className="mt-3 text-center text-[11px] text-stone-600">Tên được lưu trên thiết bị này và có thể đổi lại sau.</p>
      </form>
    </div>
  );
};
