import { LogOut } from 'lucide-react';

type Props = {
  activePage: 'scanner' | 'portfolio';
  email: string;
  nickname: string | null;
  avatar: string | null;
  loggingOut: boolean;
  onLogout: () => void;
};

export function AppHeader({ activePage, email, nickname, avatar, loggingOut, onLogout }: Props) {
  return (
    <header data-app-header className="sticky top-0 z-20 border-b border-stone-300 bg-[#f3f1ec] py-3">
      <nav aria-label="Navigation principale" className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 md:flex md:justify-between md:gap-4">
        <a href="#scanner" aria-label="HakiScan — Scanner" className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f2430]">
          <span className="flex size-12 shrink-0 items-center justify-center">
            <img src="/hakiscan-logo.png" alt="" className="size-full object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold tracking-tight text-stone-950">HakiScan</span>
          </span>
        </a>

          <div className="col-span-2 row-start-2 grid grid-cols-2 gap-1 text-sm font-medium md:flex md:items-center">
          <NavLink href="#scanner" active={activePage === 'scanner'}>Scanner</NavLink>
          <NavLink href="#portfolio" active={activePage === 'portfolio'}>Ma collection</NavLink>
          </div>
          <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-1">
          <div className="flex min-w-0 items-center gap-2" title={nickname || email}>
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#8f2430]/10 text-xs font-semibold text-[#8f2430]" aria-label={`Profil de ${nickname || email}`}>
              {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : (nickname || email).slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden max-w-32 truncate text-xs font-medium text-stone-600 lg:block">{nickname || email}</span>
          </div>
          <button type="button" onClick={onLogout} disabled={loggingOut} aria-label="Se déconnecter" title="Se déconnecter"
            className="ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-sm text-stone-500 hover:bg-stone-200/70 hover:text-stone-900 disabled:opacity-50">
            <LogOut className="size-4" aria-hidden="true" />
          </button>
          </div>
      </nav>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={active
        ? 'flex min-h-11 items-center justify-center whitespace-nowrap border-b-2 border-[#8f2430] px-3 py-2 text-stone-950'
        : 'flex min-h-11 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-stone-600 transition hover:border-stone-400 hover:text-stone-950'}
    >
      {children}
    </a>
  );
}
