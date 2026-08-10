/**
 * Route-level loading placeholders.
 *
 * These mirror the real layout's geometry so the page does not reflow when
 * content arrives — a spinner in the middle of an empty page shifts everything
 * once, which reads as a flash.
 */

export function ToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-7">
      <div className="skeleton h-10 w-40 rounded-well" />
      <div className="flex-1" />
      <div className="skeleton h-10 w-full lg:w-64 rounded-control" />
      <div className="skeleton h-10 w-32 rounded-control" />
    </div>
  );
}

export function StatRowSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-7">
      {hero && <div className="skeleton h-36 lg:col-span-1 rounded-panel" />}
      <div
        className={`grid grid-cols-2 gap-3 sm:gap-4 ${
          hero ? "lg:col-span-2" : "lg:col-span-3 lg:grid-cols-4"
        }`}
      >
        {[0, 1, 2, 3].map((cell) => (
          <div key={cell} className="skeleton h-36 rounded-card" />
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton h-52 rounded-card" />
      ))}
    </div>
  );
}

export function StatementSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="statement">
      <div className="statement-head">
        <div className="skeleton h-3 w-20" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="statement-row">
          <div className="skeleton w-9 h-9 rounded-well flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-1/5" />
          </div>
          <div className="skeleton h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
