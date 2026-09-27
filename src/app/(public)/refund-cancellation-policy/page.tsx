import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal";
import { ORG } from "@/lib/constants";

export const metadata: Metadata = { title: "Refund & Cancellation Policy" };

export default function RefundPage() {
  return (
    <LegalPage
      current="/refund-cancellation-policy"
      title="Refund & Cancellation Policy"
      updated="26 September 2026"
      intro="This policy explains when the internship fee can be refunded and how failed or duplicate payments are handled."
      sections={[
        {
          id: "before-start",
          title: "Cancellation before the internship starts",
          body: (
            <p>
              You may request cancellation within 7 days of payment, provided your internship start date has not yet begun and you have not accessed learning
              content. An eligible cancellation is refunded in full, less payment-gateway charges (if any).
            </p>
          ),
        },
        {
          id: "after-start",
          title: "After the internship starts",
          body: (
            <p>
              Once the internship has started, learning content has been accessed, or documents such as the offer letter have been issued, the fee is
              non-refundable. Blocking of an account for violation of the Terms & Conditions does not qualify for a refund.
            </p>
          ),
        },
        {
          id: "failed",
          title: "Failed, pending and duplicate payments",
          body: (
            <ul>
              <li>If money is debited but the payment fails, the bank or gateway normally reverses it automatically within 5–7 working days.</li>
              <li>If a payment shows &ldquo;awaiting confirmation&rdquo;, please do not pay again — the status updates automatically once the bank confirms.</li>
              <li>If you paid but verification failed, contact support with your payment ID; we reconcile with the gateway and activate your account or refund you.</li>
              <li>Duplicate payments for the same registration are refunded in full to the original payment method.</li>
            </ul>
          ),
        },
        {
          id: "how",
          title: "How to request a refund",
          body: (
            <p>
              Email {ORG.email} from your registered email address with your MSY College Registration Number (or University Registration Number), transaction ID and
              reason. We acknowledge within 2 working days.
            </p>
          ),
        },
        {
          id: "timeline",
          title: "Refund timeline",
          body: <p>Approved refunds are processed to the original payment method within 7–10 working days of approval. The time to reflect in your account depends on your bank.</p>,
        },
        {
          id: "college",
          title: "Programme changes by MSY College",
          body: (
            <p>
              If MSY College cancels a domain or cannot start your internship within 90 days of payment, you may choose another domain or receive a full refund.
            </p>
          ),
        },
      ]}
    />
  );
}
