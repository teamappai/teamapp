import type { Metadata } from "next";

import { pageMetadata } from "@/lib/marketing/site";
import { LegalPage } from "@/components/marketing/legal-page";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Privacy Policy | TeamApp",
    description:
      "How TeamApp collects, uses, and protects your data. Draft policy — replace with attorney-reviewed copy before launch.",
    path: "/privacy",
  });
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="May 2026"
      intro="This Privacy Policy describes how TeamApp (“we”, “us”) collects, uses, and shares information when you use our platform. This is draft placeholder text."
      sections={[
        {
          heading: "Information we collect",
          paragraphs: [
            "We collect information you provide directly, such as account details, profile information, and content you submit to the platform.",
            "We also collect usage data automatically, including log data, device information, and analytics about how you interact with TeamApp.",
          ],
        },
        {
          heading: "How we use information",
          paragraphs: [
            "We use the information we collect to provide, maintain, and improve the platform, to communicate with you, and to keep TeamApp secure.",
            "We do not sell your personal information.",
          ],
        },
        {
          heading: "How we share information",
          paragraphs: [
            "We share information with service providers who help us operate the platform, and as required by law. Within your organization, information is shared according to your role and permissions.",
          ],
        },
        {
          heading: "Data retention",
          paragraphs: [
            "We retain information for as long as your account is active or as needed to provide the service, comply with legal obligations, and resolve disputes.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: [
            "Depending on your location, you may have rights to access, correct, or delete your personal information. Contact us to exercise these rights.",
          ],
        },
        {
          heading: "Contact us",
          paragraphs: [
            "If you have questions about this Privacy Policy, contact us through the contact page.",
          ],
        },
      ]}
    />
  );
}
