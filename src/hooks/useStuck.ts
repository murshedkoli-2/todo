"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Whether a sticky element has actually stuck to its offset.
 *
 * CSS can pin an element but cannot style it differently once pinned, and a
 * toolbar that carries its hairline and its lift at rest draws a rule across a
 * page that has not been scrolled — chrome pretending to be an edge that is not
 * there yet.
 *
 * Watched through an IntersectionObserver on a zero-height sentinel placed just
 * above the element rather than through a scroll listener: the observer fires
 * twice per page (on and off), where a scroll handler fires on every frame of
 * every scroll to answer the same yes-or-no question.
 *
 * Returns the sentinel ref and the state. Render the sentinel immediately
 * before the sticky element, in the same scrolling ancestor.
 */
export function useStuck(topOffset = 0): {
  sentinelRef: React.RefObject<HTMLDivElement>;
  stuck: boolean;
} {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    /* The sentinel is "gone" once it passes above the line the toolbar sticks
       to, which is the moment the toolbar takes over that space. The negative
       top margin moves the observer's viewport edge down to exactly that line. */
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: `-${topOffset}px 0px 0px 0px`, threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [topOffset]);

  return { sentinelRef, stuck };
}
