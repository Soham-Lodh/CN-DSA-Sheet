function Block({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-surface-elevated/80 ${className}`} />;
}

function LoadingLabel({ children = "Loading page content" }: { children?: string }) {
  return <p role="status" aria-live="polite" className="sr-only">{children}</p>;
}

export function DashboardSkeleton() {
  return <div className="space-y-6"><LoadingLabel />
    <Block className="h-28 w-full" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"><Block className="h-28" /><Block className="h-28" /><Block className="h-28" /></div>
    <div className="space-y-4"><Block className="h-6 w-64" /><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Block className="h-44" /><Block className="h-44" /></div></div>
    <Block className="h-72 w-full" />
  </div>;
}

export function LeaderboardSkeleton() {
  return <div className="space-y-6"><LoadingLabel />
    <Block className="h-12 w-72" /><Block className="h-56 w-full" />
    <div className="rounded-2xl border border-outline-subtle bg-surface-card p-5 space-y-3"><Block className="h-10 w-full" /><Block className="h-10 w-full" /><Block className="h-10 w-full" /><Block className="h-10 w-full" /></div>
  </div>;
}

export function ProfileSkeleton() {
  return <div className="space-y-6"><LoadingLabel />
    <Block className="h-48 w-full" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Block className="h-24" /><Block className="h-24" /><Block className="h-24" /></div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Block className="h-64" /><Block className="h-64" /></div><Block className="h-64 w-full" />
  </div>;
}

export function SheetsSkeleton({ detail = false }: { detail?: boolean }) {
  return <div className="space-y-6"><LoadingLabel />
    <Block className="h-16 w-full" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Block className="h-24" /><Block className="h-24" /><Block className="h-24" /></div>
    <div className="rounded-2xl border border-outline-subtle bg-surface-card p-5 space-y-3"><Block className="h-8 w-72" />{Array.from({ length: detail ? 7 : 5 }, (_, index) => <Block key={index} className="h-12 w-full" />)}</div>
  </div>;
}

export function AdminSkeleton() {
  return <div className="space-y-6"><LoadingLabel />
    <Block className="h-16 w-full" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Block className="h-24" /><Block className="h-24" /><Block className="h-24" /><Block className="h-24" /></div><Block className="h-[30rem] w-full" />
  </div>;
}
