"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * shadcn/ui toast host.
 *
 * `theme="system"` matches `app/globals.css`, which flips its tokens on
 * `prefers-color-scheme` rather than a class, so no theme provider is involved.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-border group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:border-destructive/40",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
