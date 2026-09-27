import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/public/legal";
import { ORG } from "@/lib/constants";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms-and-conditions"
      title="Terms & Conditions"
      updated="26 September 2026"
      intro={`These terms govern your use of the MSY College internship platform operated by ${ORG.name}. By registering or using the platform you agree to them.`}
      sections={[
        {
          id: "service",
          title: "The service",
          body: (
            <p>
              MSY College provides an online internship programme for undergraduate students under NEP 2020 / CBCS, including learning modules, mentor guidance, live
              projects, attendance and logbook tracking, assessment and certification. The programme is delivered in partnership with the student&apos;s college.
            </p>
          ),
        },
        {
          id: "eligibility",
          title: "Eligibility and registration",
          body: (
            <ul>
              <li>Only students whose record has been uploaded by their own partner college can register, using the University / College Registration Number on their admit card.</li>
              <li>You must provide true, complete and current information. Registration details and documents are locked permanently once you confirm them.</li>
              <li>Your account is personal. Do not share your password; you are responsible for activity under your account.</li>
              <li>Your MSY College Registration Number is issued and your account activated only after the internship fee is paid and verified.</li>
            </ul>
          ),
        },
        {
          id: "fees",
          title: "Fees and payment",
          body: (
            <>
              <p>
                The internship fee depends on the domain you choose and may be specific to your college. The applicable fee is shown before payment. Payments are
                processed by licensed payment gateways; MSY College does not store card or bank credentials.
              </p>
              <p>
                Refunds are governed by our{" "}
                <Link href="/refund-cancellation-policy" className="font-medium text-brand-700">
                  Refund & Cancellation Policy
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          id: "conduct",
          title: "Programme rules and academic integrity",
          body: (
            <ul>
              <li>Attendance, logbook entries, assignments, project work and reports must be your own and must reflect genuine activity.</li>
              <li>Plagiarism, impersonation or falsified records may lead to rejection of submissions, blocking of the account and withholding of the certificate.</li>
              <li>Certificates are issued only after the eligibility criteria (attendance, learning hours, quizzes, approvals and mentor recommendation) are met.</li>
            </ul>
          ),
        },
        {
          id: "certificates",
          title: "Certificates and verification",
          body: (
            <p>
              Each certificate carries a unique number and a QR code that links to a public verification page showing limited details (name, domain, college,
              period, grade). MSY College may revoke a certificate issued on the basis of false information; revoked certificates are shown as revoked on verification.
            </p>
          ),
        },
        {
          id: "ip",
          title: "Content and intellectual property",
          body: (
            <p>
              Learning content, quizzes and materials are the property of MSY College or its licensors and are provided for your personal learning only. You may not
              copy, resell or redistribute them. You retain ownership of the work you submit and grant MSY College and your college a licence to evaluate and archive it.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Availability and liability",
          body: (
            <p>
              We work to keep the platform available and accurate but do not guarantee uninterrupted service. To the extent permitted by law, MSY College&apos;s liability
              is limited to the fee paid for the internship. Academic credit is awarded by your college / university under its own regulations.
            </p>
          ),
        },
        {
          id: "law",
          title: "Changes and governing law",
          body: (
            <p>
              We may update these terms; the current version is always published on this page. These terms are governed by the laws of India, and courts at Patna,
              Bihar have jurisdiction.
            </p>
          ),
        },
      ]}
    />
  );
}
