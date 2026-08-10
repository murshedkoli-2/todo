import {
  CardGridSkeleton, StatRowSkeleton, ToolbarSkeleton,
} from "@/components/ui/Skeletons";

/**
 * Shown while the tasks page streams. Every page previously rendered nothing
 * until its server component resolved, so a slow query looked like a hang.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ToolbarSkeleton />
        <StatRowSkeleton hero />
        <CardGridSkeleton />
      </div>
    </div>
  );
}
