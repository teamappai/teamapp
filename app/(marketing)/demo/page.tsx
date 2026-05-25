import type { Metadata } from "next";

import { pageMetadata, DEMO_CALENDLY_URL } from "@/lib/marketing/site";
import { Section, SectionHeading } from "@/components/marketing/section";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Book a Demo | TeamApp",
    description:
      "See TeamApp in action. Book a 30-minute demo and we'll show you how high-performing real estate teams run their operations on TeamApp.",
    path: "/demo",
  });
}

export default function DemoPage() {
  return (
    <Section className="pt-16 sm:pt-20">
      <SectionHeading
        eyebrow="Book a demo"
        title="See TeamApp in action"
        lead="Pick a time that works for you. We'll walk through deal flow, coaching, training, and how AI fits into your team's workflow."
      />

      {/* TODO: replace the placeholder Calendly URL (lib/marketing/site.ts →
          DEMO_CALENDLY_URL) with Phil's real scheduling link before launch. */}
      <div className="mx-auto mt-10 max-w-3xl">
        <div className="bg-card overflow-hidden rounded-2xl border">
          <iframe
            src={DEMO_CALENDLY_URL}
            title="Book a demo with TeamApp"
            className="h-[700px] w-full"
            loading="lazy"
          />
        </div>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Trouble loading the scheduler?{" "}
          <a
            href={DEMO_CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Open it in a new tab
          </a>
          .
        </p>
      </div>
    </Section>
  );
}
