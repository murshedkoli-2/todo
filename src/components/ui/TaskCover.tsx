import React from "react";
import Image from "next/image";
import type { TaskService } from "@/lib/serviceCatalogue";
import { SERVICE_COLORS, SERVICE_SHORT_LABELS } from "@/lib/types";
import { ServiceIcon } from "@/components/ui/ServiceIcon";

/**
 * Cover shown on tasks with no uploaded feature image and no services.
 */
export const DEFAULT_TASK_COVER = "/task-cover-default.png";

interface TaskCoverProps {
  /** The task's feature image. When absent, the service default cover is used. */
  src?: string | null;
  /** Services on this task. Used to construct service-based covers when `src` is absent. */
  services?: readonly TaskService[];
  /** Passed to `next/image`; defaults to the task-grid layout. */
  sizes?: string;
  /** Set on an above-the-fold cover so it is not lazy-loaded. */
  priority?: boolean;
  className?: string;
}

const GRID_SIZES = "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw";

/**
 * Composite cover rendered when a task has multiple subtasks/services
 * and no custom uploaded cover. Showcases each subtask's icon, color, and name.
 */
function MultiServiceCover({ services }: { services: readonly TaskService[] }) {
  // Deduplicate while maintaining order
  const uniqueServices = Array.from(new Set(services));
  const count = uniqueServices.length;

  // Grid layout depending on count
  const gridClass =
    count === 2
      ? "grid-cols-2"
      : count === 3
      ? "grid-cols-3"
      : count === 4
      ? "grid-cols-2 grid-rows-2"
      : "grid-cols-3 grid-rows-2";

  const displayList = uniqueServices.slice(0, 6);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      data-testid="multi-service-cover"
    >
      <div
        className={`absolute inset-0 grid ${gridClass} w-full h-full transition-transform duration-500 group-hover:scale-[1.03]`}
      >
        {displayList.map((service, index) => {
          const color = SERVICE_COLORS[service] ?? "var(--accent)";
          const shortLabel = SERVICE_SHORT_LABELS[service] ?? service;

          return (
            <div
              key={service}
              className="relative flex flex-col items-center justify-center p-2 overflow-hidden border-r border-b border-white/10 last:border-r-0"
              style={{
                background: `linear-gradient(${135 + index * 45}deg, color-mix(in srgb, ${color} 36%, #0b0e1f) 0%, color-mix(in srgb, ${color} 16%, #0b0e1f) 100%)`,
              }}
            >
              {/* Background ambient watermark icon */}
              <ServiceIcon
                service={service}
                className="absolute -right-2 -bottom-2 w-16 h-16 sm:w-20 sm:h-20 opacity-15 pointer-events-none"
                style={{ color }}
              />

              {/* Foreground service emblem */}
              <div className="relative z-10 flex flex-col items-center gap-1 text-center max-w-full px-1">
                <div
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shadow-md border backdrop-blur-md transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background: `color-mix(in srgb, ${color} 24%, rgba(255,255,255,0.08))`,
                    borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
                    color: "#ffffff",
                  }}
                >
                  <ServiceIcon
                    service={service}
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    style={{ color }}
                  />
                </div>

                <span
                  className="text-[10px] sm:text-[11px] font-bold text-white/95 tracking-tight truncate max-w-full px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-sm border border-white/5"
                  title={shortLabel}
                >
                  {shortLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtle dot pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* Counter pill at top-right */}
      <div className="absolute top-2 right-2 z-20 pointer-events-none">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/50 text-white/90 backdrop-blur-md border border-white/15 shadow-sm">
          {count} services
        </span>
      </div>
    </div>
  );
}

export default function TaskCover({
  src,
  services,
  sizes = GRID_SIZES,
  priority = false,
  className = "",
}: TaskCoverProps) {
  // If user uploaded a custom feature image, use it
  if (src) {
    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
    );
  }

  // If there are multiple subtasks/services, render composite multi-service cover
  if (services && services.length > 1) {
    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <MultiServiceCover services={services} />
      </div>
    );
  }

  // If exactly one service, use that service's dedicated feature image
  if (services && services.length === 1) {
    const serviceCoverSrc = `/services/${services[0]}.svg`;
    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <Image
          src={serviceCoverSrc}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          unoptimized
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
    );
  }

  // Fallback to Aurora brand default cover
  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <Image
        src={DEFAULT_TASK_COVER}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
    </div>
  );
}
