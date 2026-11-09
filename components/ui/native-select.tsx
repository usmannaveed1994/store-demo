import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Styled native `<select>`.
 *
 * Kept native on purpose: the admin lists and forms post without client
 * JavaScript, and the platform already renders a listbox well on every device.
 * Named `NativeSelect` so the shadcn `select` slot (Radix) stays free.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
