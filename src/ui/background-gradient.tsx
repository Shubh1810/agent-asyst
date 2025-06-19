import { cn } from "../lib/utilts";
import React from "react";
import { motion } from "framer-motion";

type GradientPreset = 'default' | 'settings' | 'automation' | 'chat';

const GRADIENT_PRESETS: Record<GradientPreset, string> = {
  default: "bg-[linear-gradient(to_bottom,#000000_0%,#1a0b1a_40%,#2d1b3d_70%,#3d1a3d_85%,#000000_95%,#000000_100%)]",
  settings: "bg-[radial-gradient(circle_farthest-side_at_0_100%,#059669,transparent_70%),radial-gradient(circle_farthest-side_at_100%_0,#10B981,transparent_70%),radial-gradient(circle_farthest-side_at_100%_100%,#34D399,transparent_70%),radial-gradient(circle_farthest-side_at_0_0,#047857,#141316)]",
  automation: "bg-[radial-gradient(circle_farthest-side_at_0_100%,#9f1239,transparent_60%),radial-gradient(circle_farthest-side_at_100%_0,#be123c,transparent_70%),radial-gradient(circle_farthest-side_at_100%_100%,#4c0519,transparent_60%),radial-gradient(circle_farthest-side_at_0_0,#9f1239,#09090b)]",
  chat: "bg-[radial-gradient(circle_farthest-side_at_0_100%,#2563EB,transparent_70%),radial-gradient(circle_farthest-side_at_100%_0,#3B82F6,transparent_70%),radial-gradient(circle_farthest-side_at_100%_100%,#60A5FA,transparent_70%),radial-gradient(circle_farthest-side_at_0_0,#1D4ED8,#141316)]"
};

export const BackgroundGradient = ({
  children,
  className,
  containerClassName,
  animate = true,
  style,
  preset = 'default'
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
  style?: React.CSSProperties;
  preset?: GradientPreset;
}) => {
  const variants = {
    initial: {
      backgroundPosition: "0 50%",
    },
    animate: {
      backgroundPosition: ["0, 50%", "100% 50%", "0 50%"],
    },
  };
  return (
    <div className={cn("relative p-[3px]", containerClassName)}>
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? "initial" : undefined}
        animate={animate ? "animate" : undefined}
        transition={
          animate
            ? {
                duration: 5,
                repeat: Infinity,
                repeatType: "reverse",
              }
            : undefined
        }
        style={{
          backgroundSize: animate ? "400% 400%" : undefined,
        }}
        className={cn(
          "absolute inset-0 rounded-3xl z-[1]",
          GRADIENT_PRESETS[preset]
        )}
      />
      <div 
        className={cn(
          "relative z-10 rounded-[20px]",
          "bg-black/80 backdrop-blur-md",
          className
        )}
        style={style}
      >
        {children}
      </div>
    </div>
  );
};
