import type { Metadata } from "next";
import Link from "next/link";

import { buildPageMetadata } from "@/lib/metadata";

import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of service",
  description:
    "The terms that apply when you browse Diecast 64, place an order or use your account.",
  path: "/terms",
});

const LAST_UPDATED = "November 3, 2026";

/**
 * Static terms of service. The shell lives in `LegalPage`; this file is content.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      lastUpdated={LAST_UPDATED}
      intro="These terms apply whenever you browse the store, place an order or use your account. By shopping with us you agree to them."
      contactPrompt="Questions about these terms?"
      sections={[
        {
          heading: "Using the store",
          body: (
            <>
              You agree to use Diecast 64 for lawful, personal shopping and not to
              interfere with the store or its security. See our{" "}
              <Link
                href="/privacy"
                className="font-medium text-foreground underline underline-offset-4"
              >
                privacy policy
              </Link>{" "}
              for how we handle your data.
            </>
          ),
        },
        {
          heading: "Orders and pricing",
          body: "An order is an offer to buy and is only accepted once we confirm it and take payment. Prices are shown in US dollars and may change without notice. If a listing or price is clearly wrong we may cancel the order and refund you in full.",
        },
        {
          heading: "Payments",
          body: "Payments are handled by our payment provider, and card details never reach our servers. Orders are dispatched only after payment has cleared.",
        },
        {
          heading: "Shipping and delivery",
          body: "Delivery estimates are not guarantees and can be affected by carriers and customs. Risk in the goods passes to you on delivery.",
        },
        {
          heading: "Returns",
          body: "If an item arrives damaged, faulty or is not what you ordered, contact us within 14 days of delivery and we will arrange a replacement or refund. Opened collectibles cannot be returned unless they are faulty.",
        },
        {
          heading: "Accounts",
          body: "You are responsible for keeping your sign-in details secure and for activity on your account. Tell us straight away if you think someone else has used it.",
        },
        {
          heading: "Intellectual property",
          body: "The store's content, photography and branding belong to us or our licensors. Manufacturer names and marks remain the property of their respective owners.",
        },
        {
          heading: "Liability",
          body: "The store is provided as it is. To the extent the law allows, our liability for an order is limited to the amount you paid for it, and we are not liable for indirect losses.",
        },
        {
          heading: "Changes to these terms",
          body: "We may update these terms from time to time. The version published here when you place an order is the version that applies to it.",
        },
      ]}
    />
  );
}
