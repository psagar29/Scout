"use client";

import { useEffect, useRef } from "react";

export function ScoutMark({ size = "xl" }: { size?: "sm" | "lg" | "xl" }) {
  const dim = size === "sm" ? 36 : size === "lg" ? 56 : 80;
  const radius = size === "sm" ? "12px" : size === "lg" ? "18px" : "24px";
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rings = svg.querySelectorAll<SVGCircleElement>(".spin-ring");
    const angles = [0, 0];
    const speeds = [0.3, -0.2];
    let raf: number;
    function tick() {
      rings.forEach((ring, i) => {
        angles[i] += speeds[i];
        ring.style.transform = `rotate(${angles[i]}deg)`;
        ring.style.transformOrigin = "40px 40px";
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: dim,
        height: dim,
        borderRadius: radius,
        background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
        border: "1px solid var(--border-mid)",
        boxShadow: "var(--shadow-md), 0 0 40px rgba(16, 185, 129, 0.06)",
      }}
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        viewBox="0 0 80 80"
        className="h-[80%] w-[80%]"
        fill="none"
      >
        {/* outer ring — slow clockwise */}
        <circle
          className="spin-ring"
          cx="40"
          cy="40"
          r="30"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="8 6"
        />

        {/* mid ring — slow counter-clockwise */}
        <circle
          className="spin-ring"
          cx="40"
          cy="40"
          r="22"
          stroke="rgba(16,185,129,0.2)"
          strokeWidth="1"
          strokeDasharray="5 8"
        />

        {/* static inner circle */}
        <circle
          cx="40"
          cy="40"
          r="14"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.75"
        />

        {/* sweep arc — emerald */}
        <path
          d="M40 12 A28 28 0 0 1 66 32"
          stroke="rgba(16,185,129,0.7)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* sweep arc — white */}
        <path
          d="M18 52 A28 28 0 0 0 44 68"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* center dot */}
        <circle cx="40" cy="40" r="3.5" fill="rgba(16,185,129,0.9)" />
        <circle cx="40" cy="40" r="6" fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="1" />
      </svg>
    </div>
  );
}
