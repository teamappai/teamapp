import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  FileText,
  Megaphone,
  Sparkles,
  Users,
  UserRound,
  ClipboardCheck,
  Quote,
} from "lucide-react";

import { pageMetadata, SITE_TAGLINE } from "@/lib/marketing/site";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Section,
  SectionHeading,
  CtaStrip,
} from "@/components/marketing/section";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: `${SITE_TAGLINE} | TeamApp`,
    path: "/",
  });
}

const FEATURES = [
  {
    icon: FileText,
    title: "Deal Flow",
    description:
      "Track every deal from submission to close. AI contract extraction reads uploaded agreements and fills in the details for you — no more manual data entry.",
    badge: "AI",
  },
  {
    icon: BarChart3,
    title: "Coaching Dashboard",
    description:
      "See team and agent performance at a glance. Spot who needs a nudge and who's ready for more, backed by real activity data.",
  },
  {
    icon: BookOpen,
    title: "Training Playbooks",
    description:
      "Build structured onboarding and ongoing training. Track completion so every agent ramps the same proven way.",
  },
  {
    icon: Megaphone,
    title: "Marketing Requests",
    description:
      "Agents request marketing assets in a few taps; your marketing team works a clean queue from request to delivery.",
  },
];

const PERSONAS = [
  {
    icon: Users,
    title: "For Team Leaders",
    description:
      "Coach with data, standardize training, and watch team performance like a revenue dashboard.",
    href: "/for-team-leads",
  },
  {
    icon: UserRound,
    title: "For Agents",
    description:
      "Log activity and deals in seconds from your phone, and find every playbook in one place.",
    href: "/for-agents",
  },
  {
    icon: ClipboardCheck,
    title: "For Staff",
    description:
      "Admins, TCs, and marketing get focused queues and clear handoffs — no more chasing scattered threads.",
    href: "/features",
  },
];

export default function MarketingHomePage() {
  return (
    <>
      {/* Hero */}
      <Section className="pt-20 pb-12 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            The OS for high-performing real estate teams.
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg text-pretty sm:text-xl">
            TeamApp centralizes your team&rsquo;s operational data so you can
            train better, coach smarter, and unlock AI workflows.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/demo">Book a demo</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>

        {/* Social proof slot — placeholder testimonial */}
        <div className="mx-auto mt-16 max-w-2xl">
          <Card className="bg-muted/30">
            <CardContent className="flex gap-4 p-6">
              <Quote className="text-primary size-8 shrink-0" aria-hidden />
              <div>
                <p className="text-lg text-pretty">
                  {/* TODO: replace with a real customer testimonial before launch. */}
                  &ldquo;TeamApp gave us one place for deals, coaching, and
                  training. Our new agents ramp faster and nothing falls through
                  the cracks.&rdquo;
                </p>
                <p className="text-muted-foreground mt-3 text-sm font-medium">
                  Placeholder Name — Team Leader, Example Realty
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* 4-up feature grid */}
      <Section className="pt-4">
        <SectionHeading
          eyebrow="Platform"
          title="Everything your team runs on, in one place"
          lead="Stop stitching together spreadsheets, group chats, and one-off tools. TeamApp brings your operations under one roof."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="h-full">
              <CardContent className="space-y-3 p-6">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <feature.icon className="size-5" aria-hidden />
                </div>
                <h3 className="flex items-center gap-2 font-semibold">
                  {feature.title}
                  {feature.badge ? (
                    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                      <Sparkles className="size-3" aria-hidden />
                      {feature.badge}
                    </span>
                  ) : null}
                </h3>
                <p className="text-muted-foreground text-sm text-pretty">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* Persona block */}
      <Section className="bg-muted/30 py-16 sm:py-20">
        <SectionHeading
          eyebrow="Built for the whole team"
          title="One platform, every role"
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PERSONAS.map((persona) => (
            <Link
              key={persona.title}
              href={persona.href}
              className="group focus-visible:ring-ring/50 rounded-xl focus-visible:ring-[3px] focus-visible:outline-none"
            >
              <Card className="group-hover:border-primary/40 h-full transition-colors">
                <CardContent className="space-y-3 p-6">
                  <persona.icon className="text-primary size-6" aria-hidden />
                  <h3 className="font-semibold">{persona.title}</h3>
                  <p className="text-muted-foreground text-sm text-pretty">
                    {persona.description}
                  </p>
                  <span className="text-primary inline-block pt-1 text-sm font-medium group-hover:underline">
                    Learn more &rarr;
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      {/* ROI section */}
      <Section>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <SectionHeading
              title="Teams using TeamApp close more deals"
              className="mx-0 text-left"
            />
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              When training, coaching, and deal data live together, leaders
              coach on facts and agents spend more time selling.{" "}
              {/* TODO: replace placeholder stats with real, sourced metrics before launch. */}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[
              { stat: "X%", label: "more deals closed" },
              { stat: "X hrs", label: "saved per agent / month" },
              { stat: "X%", label: "faster agent ramp" },
              { stat: "1", label: "place for everything" },
            ].map((item) => (
              <Card key={item.label} className="bg-muted/30">
                <CardContent className="p-6 text-center">
                  <div className="text-primary text-3xl font-semibold sm:text-4xl">
                    {item.stat}
                  </div>
                  <div className="text-muted-foreground mt-1 text-sm">
                    {item.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      <CtaStrip />
    </>
  );
}
