"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { GENDERS } from "@/lib/constants";
import { toISTDateString } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/field";
import { EMAIL_RE, MOBILE_RE, isRealYmd } from "./validate";

export interface DetailsValues {
  name: string;
  fatherName: string;
  rollNumber: string;
  gender: string;
  dob: string;
  programme: string;
  majorSubject: string;
  session: string;
  semester: string;
  mobile: string;
  email: string;
}

type Opt = { value: string; label: string };

function check(v: DetailsValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.name.trim().length < 2) e.name = "Enter the student's full name";
  else if (v.name.trim().length > 100) e.name = "Name must be 100 characters or fewer";
  if (v.fatherName.trim().length > 100) e.fatherName = "Must be 100 characters or fewer";
  if (v.rollNumber.trim().length > 40) e.rollNumber = "Must be 40 characters or fewer";
  if (v.majorSubject.trim().length > 100) e.majorSubject = "Must be 100 characters or fewer";
  if (v.dob) {
    if (!isRealYmd(v.dob)) e.dob = "Use a valid date";
    else if (v.dob < "1950-01-01" || v.dob > toISTDateString()) e.dob = "Date of birth must be a past date";
  }
  if (v.mobile.trim() && !MOBILE_RE.test(v.mobile.trim())) e.mobile = "Enter a valid 10-digit mobile number";
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address";
  return e;
}

/** "Edit details" button + modal form for personal and academic fields (FR-ADM-6). */
export function EditDetailsButton({
  studentId,
  initial,
  options,
}: {
  studentId: string;
  initial: DetailsValues;
  options: { programmes: Opt[]; sessions: Opt[]; semesters: Opt[] };
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<DetailsValues>(initial);
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = { ...fields, ...local };

  const update = (k: keyof DetailsValues, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    if (err[k]) {
      setLocal((s) => ({ ...s, [k]: "" }));
      setFields((s) => ({ ...s, [k]: "" }));
    }
  };
  const set = (k: keyof DetailsValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => update(k, e.target.value);

  const openModal = () => {
    setV(initial);
    setLocal({});
    setFields({});
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = check(v);
    setLocal(errors);
    if (Object.keys(errors).length) return;
    const res = await run(() => api<{ changed: string[] }>(`/api/admin/students/${studentId}`, { method: "PATCH", body: v }), {
      success: "Student details saved",
      refresh: true,
    });
    if (!res) return;
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" icon={<Pencil className="size-3.5" />} onClick={openModal}>
        Edit details
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        size="lg"
        title="Edit student details"
        description="Changes are recorded in the audit log with the previous values."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="student-details-form" loading={loading}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="student-details-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="sd-name" required error={err.name} className="sm:col-span-2">
            <Input id="sd-name" value={v.name} onChange={set("name")} invalid={Boolean(err.name)} maxLength={100} autoComplete="off" />
          </Field>
          <Field label="Father's name" htmlFor="sd-father" error={err.fatherName}>
            <Input id="sd-father" value={v.fatherName} onChange={set("fatherName")} invalid={Boolean(err.fatherName)} maxLength={100} autoComplete="off" />
          </Field>
          <Field label="Roll number" htmlFor="sd-roll" error={err.rollNumber}>
            <Input id="sd-roll" value={v.rollNumber} onChange={set("rollNumber")} invalid={Boolean(err.rollNumber)} maxLength={40} autoComplete="off" />
          </Field>
          <Field label="Gender" htmlFor="sd-gender" error={err.gender}>
            <Select id="sd-gender" value={v.gender} onChange={set("gender")} invalid={Boolean(err.gender)}>
              <option value="">Not specified</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date of birth" htmlFor="sd-dob" error={err.dob}>
            <Input id="sd-dob" type="date" value={v.dob} onChange={set("dob")} invalid={Boolean(err.dob)} max={toISTDateString()} min="1950-01-01" />
          </Field>
          <Field label="Programme" htmlFor="sd-programme" error={err.programme}>
            <OptionSelect id="sd-programme" value={v.programme} onChange={set("programme")} options={options.programmes} invalid={Boolean(err.programme)} />
          </Field>
          <Field label="Major subject" htmlFor="sd-major" error={err.majorSubject}>
            <Input id="sd-major" value={v.majorSubject} onChange={set("majorSubject")} invalid={Boolean(err.majorSubject)} maxLength={100} />
          </Field>
          <Field label="Session" htmlFor="sd-session" error={err.session}>
            <OptionSelect id="sd-session" value={v.session} onChange={set("session")} options={options.sessions} invalid={Boolean(err.session)} />
          </Field>
          <Field label="Semester" htmlFor="sd-semester" error={err.semester}>
            <OptionSelect id="sd-semester" value={v.semester} onChange={set("semester")} options={options.semesters} invalid={Boolean(err.semester)} />
          </Field>
          <Field label="Mobile" htmlFor="sd-mobile" error={err.mobile} hint="10-digit Indian mobile number">
            <Input
              id="sd-mobile"
              inputMode="numeric"
              value={v.mobile}
              onChange={(e) => update("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
              invalid={Boolean(err.mobile)}
              autoComplete="off"
            />
          </Field>
          <Field label="Email" htmlFor="sd-email" error={err.email}>
            <Input id="sd-email" type="email" value={v.email} onChange={set("email")} invalid={Boolean(err.email)} maxLength={120} autoComplete="off" />
          </Field>
        </form>
      </Modal>
    </>
  );
}

function OptionSelect({
  id,
  value,
  onChange,
  options,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Opt[];
  invalid?: boolean;
}) {
  return (
    <Select id={id} value={value} onChange={onChange} invalid={invalid}>
      <option value="">Not specified</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
