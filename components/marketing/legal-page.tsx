import { AlertTriangle } from "lucide-react";

import { Section } from "@/components/marketing/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

/**
 * Renders a legal/policy page with the mandatory DRAFT banner. All copy here is
 * placeholder structure only — it MUST be replaced with attorney-reviewed text
 * before launch.
 */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string;
  lastUpdated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <Section className="pt-12 sm:pt-16">
      <div className="mx-auto max-w-3xl">
        <Alert variant="destructive" className="mb-8">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>DRAFT — not legal advice</AlertTitle>
          <AlertDescription>
            This is placeholder text. Replace with attorney-reviewed copy before
            launch.
          </AlertDescription>
        </Alert>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Last updated: {lastUpdated}
        </p>

        {intro ? (
          <p className="text-muted-foreground mt-6 text-pretty">{intro}</p>
        ) : null}

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold tracking-tight">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-muted-foreground text-sm text-pretty"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Section>
  );
}
