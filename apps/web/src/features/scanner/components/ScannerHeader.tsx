export function ScannerHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 py-3 backdrop-blur">
      <nav aria-label="Navigation principale" className="flex items-center justify-between gap-4">
        <a href="#scanner" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
          <span className="flex size-10 shrink-0 items-center justify-center p-1">
            <img src="/straw-hat-logo.png" alt="" className="size-full object-contain" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-semibold text-slate-900">OP Card Scan</span>
            <span className="block truncate text-xs text-slate-500">Identification et cote</span>
          </span>
        </a>

        <div className="flex items-center gap-1 text-sm font-medium">
          <a href="#scanner" aria-current="page" className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700 transition hover:bg-blue-100">
            Scanner
          </a>
          <a href="#manual-search" className="rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
            Recherche
          </a>
        </div>
      </nav>
    </header>
  );
}
