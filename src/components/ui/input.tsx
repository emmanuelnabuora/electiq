import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light placeholder:text-neutral focus:border-accent",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
