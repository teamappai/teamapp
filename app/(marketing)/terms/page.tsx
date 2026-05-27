import type { Metadata } from "next";

import { pageMetadata } from "@/lib/marketing/site";
import { LegalPage } from "@/components/marketing/legal-page";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Terms of Service | TeamApp",
    description:
      "The terms that govern your use of TeamApp. Draft terms — replace with attorney-reviewed copy before launch.",
    path: "/terms",
  });
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="May 2026"
      intro="These Terms of Service govern your access to and use of TeamApp. By using the platform, you agree to these terms. This is draft placeholder text."
      sections={[
        {
          heading: "Acceptance of terms",
          paragraphs: [
            "By accessing or using TeamApp, you agree to be bound by these Terms. If you do not agree, do not use the platform.",
          ],
        },
        {
          heading: "Accounts",
          paragraphs: [
            "TeamApp is invitation-based. Accounts are created by your organization's administrator. You are responsible for safeguarding your account credentials and for all activity under your account.",
          ],
        },
        {
          heading: "Acceptable use",
          paragraphs: [
            "You agree to use TeamApp only for lawful purposes and in accordance with these Terms. You may not misuse the platform, attempt to access it in unauthorized ways, or interfere with its operation.",
          ],
        },
        {
          heading: "Subscriptions and billing",
          paragraphs: [
            "Paid plans are billed on the cycle you select. Fees are described on our pricing page and are non-refundable except as required by law.",
          ],
        },
        {
          heading: "Intellectual property",
          paragraphs: [
            "TeamApp and its content are owned by us and our licensors. You retain ownership of the content you submit, and grant us the rights needed to operate the platform.",
          ],
        },
        {
          heading: "Termination",
          paragraphs: [
            "We may suspend or terminate access for violations of these Terms. You may stop using the platform at any time.",
          ],
        },
        {
          heading: "Disclaimers and limitation of liability",
          paragraphs: [
            "The platform is provided “as is” without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect or consequential damages.",
          ],
        },
        {
          heading: "Contact us",
          paragraphs: [
            "Questions about these Terms? Reach us through the contact page.",
          ],
        },
      ]}
    />
  );
}
