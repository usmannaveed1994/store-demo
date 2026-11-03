import type { ReactNode } from "react";

/** Single source of truth for the support address shown on the legal pages. */
export const SUPPORT_EMAIL = "support@diecast64.com";

type LegalSection = {
  heading: string;
  body: ReactNode;
  items?: string[];
};

type LegalPageProps = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
  contactPrompt: string;
};

/**
 * Shared shell for the static legal pages (`/privacy`, `/terms`).
 *
 * Both pages are pure content, so this stays a server component with no data
 * access and no client JavaScript.
 */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
  contactPrompt,
}: LegalPageProps) {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
          Legal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {lastUpdated}</p>

        <p className="mt-8 max-w-xl text-pretty text-muted-foreground">{intro}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {section.heading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {section.body}
              </p>
              {section.items ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Contact
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {contactPrompt} Email us at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
