import type { Metadata } from "next";
import { BarChart3, BookOpen, Target } from "lucide-react";

import { pageMetadata } from "@/lib/marketing/site";
import { PersonaPage } from "@/components/marketing/persona-page";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "For Team Leaders | TeamApp",
    description:
      "Coach with data, standardize training, and watch team performance like a revenue dashboard. TeamApp gives team leaders one operational view.",
    path: "/for-team-leads",
  });
}

export default function ForTeamLeadsPage() {
  return (
    <PersonaPage
      eyebrow="For Team Leaders"
      title="Run your team like a revenue operation"
      lead="Stop piecing performance together from memory and spreadsheets. TeamApp gives you a single, data-backed view of how your team and every agent are really doing."
      benefits={[
        {
          icon: BarChart3,
          title: "Coaching dashboard",
          description:
            "See activity and outcomes side by side so you coach the right agents on the right things — backed by real data, not gut feel.",
        },
        {
          icon: BookOpen,
          title: "Training playbooks",
          description:
            "Build onboarding and skill playbooks once, assign them to everyone, and track completion so no agent slips through.",
        },
        {
          icon: Target,
          title: "Team performance view",
          description:
            "An MRR-style view of team momentum: pipeline, activity, and ramp at a glance, so you always know where to focus.",
        },
      ]}
      closingTitle="Everything you need to lead a high-performing team"
      highlights={[
        "Spot coaching opportunities before they become problems",
        "Standardize how every new agent ramps",
        "Track deals across the whole team in one pipeline",
        "Tie training completion to performance",
        "Keep marketing requests moving without the back-and-forth",
        "One source of truth for your team's operations",
      ]}
    />
  );
}
