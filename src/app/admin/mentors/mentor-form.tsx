"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Save, Trash2, UserCog } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Switch, Checkbox } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/page";
import { ConfirmDialog } from "@/components/ui/modal";

export interface MentorFormValues {
  name: string;
  employeeId: string;
  mobile: string;
  email: string;
  domainId: string;
  collegeId: string;
  photoUrl: string;
  designation: string;
  active: boolean;
  username: string;
}

const EMPTY: MentorFormValues = { name: "", employeeId: "", mobile: "", email: "", domainId: "", collegeId: "", photoUrl: "", designation: "", active: true, username: "" };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function MentorForm({
  mode,
  mentorId,
  initial,
  domains,
  colleges,
  assignedCount = 0,
  deletable,
}: {
  mode: "create" | "edit";
  mentorId?: string;
  initial?: Partial<MentorFormValues>;
  domains: { id: string; name: string; code: string; active: boolean }[];
  colleges: { id: string; name: string; code: string }[];
  assignedCount?: number;
  deletable?: { allowed: boolean; reason?: string };
}) {
  const router = useRouter();
  const [v, setV] = useState<MentorFormValues>({ ...EMPTY, ...initial });
  const [usernameTouched, setUsernameTouched] = useState(mode === "edit" && Boolean(initial?.username && initial.username !== initial.employeeId?.toLowerCase()));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetPw, setResetPw] = useState(mode === "create");
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, loading, fields } = useAction();
  const del = useAction();
  const errors = { ...fields, ...clientErr };
  const domainLocked = mode === "edit" && assignedCount > 0;

  const set = <K extends keyof MentorFormValues>(k: K, val: MentorFormValues[K]) => {
    setV((s) => {
      const next = { ...s, [k]: val };
      if (k === "employeeId" && !usernameTouched) next.username = String(val).toLowerCase();
      return next;
    });
    setClientErr((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
  };

  const validateClient = () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = "Name is required";
    if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(v.employeeId.trim())) e.employeeId = "Use 2–30 letters, digits, dash or underscore";
    if (v.mobile && !/^[6-9]\d{9}$/.test(v.mobile)) e.mobile = "Enter a valid 10-digit mobile number";
    if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address";
    if (!v.domainId) e.domainId = "Choose a domain";
    if (v.photoUrl.trim() && !/^https?:\/\/\S+$/i.test(v.photoUrl.trim())) e.photoUrl = "Enter a valid http(s) URL";
    const username = (v.username || v.employeeId).trim();
    if (!/^[a-zA-Z0-9._-]{4,40}$/.test(username)) e.username = "Username must be 4–40 characters (letters, numbers, dot, dash, underscore)";
    const pwKey = mode === "create" ? "password" : "newPassword";
    if (mode === "create" || (resetPw && password)) {
      if (password.length < 8) e[pwKey] = "Password must be at least 8 characters";
      else if (password !== confirm) e.confirmPassword = "Passwords do not match";
    }
    if (mode === "edit" && resetPw && !password) e.newPassword = "Enter a new password or untick reset";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs = validateClient();
    setClientErr(errs);
    if (Object.keys(errs).length) return;
    const payload = {
      name: v.name.trim(),
      employeeId: v.employeeId.trim(),
      mobile: v.mobile.trim() || null,
      email: v.email.trim() || null,
      domainId: v.domainId,
      collegeId: v.collegeId || null,
      photoUrl: v.photoUrl.trim() || null,
      designation: v.designation.trim() || null,
      active: v.active,
      username: (v.username || v.employeeId).trim().toLowerCase(),
      ...(mode === "create" ? { password } : resetPw && password ? { newPassword: password } : {}),
    };
    const res = await run(
      () => (mode === "create" ? api<{ id: string }>("/api/admin/mentors", { body: payload }) : api<{ id: string }>(`/api/admin/mentors/${mentorId}`, { method: "PATCH", body: payload })),
      { success: mode === "create" ? "Mentor created" : "Mentor updated" },
    );
    if (!res) return;
    if (mode === "create") router.push(`/admin/mentors/${res.id}/assign-students`);
    else {
      setPassword("");
      setConfirm("");
      setResetPw(false);
      router.refresh();
    }
  };

  const onDelete = async () => {
    const res = await del.run(() => api(`/api/admin/mentors/${mentorId}`, { method: "DELETE" }), { success: "Mentor deleted" });
    setConfirmDelete(false);
    if (res) router.push("/admin/mentors");
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Mentor profile" description="Mentors see only students assigned to them and chapters of their domain." icon={<UserCog className="size-5" />} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" required error={errors.name}>
            <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={Boolean(errors.name)} maxLength={120} />
          </Field>
          <Field label="Employee ID" htmlFor="employeeId" required error={errors.employeeId} hint="Unique. Used as the default username.">
            <Input
              id="employeeId"
              value={v.employeeId}
              onChange={(e) => set("employeeId", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30))}
              invalid={Boolean(errors.employeeId)}
              className="font-mono"
              placeholder="e.g. MSYM010"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Domain"
            htmlFor="domainId"
            required
            error={errors.domainId}
            hint={domainLocked ? `Locked: ${assignedCount} student(s) are assigned. Remove them to change the domain.` : undefined}
          >
            <Select id="domainId" value={v.domainId} onChange={(e) => set("domainId", e.target.value)} disabled={domainLocked} invalid={Boolean(errors.domainId)}>
              <option value="">Choose a domain…</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code}){d.active ? "" : " — inactive"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="College (optional)" htmlFor="collegeId" error={errors.collegeId} hint="Link the mentor to a partner college if they are college faculty.">
            <Select id="collegeId" value={v.collegeId} onChange={(e) => set("collegeId", e.target.value)}>
              <option value="">No college (MSY College mentor)</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Designation" htmlFor="designation" error={errors.designation}>
            <Input id="designation" value={v.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Senior Web Developer" maxLength={120} />
          </Field>
          <Field label="Mobile" htmlFor="mobile" error={errors.mobile}>
            <Input id="mobile" inputMode="numeric" value={v.mobile} onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} invalid={Boolean(errors.mobile)} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email} hint="Also usable to sign in.">
            <Input id="email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Photo URL" htmlFor="photoUrl" error={errors.photoUrl}>
            <div className="flex items-center gap-3">
              <Avatar name={v.name || "Mentor"} src={/^https?:\/\//i.test(v.photoUrl) ? v.photoUrl : null} size={40} />
              <Input id="photoUrl" type="url" value={v.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} placeholder="https://…" invalid={Boolean(errors.photoUrl)} />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={v.active} onChange={(val) => set("active", val)} label={v.active ? "Active — can sign in and receive students" : "Inactive — sign-in disabled"} />
          </div>
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Login" description="Mentor portal credentials." icon={<KeyRound className="size-5" />} />
          <CardBody className="space-y-4">
            <Field label="Username" htmlFor="username" required error={errors.username} hint={usernameTouched ? undefined : "Defaults to the employee ID in lower case."}>
              <Input
                id="username"
                value={v.username}
                onChange={(e) => {
                  setUsernameTouched(true);
                  set("username", e.target.value.toLowerCase().replace(/\s/g, ""));
                }}
                invalid={Boolean(errors.username)}
                autoComplete="off"
              />
            </Field>
            {mode === "edit" && <Checkbox label="Reset the password" checked={resetPw} onChange={(e) => setResetPw(e.target.checked)} />}
            {resetPw && (
              <>
                <Field
                  label={mode === "create" ? "Password" : "New password"}
                  htmlFor="password"
                  required
                  error={errors.password ?? errors.newPassword}
                  hint={mode === "edit" ? "The mentor will be signed out of all devices." : "At least 8 characters."}
                >
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" invalid={Boolean(errors.password ?? errors.newPassword)} />
                </Field>
                <Field label="Confirm password" htmlFor="confirmPassword" required error={errors.confirmPassword}>
                  <Input id="confirmPassword" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} />
                </Field>
              </>
            )}
          </CardBody>
          <CardFooter className="justify-between">
            {mode === "edit" && deletable ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                icon={<Trash2 className="size-4" />}
                disabled={!deletable.allowed}
                title={deletable.reason}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ButtonLink href="/admin/mentors" variant="outline">
                Cancel
              </ButtonLink>
              <Button type="submit" loading={loading} icon={<Save className="size-4" />}>
                {mode === "create" ? "Create mentor" : "Save changes"}
              </Button>
            </div>
          </CardFooter>
        </Card>
        {mode === "edit" && !v.active && assignedCount > 0 && (
          <Alert tone="warning" title="Inactive mentor with students">
            {assignedCount} student(s) are still assigned to this mentor. Reassign them so they keep receiving reviews and assessments.
          </Alert>
        )}
        {mode === "edit" && deletable && !deletable.allowed && <p className="text-xs text-slate-500">{deletable.reason}</p>}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={del.loading}
        tone="danger"
        confirmLabel="Delete mentor"
        title="Delete this mentor?"
        description="The mentor profile and login will be removed. This cannot be undone."
      />
    </form>
  );
}
