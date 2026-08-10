import { StatRowSkeleton, StatementSkeleton, ToolbarSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ToolbarSkeleton />
        <StatRowSkeleton hero />
        <StatementSkeleton />
      </div>
    </div>
  );
}
