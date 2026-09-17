"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createStoryScene, type StoryScene as SceneHandle } from "@/lib/story-scene";

const COURSE_CHIPS = ["ENG4U", "MHF4U", "MCV4U", "SCH4U", "SBI4U", "SPH4U", "MDM4U", "ICS4U"];

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void): () => void {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function StoryScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Server snapshot is false (cinematic markup), the client's real preference
  // takes over right after hydration.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
  const [webglFailed, setWebglFailed] = useState(false);
  const cinematic = !reducedMotion && !webglFailed;

  useEffect(() => {
    if (!cinematic) return;
    if (!canvasRef.current || !scrollRef.current || !overlayRef.current) return;
    let scene: SceneHandle | null = null;
    try {
      scene = createStoryScene({
        THREE,
        gsap,
        ScrollTrigger,
        canvas: canvasRef.current,
        scrollEl: scrollRef.current,
        overlayRoot: overlayRef.current,
      });
    } catch {
      // No WebGL — swap to readable content once this render settles.
      queueMicrotask(() => setWebglFailed(true));
    }
    return () => scene?.destroy();
  }, [cinematic]);

  if (!cinematic) {
    return (
      <div className="story-static mx-auto max-w-[40rem] px-4 py-16 text-slate-100">
        <h1 className="text-3xl font-bold">Where can you get in?</h1>
        <p className="mt-4 text-slate-300">
          Enter your average once. AdmitPath labels every program at 88 Canadian universities Safe,
          Target, Reach, or Unlikely — with the exact gap to the next label and how to close it.
        </p>
        <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-blue-500 px-6 font-semibold text-white">
          Start your search
        </Link>
      </div>
    );
  }

  return (
    <div className="story-root">
      <canvas ref={canvasRef} className="story-canvas" aria-hidden="true" />

      <div ref={overlayRef} className="story-overlay">
        <section className="act" data-act="0">
          <p className="eyebrow">AdmitPath</p>
          <h1>Where can you get in?</h1>
          <p className="sub">Scroll to find out.</p>
        </section>

        <section className="act" data-act="1">
          <h2>Start with your average.</h2>
          <p className="counter" data-counter>
            65%
          </p>
          <div className="chips">
            {COURSE_CHIPS.map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
        </section>

        <section className="act act-high" data-act="2">
          <h2>Every university in Canada.</h2>
          <p className="sub">88 universities. 544 programs. One search.</p>
        </section>

        <section className="act act-high" data-act="3">
          <h2>Every program, labeled.</h2>
          <p className="sub">Safe · Target · Reach · Unlikely — computed from your grades, honestly.</p>
        </section>

        <section className="act" data-act="4">
          <h2>Find your path.</h2>
          <Link href="/" className="cta">
            Start your search
          </Link>
        </section>
      </div>

      {/* The scroll driver: its height is the film's runtime. */}
      <div ref={scrollRef} className="story-scroll" />
    </div>
  );
}
