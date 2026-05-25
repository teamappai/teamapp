import Link from "next/link";

import { cn } from "@/lib/utils/index";
import { Button } from "@/components/ui/button";

/** Vertically padded, horizontally centered content band used across pages. */
export function Section({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn("py-16 sm:py-20", className)} {...props}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

/** Centered eyebrow + heading + lead used to introduce a section. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      {eyebrow ? (
        <p className="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="text-muted-foreground mt-4 text-lg text-pretty">{lead}</p>
      ) : null}
    </div>
  );
}

/** Full-width call-to-action band shown near the foot of most pages. */
export function CtaStrip({
  title = "Ready to see TeamApp in action?",
  description = "Book a 30-minute demo and we'll show you how top teams run their operations on TeamApp.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Section>
      <div className="bg-primary text-primary-foreground rounded-2xl px-6 py-12 text-center sm:px-12 sm:py-16">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
        <p className="text-primary-foreground/80 mx-auto mt-4 max-w-xl text-lg text-pretty">
          {description}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary">
            <Link href="/demo">Book a demo</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground bg-transparent"
          >
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
