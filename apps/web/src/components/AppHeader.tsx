import { LogOut } from 'lucide-react';

type Props = {
  activePage: 'scanner' | 'portfolio';
  email: string;
  loggingOut: boolean;
  onLogout: () => void;
};

export function AppHeader({ activePage, email, loggingOut, onLogout }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-300 bg-[#f3f1ec] py-3">
      <nav aria-label="Navigation principale" className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <a href="#scanner" className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f2430]">
          <span className="flex size-12 shrink-0 items-center justify-center">
            <img src="/hakiscan-logo.png" alt="" className="size-full object-contain" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-base font-semibold tracking-tight text-stone-950">HakiScan</span>
          </span>
        </a>

        <div className="flex items-center gap-1 text-sm font-medium">
          <NavLink href="#scanner" active={activePage === 'scanner'}>Scanner</NavLink>
          <NavLink href="#portfolio" active={activePage === 'portfolio'}>Ma collection</NavLink>
          <span className="ml-3 hidden max-w-40 truncate text-xs text-stone-500 lg:block" title={email}>{email}</span>
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
        ? 'border-b-2 border-[#8f2430] px-3 py-2 text-stone-950'
        : 'border-b-2 border-transparent px-3 py-2 text-stone-600 transition hover:border-stone-400 hover:text-stone-950'}
    >
      {children}
    </a>
  );
}
