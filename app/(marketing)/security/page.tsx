import type { Metadata } from "next";
import Link from "next/link";
import {
  Lock,
  ShieldCheck,
  KeyRound,
  Users,
  Server,
  FileCheck,
} from "lucide-react";

import { pageMetadata } from "@/lib/marketing/site";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Section, SectionHeading } from "@/components/marketing/section";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Security | TeamApp",
    description:
      "How TeamApp protects your team's data: encryption, role-based access, mandatory 2FA for admins, and row-level data isolation.",
    path: "/security",
  });
}

const PILLARS = [
  {
    icon: Lock,
    title: "Encryption in transit & at rest",
    description:
      "All traffic is served over HTTPS, and data is encrypted at rest by our infrastructure provider.",
  },
  {
    icon: Users,
    title: "Role-based access control",
    description:
      "Five distinct roles scope what each user can see and do. Navigation and data access are both gated by role, server-side.",
  },
  {
    icon: Server,
    title: "Tenant data isolation",
    description:
      "Row-level security enforces strict separation between organizations at the database layer — not just in the application.",
  },
  {
    icon: KeyRound,
    title: "Mandatory 2FA for admins",
    description:
      "Privileged administrator accounts are required to enroll in two-factor authentication before they can access the platform.",
  },
  {
    icon: ShieldCheck,
    title: "Secure authentication",
    description:
      "Authentication is built on a hardened, industry-standard provider with secure session handling and verified email flows.",
  },
  {
    icon: FileCheck,
    title: "Audit logging",
    description:
      "Sensitive actions are recorded so administrators have a clear trail of who did what, and when.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <Section className="pt-16 pb-8 sm:pt-20">
        <SectionHeading
          eyebrow="Security"
          title="Security your team can trust"
          lead="TeamApp is built so your team's operational data stays private, isolated, and protected by default."
        />
      </Section>

      <Section className="pt-4">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} className="h-full">
              <CardContent className="space-y-3 p-6">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <pillar.icon className="size-5" aria-hidden />
                </div>
                <h2 className="font-semibold">{pillar.title}</h2>
                <p className="text-muted-foreground text-sm text-pretty">
                  {pillar.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Alert className="mx-auto mt-10 max-w-3xl">
          <ShieldCheck className="size-4" aria-hidden />
          <AlertTitle>Questions about security or compliance?</AlertTitle>
          <AlertDescription>
            {/* TODO: confirm exact compliance certifications (e.g., SOC 2) before
                advertising them. */}
            We&rsquo;re happy to walk your team through our practices. Reach out
            via the{" "}
            <Link href="/contact" className="text-primary hover:underline">
              contact page
            </Link>
            .
          </AlertDescription>
        </Alert>
      </Section>
    </>
  );
}
