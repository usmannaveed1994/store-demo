"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Client-side cache for the storefront.
 *
 * React context is unavailable in Server Components, so this is the boundary
 * that has to be a client component. It takes `children` as a prop and hands
 * them straight through, which is what keeps every page *below* it a Server
 * Component — nothing here pulls the rest of the tree into the browser.
 *
 * The lazy `useState` is not a micro-optimisation: a client built at module
 * scope would be shared by every request a server process handles, so one
 * visitor's cached catalogue could be handed to another. One client per
 * mounted tree means one client per browser tab.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The catalogue changes on admin time, not page time. A minute of
            // reuse keeps remounts and focus changes from re-hitting the API,
            // while new products still show up without a hard refresh.
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
