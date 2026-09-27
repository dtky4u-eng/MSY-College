import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal";
import { ORG } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy-policy"
      title="Privacy Policy"
      updated="26 September 2026"
      intro={`This policy explains what personal data ${ORG.name} collects on this internship platform, why, who can see it, and how long it is kept.`}
      sections={[
        {
          id: "collect",
          title: "Data we collect",
          body: (
            <ul>
              <li>
                <strong>From your college:</strong> name, University / College Registration Number, roll number, programme, subject, session and semester.
              </li>
              <li>
                <strong>From you at registration:</strong> father&apos;s name, gender, date of birth, mobile number, email, username, passport photo and latest
                semester admit card.
              </li>
              <li>
                <strong>During the internship:</strong> learning activity and time, quiz attempts, attendance, logbook entries, submissions, mentor feedback and
                assessment.
              </li>
              <li>
                <strong>Payments:</strong> amount, status, gateway order / transaction identifiers and receipt details. Card, UPI and bank credentials are handled
                only by the payment gateway and are never stored by us.
              </li>
              <li>
                <strong>Technical:</strong> session identifiers, IP address and device information for security and audit logs.
              </li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <ul>
              <li>To verify your enrolment with your college and run your registration and payment.</li>
              <li>To deliver learning, track attendance and hours, and enable mentor review and assessment.</li>
              <li>To generate your offer letter, attendance sheet, logbook, report, marksheet, certificate and receipts.</li>
              <li>To send service messages (payment confirmation, password reset, announcements) and to prevent fraud and misuse.</li>
            </ul>
          ),
        },
        {
          id: "access",
          title: "Who can see your data",
          body: (
            <>
              <p>Access is role-based and enforced on our servers for every request. Your personal data and documents (photo, admit card, identity documents, marksheet) are visible only to:</p>
              <ul>
                <li>
                  <strong>You</strong>, the student;
                </li>
                <li>
                  <strong>Your college</strong> — only for students of that college;
                </li>
                <li>
                  <strong>Your assigned mentor</strong> — only for students assigned to them;
                </li>
                <li>
                  <strong>MSY College administrators</strong> — for operating and supporting the programme.
                </li>
              </ul>
              <p>
                The public certificate verification page shows only your name, domain, college, university, internship period, hours, grade and certificate number —
                never your mobile number, email, date of birth or parents&apos; names. We do not sell your data. Payment gateways receive only what is needed to
                process your payment.
              </p>
            </>
          ),
        },
        {
          id: "retention",
          title: "Retention of documents",
          body: (
            <ul>
              <li>Identity documents (admit card, photo) are kept for the duration of the internship and for up to 3 years after completion, to support verification requests from colleges and universities, and are then deleted.</li>
              <li>Certificate records and the data shown on the verification page are retained for as long as the certificate remains verifiable.</li>
              <li>Payment and receipt records are retained for the period required by Indian tax and accounting law (currently 8 years).</li>
              <li>Registrations that are started but never paid are deleted, together with uploaded documents, 12 months after the last activity.</li>
            </ul>
          ),
        },
        {
          id: "consent",
          title: "Consent and your rights",
          body: (
            <>
              <p>
                By confirming your registration you consent to the processing described here for the purpose of your internship. You may request access to or
                correction of your data (name corrections are made through your college), and deletion of data that is no longer required, subject to legal
                retention duties. You can withdraw consent before payment by not completing registration.
              </p>
              <p>These rights are provided in line with the Digital Personal Data Protection Act, 2023.</p>
            </>
          ),
        },
        {
          id: "security",
          title: "Security",
          body: (
            <p>
              Passwords are stored hashed, sessions can be revoked, uploads are type-checked and stored outside the public web root, and every document download is
              access-checked. Administrative actions on payments, passwords and student status are audit-logged.
            </p>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              We use only essential cookies: sign-in session cookies, a short-lived registration cookie while you complete the wizard, and your language preference.
              We do not use advertising cookies.
            </p>
          ),
        },
        {
          id: "grievance",
          title: "Grievance officer",
          body: (
            <p>
              For privacy questions or complaints, write to the Grievance Officer, {ORG.name}, {ORG.address} at {ORG.email}. We respond within 30 days.
            </p>
          ),
        },
      ]}
    />
  );
}
