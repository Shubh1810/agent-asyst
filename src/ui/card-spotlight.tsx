"use client";

import { useMotionValue, motion, useMotionTemplate } from "framer-motion";
import React, { MouseEvent as ReactMouseEvent, useState } from "react";
import { CanvasRevealEffect } from "./canvas-reveal-effect";
import { cn } from "../lib/utilts";

export const CardSpotlight = ({
  children,
  radius = 350,
  color = "#262626",
  className,
  variant = "default",
  ...props
}: {
  radius?: number;
  color?: string;
  children: React.ReactNode;
  variant?: "default" | "automation";
} & React.HTMLAttributes<HTMLDivElement>) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({
    currentTarget,
    clientX,
    clientY,
  }: ReactMouseEvent<HTMLDivElement>) {
    let { left, top } = currentTarget.getBoundingClientRect();

    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const [isHovering, setIsHovering] = useState(false);
  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  const getColors = () => {
    if (variant === "automation") {
      return [
        [225, 29, 72], // rose-600
        [190, 18, 60], // rose-700
      ];
    }
    return [
      [59, 130, 246],  // blue-500
      [139, 92, 246],  // purple-500
    ];
  };

  return (
    <div
      className={cn(
        "group/spotlight relative border border-neutral-800 bg-black dark:border-neutral-800 transform-none",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ transform: 'none' }}
      {...props}
    >
      <motion.div
        className="pointer-events-none absolute z-0 -inset-px rounded-[inherit] opacity-0 transition duration-300 group-hover/spotlight:opacity-100"
        style={{
          backgroundColor: variant === "automation" ? "rgba(159, 18, 57, 0.1)" : color,
          transform: 'none',
          maskImage: useMotionTemplate`
            radial-gradient(
              ${radius}px circle at ${mouseX}px ${mouseY}px,
              white,
              transparent 80%
            )
          `,
        }}
      >
        {isHovering && (
          <CanvasRevealEffect
            animationSpeed={5}
            containerClassName="bg-transparent absolute inset-0 pointer-events-none transform-none"
            colors={getColors()}
            dotSize={3}
          />
        )}
      </motion.div>
      {children}
    </div>
  );
};
