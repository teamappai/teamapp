import type { Metadata } from "next";

import { pageMetadata } from "@/lib/marketing/site";
import {
  Section,
  SectionHeading,
  CtaStrip,
} from "@/components/marketing/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PricingCards } from "./pricing-cards";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Pricing | TeamApp",
    description:
      "Simple, seat-based pricing for real estate teams of every size. Launch, Pro, and Enterprise plans — get 2 months free with annual billing.",
    path: "/pricing",
  });
}

const FAQS = [
  {
    q: "How does seat-based pricing work?",
    a: "Each plan includes a set number of seats. If your team grows beyond the included seats, you add more at the per-seat rate shown on each plan — billed on the same cycle as your subscription.",
  },
  {
    q: "What's the difference between monthly and annual billing?",
    a: "Annual billing is paid once per year and gives you 2 months free versus paying monthly. You can switch between cycles as your needs change.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Book a demo and we'll set you up with a trial so your team can try TeamApp with your real workflow before you commit.",
  },
  {
    q: "How do I sign up?",
    a: "TeamApp is invitation-based, so accounts are created by your team's admin. Start by booking a demo or contacting sales and we'll get your team onboarded.",
  },
  {
    q: "Can I change plans later?",
    a: "Absolutely. You can upgrade or downgrade at any time; pricing adjusts on your next billing cycle.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Section className="pt-16 pb-8 sm:pt-20">
        <SectionHeading
          eyebrow="Pricing"
          title="Pricing that scales with your team"
          lead="Pick the plan that fits today and grow into the next one. Every plan includes the core platform — deal flow, training, and marketing requests."
        />
      </Section>

      <Section className="pt-0">
        <PricingCards />
      </Section>

      <Section className="bg-muted/30">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mx-auto mt-10 max-w-2xl">
          <Accordion type="single" collapsible>
            {FAQS.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      <CtaStrip
        title="Not sure which plan fits?"
        description="Book a demo and we'll help you pick the right plan for your team's size and goals."
      />
    </>
  );
}
