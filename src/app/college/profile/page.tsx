import { Building2, KeyRound, Lock } from "lucide-react";
import { requireCollege } from "@/lib/auth";
import { fileUrl } from "@/lib/files";
import { formatDate } from "@/lib/format";
import { PageHeader, DetailList } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ChangePasswordForm } from "@/components/college/change-password-form";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "College Profile" };

export default async function CollegeProfilePage() {
  const { college, auth } = await requireCollege();
  const logo = fileUrl(college.logoFileId);
  return (
    <>
      <PageHeader title="College Profile" description="Keep your college contact details up to date. They appear on student documents and communications." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="College details" icon={<Building2 className="size-5" />} />
          <ProfileForm
            initial={{
              code: college.code,
              name: college.name,
              university: college.university,
              principal: college.principal ?? "",
              coordinator: college.coordinator ?? "",
              mobile: college.mobile ?? "",
              email: college.email ?? "",
              state: college.state ?? "",
              district: college.district ?? "",
              pincode: college.pincode ?? "",
              address: college.address ?? "",
            }}
          />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-col items-center text-center">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={`${college.name} logo`} className="size-24 rounded-2xl border border-slate-200 bg-white object-contain p-2" />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                  <Building2 className="size-10" />
                </div>
              )}
              <p className="mt-3 font-semibold text-slate-900">{college.name}</p>
              <p className="text-sm text-slate-500">{college.university}</p>
              <div className="mt-2">
                <StatusBadge status={college.status} />
              </div>
              <p className="mt-3 text-xs text-slate-400">The logo is managed by MSY College. Contact support to update it.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Account" icon={<Lock className="size-5" />} />
            <CardBody>
              <DetailList
                cols={1}
                items={[
                  ["College code", <span key="c" className="font-mono">{college.code}</span>],
                  ["Username", auth.user.username],
                  ["Revenue share", `${college.collegeShare}% college · ${college.rknexoraShare}% MSY College`],
                  ["Partner since", formatDate(college.createdAt)],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Change password" icon={<KeyRound className="size-5" />} description="Other devices will be signed out" />
            <CardBody>
              <ChangePasswordForm />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
