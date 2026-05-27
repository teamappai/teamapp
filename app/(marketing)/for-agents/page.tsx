import type { Metadata } from "next";
import { Smartphone, BookOpen, Zap } from "lucide-react";

import { pageMetadata } from "@/lib/marketing/site";
import { PersonaPage } from "@/components/marketing/persona-page";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "For Agents | TeamApp",
    description:
      "Log deals and activity in seconds from your phone, and find every training playbook in one place. TeamApp keeps agents selling, not admin-ing.",
    path: "/for-agents",
  });
}

export default function ForAgentsPage() {
  return (
    <PersonaPage
      eyebrow="For Agents"
      title="Spend less time on admin, more time selling"
      lead="TeamApp makes the busywork fast: log deals and activity in seconds, and find everything you need to get better — all in one place, right from your phone."
      benefits={[
        {
          icon: Zap,
          title: "Quick deal entry",
          description:
            "Submit a deal in seconds. Upload the contract and AI fills in the details, so you're not retyping what's already on the page.",
        },
        {
          icon: Smartphone,
          title: "Mobile activity log",
          description:
            "Log calls, showings, and follow-ups on the go. Your pipeline stays current without you sitting at a desk.",
        },
        {
          icon: BookOpen,
          title: "Training in one place",
          description:
            "Every playbook and onboarding module lives in one library, so you always know what to do next to level up.",
        },
      ]}
      closingTitle="Built to keep you moving"
      highlights={[
        "Submit deals in seconds with AI contract extraction",
        "Log activity from your phone, anywhere",
        "Find every training playbook in one place",
        "Request marketing assets in a few taps",
        "See your own pipeline and progress clearly",
        "Less data entry, more time with clients",
      ]}
    />
  );
}
