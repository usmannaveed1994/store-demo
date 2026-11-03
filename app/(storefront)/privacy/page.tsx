import type { Metadata } from "next";

import { buildPageMetadata } from "@/lib/metadata";

import { LegalPage } from "../_components/legal-page";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy policy",
  description:
    "How Diecast 64 collects, uses and protects the information you share when you shop our 1:64 collections.",
  path: "/privacy",
});

const LAST_UPDATED = "November 3, 2026";

/**
 * Static privacy policy. The shell lives in `LegalPage`; this file is content.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      lastUpdated={LAST_UPDATED}
      intro="This policy explains what we collect when you shop with Diecast 64, why we collect it, and the choices you have."
      contactPrompt="Questions about this policy?"
      sections={[
        {
          heading: "Information we collect",
          body: "We only collect what we need to process an order and keep your account working.",
          items: [
            "Account details such as your name and email address, handled through our authentication provider.",
            "Order details including the items you buy, the delivery address and your order history.",
            "Basic usage data, such as the pages you visit, used to understand how the store performs.",
          ],
        },
        {
          heading: "How we use your information",
          body: "Your information is used to fulfil orders, provide support, prevent fraud and improve the store. We do not sell your personal data.",
        },
        {
          heading: "Payments",
          body: "Card payments are processed by our payment provider. Full card numbers never reach our servers, and we only store the references needed to match a payment to your order.",
        },
        {
          heading: "Cookies",
          body: "We use strictly necessary cookies to keep your cart and session working, plus limited analytics cookies to measure traffic. You can block cookies in your browser, though the cart and checkout will stop working without them.",
        },
        {
          heading: "Sharing",
          body: "We share data only with the service providers that run the store — hosting, authentication, payments and image delivery — and only to the extent each one needs it. We may also disclose information where the law requires it.",
        },
        {
          heading: "Retention and your rights",
          body: "Order records are kept for as long as needed for accounting and tax purposes. You can request access to, correction of, or deletion of your personal data at any time.",
        },
      ]}
    />
  );
}

