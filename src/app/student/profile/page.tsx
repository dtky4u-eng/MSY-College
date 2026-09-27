import { Briefcase, GraduationCap, KeyRound, Lock, UserRound } from "lucide-react";
import { fileUrl } from "@/lib/files";
import { formatDate } from "@/lib/format";
import { PageHeader, DetailList } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { studentPage } from "../_lib/server";
import { ContactForm, PasswordForm, PhotoUpload } from "./profile-forms";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const { auth, student, state, t } = await studentPage();
  const gender = student.gender ? t(`gender.${student.gender}`) : null;

  return (
    <>
      <PageHeader title={t("profile.title")} description={t("profile.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-col items-center text-center">
              <PhotoUpload name={student.name} photoUrl={fileUrl(student.photoFileId)} />
              <p className="mt-3 text-lg font-semibold text-slate-900">{student.name}</p>
              <p className="text-sm text-slate-500">{student.portalRegNo ?? student.registrationNumber}</p>
              <StatusBadge status={state} label={t(`state.${state}`)} className="mt-2" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<UserRound className="size-5" />} title={t("profile.contact")} description={t("profile.contactDesc")} />
            <ContactForm initialMobile={student.mobile ?? ""} initialEmail={student.email ?? auth.user.email ?? ""} />
          </Card>
          <Card>
            <CardHeader icon={<KeyRound className="size-5" />} title={t("profile.password")} description={t("profile.passwordDesc")} />
            <PasswordForm />
          </Card>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader icon={<UserRound className="size-5" />} title={t("profile.personal")} actions={<ReadOnly label={t("profile.readOnly")} />} />
            <CardBody>
              <DetailList
                items={[
                  [t("profile.name"), student.name],
                  [t("profile.father"), student.fatherName],
                  [t("profile.gender"), gender],
                  [t("profile.dob"), student.dob ? formatDate(student.dob) : null],
                  [t("profile.username"), auth.user.username],
                  [t("profile.studentCode"), student.studentCode],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<GraduationCap className="size-5" />} title={t("profile.academic")} actions={<ReadOnly label={t("profile.readOnly")} />} />
            <CardBody>
              <DetailList
                items={[
                  [t("profile.college"), student.college.name],
                  [t("profile.university"), student.college.university],
                  [t("profile.regNo"), student.registrationNumber],
                  [t("profile.rollNo"), student.rollNumber],
                  [t("profile.programme"), student.programme],
                  [t("profile.major"), student.majorSubject],
                  [t("profile.session"), student.session],
                  [t("profile.semester"), student.semester],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<Briefcase className="size-5" />} title={t("profile.internship")} actions={<ReadOnly label={t("profile.readOnly")} />} />
            <CardBody>
              <DetailList
                items={[
                  [t("profile.portalRegNo"), student.portalRegNo],
                  [t("profile.domain"), student.domain ? `${student.domain.name} (${student.domain.durationHours}h)` : null],
                  [t("profile.mentor"), student.mentor ? `${student.mentor.name}${student.mentor.email ? ` · ${student.mentor.email}` : ""}` : t("dash.noMentor")],
                  [t("profile.status"), t(`state.${state}`)],
                  [t("dash.start"), formatDate(student.internshipStart)],
                  [t("dash.end"), formatDate(student.internshipEnd)],
                  [t("profile.registeredOn"), formatDate(student.registeredAt)],
                  [t("profile.result"), student.resultStatus ? `${student.resultStatus}${student.grade ? ` · ${student.grade}` : ""}` : null],
                ]}
              />
              {state === "BLOCKED" && student.blockedReason && <p className="mt-4 text-sm text-rose-600">{t("banner.blockedReason", { reason: student.blockedReason })}</p>}
            </CardBody>
          </Card>
          <p className="text-xs text-slate-500">{t("profile.correctionNote")}</p>
        </div>
      </div>
    </>
  );
}

function ReadOnly({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
      <Lock className="size-3.5" /> {label}
    </span>
  );
}
