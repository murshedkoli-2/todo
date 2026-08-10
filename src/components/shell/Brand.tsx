import Image from "next/image";

interface BrandProps {
  /** Hide the wordmark, e.g. in tight mobile headers. */
  compact?: boolean;
  className?: string;
}

export default function Brand({ compact = false, className = "" }: BrandProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className="relative w-8 h-8 flex-shrink-0">
        <Image src="/logo.png" alt="" fill sizes="32px" className="object-contain" priority />
      </div>
      {!compact && (
        <span
          className="text-[17px] font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Task<span style={{ color: "var(--accent)" }}>Flow</span>
        </span>
      )}
    </div>
  );
}
