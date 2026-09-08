import { LogOut } from 'lucide-react';

type Props = {
  activePage: 'scanner' | 'portfolio';
  email: string;
  loggingOut: boolean;
  onLogout: () => void;
};

export function AppHeader({ activePage, email, loggingOut, onLogout }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 py-3 backdrop-blur">
      <nav aria-label="Navigation principale" className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <a href="#scanner" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
          <span className="flex size-10 shrink-0 items-center justify-center p-1">
            <img src="/straw-hat-logo.png" alt="" className="size-full object-contain" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-semibold text-slate-900">OP Card Scan</span>
            <span className="block truncate text-xs text-slate-500">Identification et cote</span>
          </span>
        </a>

        <div className="flex items-center gap-1 text-sm font-medium">
          <NavLink href="#scanner" active={activePage === 'scanner'}>Scanner</NavLink>
          <NavLink href="#portfolio" active={activePage === 'portfolio'}>Ma collection</NavLink>
          <span className="ml-3 hidden max-w-40 truncate text-xs text-slate-500 lg:block" title={email}>{email}</span>
          <button type="button" onClick={onLogout} disabled={loggingOut} aria-label="Se déconnecter" title="Se déconnecter"
            className="ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50">
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
        ? 'rounded-lg bg-blue-50 px-3 py-2 text-blue-700'
        : 'rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'}
    >
      {children}
    </a>
  );
}
