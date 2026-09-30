"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "./ProgressBar";

type DashboardSheetProgress = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  totalQuestions: number;
  solvedQuestions: number;
  completionPercent: number;
};

export function SheetsCarousel({
  sheets,
}: {
  sheets: DashboardSheetProgress[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateControls = () => {
    const track = trackRef.current;
    if (!track) return;

    setCanScrollLeft(track.scrollLeft > 1);
    setCanScrollRight(
      track.scrollLeft + track.clientWidth < track.scrollWidth - 1,
    );
  };

  useEffect(() => {
    updateControls();
    window.addEventListener("resize", updateControls);
    return () => window.removeEventListener("resize", updateControls);
  }, []);

  const move = (direction: "previous" | "next") => {
    const track = trackRef.current;
    if (!track) return;

    const distance = Math.max(track.clientWidth * 0.8, 320);
    track.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative group/carousel overflow-hidden">
      <button
        type="button"
        onClick={() => move("previous")}
        disabled={!canScrollLeft}
        aria-label="Show previous sheets"
        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 p-2 rounded-full border border-outline-subtle bg-surface-base/95 text-content-primary shadow-lg transition hover:bg-brand-primary disabled:pointer-events-none disabled:opacity-0 focus-visible:opacity-100"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div
        ref={trackRef}
        onScroll={updateControls}
        className="flex gap-6 overflow-x-auto scrollbar-hidden snap-x snap-mandatory py-1"
      >
        {sheets.map((sheet, index) => {
          const isFirst = index % 2 === 0;

          return (
            <Link
              key={sheet.id}
              href={`/sheets/${sheet.slug}`}
              className="glass-card glass-card-hover w-[min(20rem,calc(100vw-3rem))] shrink-0 snap-start p-5 rounded-2xl space-y-4 block group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm border ${
                      isFirst
                        ? "bg-brand-primary/10 border-brand-primary/30 text-brand-accent"
                        : "bg-status-info/10 border-status-info/30 text-status-info"
                    }`}
                  >
                    {sheet.totalQuestions}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-content-primary group-hover:text-brand-accent transition truncate">
                      {sheet.name}
                    </h3>
                    <p className="text-xs text-content-muted line-clamp-1">
                      {sheet.description ||
                        "Curated interview preparation problem set"}
                    </p>
                  </div>
                </div>
                <span className="ml-3 shrink-0 text-sm font-bold text-content-primary">
                  {sheet.solvedQuestions} / {sheet.totalQuestions}
                </span>
              </div>

              <ProgressBar percent={sheet.completionPercent} />

              <div className="flex items-center justify-between text-xs text-content-muted pt-1">
                <span>Automated LeetCode Verification</span>
                <span className="font-bold text-content-primary">
                  {sheet.completionPercent}% Done
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => move("next")}
        disabled={!canScrollRight}
        aria-label="Show next sheets"
        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-2 rounded-full border border-outline-subtle bg-surface-base/95 text-content-primary shadow-lg transition hover:bg-brand-primary disabled:pointer-events-none disabled:opacity-0 focus-visible:opacity-100"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
