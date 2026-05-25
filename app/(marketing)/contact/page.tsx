import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { pageMetadata } from "@/lib/marketing/site";
import { Section } from "@/components/marketing/section";
import { ContactForm } from "./contact-form";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Contact | TeamApp",
    description:
      "Get in touch with the TeamApp team. Tell us about your team and we'll help you get set up.",
    path: "/contact",
  });
}

export default function ContactPage() {
  return (
    <Section className="pt-16 sm:pt-20">
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Let&rsquo;s talk
          </h1>
          <p className="text-muted-foreground mt-4 text-lg text-pretty">
            Tell us a bit about your team and what you&rsquo;re looking for.
            We&rsquo;ll get back to you and help you find the right fit.
          </p>
          <div className="mt-8 rounded-xl border p-5">
            <div className="flex items-start gap-3">
              <CalendarDays
                className="text-primary mt-0.5 size-5"
                aria-hidden
              />
              <div>
                <p className="font-medium">Prefer to see it live?</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  <Link
                    href="/demo"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Book a demo
                  </Link>{" "}
                  and we&rsquo;ll walk you through TeamApp.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-6 sm:p-8">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
