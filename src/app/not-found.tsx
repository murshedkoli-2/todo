import Link from "next/link";
import { SearchIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="panel max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-well flex items-center justify-center mx-auto mb-5 bg-sunken text-ink-muted">
          <SearchIcon className="w-7 h-7" />
        </div>

        <p className="text-eyebrow mb-2">Error 404</p>
        <h1 className="text-section mb-2">Page not found</h1>
        <p className="text-sm leading-relaxed mb-6 text-ink-secondary">
          That page does not exist, or it was removed.
        </p>

        <Link href="/" className="btn-primary px-6">
          Back to tasks
        </Link>
      </div>
    </div>
  );
}
