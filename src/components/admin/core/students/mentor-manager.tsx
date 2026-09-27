"use client";
import { useMemo, useState } from "react";
import { UserCog } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/page";

export interface MentorOption {
  id: string;
  name: string;
  employeeId: string;
  domainId: string;
  active: boolean;
  students: number;
}

export interface DomainOption {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

/** Change internship domain and mentor. Mentors are limited to active mentors of the selected domain. */
export function MentorManager({
  studentId,
  domainId,
  mentorId,
  paid,
  feeLabel,
  domains,
  mentors,
}: {
  studentId: string;
  domainId: string | null;
  mentorId: string | null;
  paid: boolean;
  feeLabel: string | null;
  domains: DomainOption[];
  mentors: MentorOption[];
}) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(domainId ?? "");
  const [m, setM] = useState(mentorId ?? "");
  const [local, setLocal] = useState<Record<string, string>>({});
  const { run, loading, fields, setFields } = useAction();
  const err = { ...fields, ...local };

  const available = useMemo(
    () => mentors.filter((x) => x.domainId === d && (x.active || x.id === mentorId)).sort((a, b) => a.students - b.students || a.name.localeCompare(b.name)),
    [mentors, d, mentorId],
  );

  const openModal = () => {
    setD(domainId ?? "");
    setM(mentorId ?? "");
    setLocal({});
    setFields({});
    setOpen(true);
  };

  const changeDomain = (v: string) => {
    setD(v);
    if (!mentors.some((x) => x.id === m && x.domainId === v)) setM("");
    setLocal({});
    setFields({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!d && paid) v.domainId = "A paid student must keep an internship domain";
    if (m && !d) v.mentorId = "Choose a domain before assigning a mentor";
    if (d === (domainId ?? "") && m === (mentorId ?? "")) v.mentorId = "Nothing has changed";
    setLocal(v);
    if (Object.keys(v).length) return;
    const res = await run(
      () => api<{ changed: boolean; mentorCleared?: boolean }>(`/api/admin/students/${studentId}/mentor`, { body: { domainId: d || null, mentorId: m || null } }),
      { success: "Domain and mentor updated", refresh: true },
    );
    if (res) setOpen(false);
  };

  const domainChanged = d !== (domainId ?? "");
  const mentorDropped = Boolean(mentorId) && !m;
  return (
    <>
      <Button variant="outline" size="sm" icon={<UserCog className="size-4" />} onClick={openModal}>
        Change domain / mentor
      </Button>
      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        size="md"
        title="Domain and mentor"
        description="Mentors must be active and belong to the student's domain."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="student-mentor-form" loading={loading}>
              Save
            </Button>
          </>
        }
      >
        <form id="student-mentor-form" onSubmit={submit} noValidate className="space-y-4">
          <Field label="Internship domain" htmlFor="mt-domain" required={paid} error={err.domainId}>
            <Select id="mt-domain" value={d} onChange={(e) => changeDomain(e.target.value)} invalid={Boolean(err.domainId)}>
              <option value="">{paid ? "Select a domain…" : "No domain selected"}</option>
              {domains
                .filter((x) => x.active || x.id === domainId)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.code}){x.active ? "" : " · inactive"}
                  </option>
                ))}
            </Select>
          </Field>
          {domainChanged && paid && (
            <Alert tone="warning" title="This student has already paid">
              The fee{feeLabel ? ` of ${feeLabel}` : ""} was captured for the previous domain and is not recalculated. Learning progress in the old domain will no longer count.
            </Alert>
          )}
          <Field
            label="Mentor"
            htmlFor="mt-mentor"
            error={err.mentorId}
            hint={d ? (available.length ? "Sorted by current number of assigned students" : "No active mentors in this domain yet") : "Choose a domain first"}
          >
            <Select
              id="mt-mentor"
              value={m}
              onChange={(e) => {
                setM(e.target.value);
                setLocal({});
                setFields({});
              }}
              disabled={!d}
              invalid={Boolean(err.mentorId)}
            >
              <option value="">Not assigned</option>
              {available.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.employeeId}) · {x.students} student{x.students === 1 ? "" : "s"}
                  {x.active ? "" : " · inactive"}
                </option>
              ))}
            </Select>
          </Field>
          {mentorDropped && <Alert tone="info">The current mentor will be unassigned.</Alert>}
        </form>
      </Modal>
    </>
  );
}
