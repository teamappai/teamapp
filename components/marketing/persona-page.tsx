import Link from "next/link";
import { Check, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Section,
  SectionHeading,
  CtaStrip,
} from "@/components/marketing/section";

export type PersonaBenefit = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function PersonaPage({
  eyebrow,
  title,
  lead,
  benefits,
  highlights,
  closingTitle,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  benefits: PersonaBenefit[];
  highlights: string[];
  closingTitle: string;
}) {
  return (
    <>
      <Section className="pt-16 pb-8 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty">
            {lead}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/demo">Book a demo</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/features">Explore features</Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section className="pt-4">
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="h-full">
              <CardContent className="space-y-3 p-6">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <benefit.icon className="size-5" aria-hidden />
                </div>
                <h2 className="font-semibold">{benefit.title}</h2>
                <p className="text-muted-foreground text-sm text-pretty">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="bg-muted/30">
        <SectionHeading title={closingTitle} />
        <ul className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {highlights.map((highlight) => (
            <li
              key={highlight}
              className="bg-card flex items-start gap-3 rounded-xl border p-4"
            >
              <Check
                className="text-primary mt-0.5 size-5 shrink-0"
                aria-hidden
              />
              <span className="text-sm text-pretty">{highlight}</span>
            </li>
          ))}
        </ul>
      </Section>

      <CtaStrip />
    </>
  );
}
