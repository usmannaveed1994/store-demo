import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";

/**
 * The shop chrome.
 *
 * Kept out of the root layout so `/admin` can render a sidebar instead of the
 * storefront header. The route group leaves every public URL unchanged.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense>
        <SiteHeader />
      </Suspense>
      {children}
    </>
  );
}
