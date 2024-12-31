import { cn } from "../lib/utilts";
import React from "react";
import { motion } from "framer-motion";

export const BackgroundGradient = ({
  children,
  className,
  containerClassName,
  animate = true,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
  style?: React.CSSProperties;
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
          "bg-[radial-gradient(circle_farthest-side_at_0_100%,#2B4BF2,transparent_70%),radial-gradient(circle_farthest-side_at_100%_0,#A855F7,transparent_70%),radial-gradient(circle_farthest-side_at_100%_100%,#3B82F6,transparent_70%),radial-gradient(circle_farthest-side_at_0_0,#2563EB,#141316)]"
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
