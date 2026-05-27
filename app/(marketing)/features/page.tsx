import type { Metadata } from "next";
import {
  BarChart3,
  BookOpen,
  FileText,
  Megaphone,
  Sparkles,
  Check,
} from "lucide-react";

import { pageMetadata } from "@/lib/marketing/site";
import { cn } from "@/lib/utils/index";
import {
  Section,
  SectionHeading,
  CtaStrip,
} from "@/components/marketing/section";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Features | TeamApp",
    description:
      "Deal flow with AI contract extraction, a coaching dashboard, training playbooks, and a marketing requests queue — everything a real estate team runs on.",
    path: "/features",
  });
}

const FEATURE_SECTIONS = [
  {
    icon: FileText,
    eyebrow: "Deal Flow",
    title: "Every deal, tracked from submission to close",
    badge: "AI contract extraction",
    body: "Agents submit deals in seconds. TeamApp's AI reads uploaded contracts and extracts the key terms — price, parties, dates — so nobody retypes what's already on the page. Leaders get a live pipeline view across the whole team.",
    points: [
      "AI contract extraction from uploaded agreements",
      "Stage-by-stage pipeline tracking",
      "Team-wide and per-agent deal visibility",
    ],
    roles: "For agents, team leads, and TCs",
  },
  {
    icon: BarChart3,
    eyebrow: "Coaching Dashboard",
    title: "Coach with data, not gut feel",
    body: "See activity and outcomes side by side. Spot the agent who's working hard but not converting, or the one who's ready for a bigger pipeline — then coach from facts instead of anecdotes.",
    points: [
      "Activity and outcome metrics in one view",
      "Per-agent and team-level performance",
      "Identify coaching opportunities early",
    ],
    roles: "For team leads",
  },
  {
    icon: BookOpen,
    eyebrow: "Training Playbooks",
    title: "Onboard and level up every agent the same proven way",
    body: "Build structured playbooks once and assign them to every new hire. Track completion so you know who's ramped and who needs a follow-up — no more guessing whether training actually happened.",
    points: [
      "Reusable, structured training modules",
      "Completion tracking per agent",
      "Consistent onboarding at any scale",
    ],
    roles: "For team leads and agents",
  },
  {
    icon: Megaphone,
    eyebrow: "Marketing Requests",
    title: "A clean queue from request to delivery",
    body: "Agents request listing graphics, social posts, and more in a few taps. Your marketing team works a single prioritized queue — every request tracked, nothing lost in DMs.",
    points: [
      "Simple request intake for agents",
      "Prioritized work queue for marketing",
      "Status tracking from request to delivered",
    ],
    roles: "For agents and marketing",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Section className="pt-16 pb-8 sm:pt-20">
        <SectionHeading
          eyebrow="Features"
          title="Everything your team runs on, in one platform"
          lead="TeamApp replaces the patchwork of spreadsheets, chats, and point tools with one place for deals, coaching, training, and marketing."
        />
      </Section>

      {FEATURE_SECTIONS.map((feature, i) => (
        <Section
          key={feature.eyebrow}
          className={cn(i % 2 === 1 && "bg-muted/30", "py-12 sm:py-16")}
        >
          <div
            className={cn(
              "grid items-center gap-10 md:grid-cols-2",
              i % 2 === 1 && "md:[&>div:first-child]:order-2",
            )}
          >
            <div>
              <div className="bg-primary/10 text-primary mb-4 flex size-11 items-center justify-center rounded-lg">
                <feature.icon className="size-6" aria-hidden />
              </div>
              <p className="text-primary text-sm font-semibold tracking-wide uppercase">
                {feature.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {feature.title}
              </h2>
              {feature.badge ? (
                <span className="bg-primary/10 text-primary mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                  <Sparkles className="size-3" aria-hidden />
                  {feature.badge}
                </span>
              ) : null}
              <p className="text-muted-foreground mt-4 text-lg text-pretty">
                {feature.body}
              </p>
              <p className="text-muted-foreground mt-4 text-sm font-medium">
                {feature.roles}
              </p>
            </div>
            <ul className="bg-card space-y-4 rounded-2xl border p-6 sm:p-8">
              {feature.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <Check
                    className="text-primary mt-0.5 size-5 shrink-0"
                    aria-hidden
                  />
                  <span className="text-pretty">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}

      <CtaStrip />
    </>
  );
}
