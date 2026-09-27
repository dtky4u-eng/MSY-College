"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Lock, MapPin, Percent, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { Alert } from "@/components/ui/page";
import { ConfirmDialog } from "@/components/ui/modal";

export interface CollegeFormValues {
  code: string;
  name: string;
  university: string;
  principal: string;
  coordinator: string;
  email: string;
  mobile: string;
  state: string;
  district: string;
  pincode: string;
  address: string;
  collegeShare: string;
  rknexoraShare: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  username: string;
  loginEmail: string;
}

const EMPTY: CollegeFormValues = {
  code: "",
  name: "",
  university: "",
  principal: "",
  coordinator: "",
  email: "",
  mobile: "",
  state: "",
  district: "",
  pincode: "",
  address: "",
  collegeShare: "20",
  rknexoraShare: "80",
  status: "ACTIVE",
  username: "",
  loginEmail: "",
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validateClient(v: CollegeFormValues, mode: "create" | "edit", pw: { password: string; confirm: string; required: boolean }) {
  const e: Record<string, string> = {};
  if (mode === "create") {
    if (!v.code.trim()) e.code = "College code is required";
    else if (!/^[A-Z0-9]{2,12}$/.test(v.code.trim())) e.code = "Use 2–12 uppercase letters and digits";
  }
  if (v.name.trim().length < 2) e.name = "College name is required";
  if (v.university.trim().length < 2) e.university = "University is required";
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address";
  if (v.mobile.trim() && !/^[6-9]\d{9}$/.test(v.mobile.trim())) e.mobile = "Enter a valid 10-digit mobile number";
  if (v.pincode.trim() && !/^\d{6}$/.test(v.pincode.trim())) e.pincode = "Pincode must be 6 digits";
  const cs = Number(v.collegeShare);
  const rs = Number(v.rknexoraShare);
  if (v.collegeShare.trim() === "" || !Number.isFinite(cs) || cs < 0 || cs > 100) e.collegeShare = "Enter a percentage between 0 and 100";
  if (v.rknexoraShare.trim() === "" || !Number.isFinite(rs) || rs < 0 || rs > 100) e.rknexoraShare = "Enter a percentage between 0 and 100";
  if (!e.collegeShare && !e.rknexoraShare && Math.abs(cs + rs - 100) > 0.001) {
    e.collegeShare = "College share and MSY College share must add up to 100%";
    e.rknexoraShare = "College share and MSY College share must add up to 100%";
  }
  if (!/^[a-zA-Z0-9._-]{4,40}$/.test(v.username.trim())) e.username = "Username must be 4–40 characters (letters, numbers, dot, dash, underscore)";
  if (v.loginEmail.trim() && !EMAIL_RE.test(v.loginEmail.trim())) e.loginEmail = "Enter a valid email address";
  const pwKey = mode === "create" ? "password" : "newPassword";
  if (pw.required || pw.password) {
    if (pw.password.length < 8) e[pwKey] = "Password must be at least 8 characters";
    else if (pw.password !== pw.confirm) e.confirmPassword = "Passwords do not match";
  }
  return e;
}

export function CollegeForm({
  mode,
  collegeId,
  initial,
  logoUrl,
  hasLogin = true,
  deletable,
}: {
  mode: "create" | "edit";
  collegeId?: string;
  initial?: Partial<CollegeFormValues>;
  logoUrl?: string | null;
  hasLogin?: boolean;
  deletable?: { allowed: boolean; reason?: string };
}) {
  const router = useRouter();
  const [v, setV] = useState<CollegeFormValues>({ ...EMPTY, ...initial });
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetPw, setResetPw] = useState(mode === "create" || !hasLogin);
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, loading, fields } = useAction();
  const del = useAction();

  const errors = { ...fields, ...clientErr };
  const set = <K extends keyof CollegeFormValues>(k: K, val: CollegeFormValues[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    if (clientErr[k]) setClientErr(({ [k]: _omit, ...rest }) => rest);
  };

  const shareTotal = useMemo(() => {
    const t = Number(v.collegeShare) + Number(v.rknexoraShare);
    return Number.isFinite(t) ? Math.round(t * 100) / 100 : NaN;
  }, [v.collegeShare, v.rknexoraShare]);

  const onCollegeShare = (val: string) => {
    set("collegeShare", val);
    const n = Number(val);
    if (val.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100) set("rknexoraShare", String(Math.round((100 - n) * 100) / 100));
  };
  const onRknShare = (val: string) => {
    set("rknexoraShare", val);
    const n = Number(val);
    if (val.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100) set("collegeShare", String(Math.round((100 - n) * 100) / 100));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateClient(v, mode, { password: resetPw ? password : "", confirm, required: mode === "create" || !hasLogin });
    setClientErr(errs);
    if (Object.keys(errs).length) return;

    const form = new FormData();
    for (const [k, val] of Object.entries(v)) {
      if (k === "code" && mode === "edit") continue;
      form.set(k, typeof val === "string" ? val.trim() : String(val));
    }
    if (mode === "create") form.set("password", password);
    else if (resetPw && password) form.set("newPassword", password);
    if (logo) form.set("logo", logo);
    if (removeLogo && !logo) form.set("removeLogo", "1");

    const res = await run(
      () =>
        mode === "create"
          ? api<{ id: string }>("/api/admin/colleges", { form })
          : api<{ id: string; passwordChanged: boolean }>(`/api/admin/colleges/${collegeId}`, { method: "PATCH", form }),
      {
        success: mode === "create" ? "College created" : "College updated",
        successDescription: mode === "create" ? "The college-admin login is ready to use." : undefined,
      },
    );
    if (!res) return;
    if (mode === "create") {
      router.push(`/admin/colleges/${res.id}/domain-fees?created=1`);
    } else {
      setPassword("");
      setConfirm("");
      setLogo(null);
      if (hasLogin) setResetPw(false);
      router.refresh();
    }
  };

  const onDelete = async () => {
    const res = await del.run(() => api(`/api/admin/colleges/${collegeId}`, { method: "DELETE" }), { success: "College deleted" });
    if (res) router.push("/admin/colleges");
    setConfirmDelete(false);
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader title="College details" description="Basic information shown on documents and reports." icon={<Building2 className="size-5" />} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field
              label="College code"
              htmlFor="code"
              required={mode === "create"}
              error={errors.code}
              hint={mode === "create" ? "Uppercase letters and digits. It cannot be changed later." : "The college code is permanent and cannot be edited."}
            >
              <Input
                id="code"
                value={v.code}
                onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                readOnly={mode === "edit"}
                aria-readonly={mode === "edit"}
                invalid={Boolean(errors.code)}
                placeholder="e.g. GVDC"
                className="font-mono tracking-wider"
                leading={mode === "edit" ? <Lock className="size-4" /> : undefined}
                autoComplete="off"
              />
            </Field>
            <Field label="Status" htmlFor="status" required error={errors.status} hint="Pending and inactive colleges stay visible to admins only.">
              <Select id="status" value={v.status} onChange={(e) => set("status", e.target.value as CollegeFormValues["status"])}>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </Field>
            <Field label="College name" htmlFor="name" required error={errors.name} className="sm:col-span-2">
              <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={Boolean(errors.name)} maxLength={200} />
            </Field>
            <Field label="University" htmlFor="university" required error={errors.university} className="sm:col-span-2">
              <Input id="university" value={v.university} onChange={(e) => set("university", e.target.value)} invalid={Boolean(errors.university)} maxLength={200} />
            </Field>
            <Field label="Principal" htmlFor="principal" error={errors.principal}>
              <Input id="principal" value={v.principal} onChange={(e) => set("principal", e.target.value)} maxLength={120} />
            </Field>
            <Field label="Internship coordinator" htmlFor="coordinator" error={errors.coordinator}>
              <Input id="coordinator" value={v.coordinator} onChange={(e) => set("coordinator", e.target.value)} maxLength={120} />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email}>
              <Input id="email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} invalid={Boolean(errors.email)} placeholder="office@college.edu.in" />
            </Field>
            <Field label="Mobile" htmlFor="mobile" error={errors.mobile} hint="10-digit Indian mobile number">
              <Input
                id="mobile"
                inputMode="numeric"
                value={v.mobile}
                onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                invalid={Boolean(errors.mobile)}
                placeholder="9876543210"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Address" icon={<MapPin className="size-5" />} />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="State" htmlFor="state" error={errors.state}>
              <Input id="state" value={v.state} onChange={(e) => set("state", e.target.value)} maxLength={80} />
            </Field>
            <Field label="District" htmlFor="district" error={errors.district}>
              <Input id="district" value={v.district} onChange={(e) => set("district", e.target.value)} maxLength={80} />
            </Field>
            <Field label="Pincode" htmlFor="pincode" error={errors.pincode}>
              <Input
                id="pincode"
                inputMode="numeric"
                value={v.pincode}
                onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                invalid={Boolean(errors.pincode)}
                placeholder="800001"
              />
            </Field>
            <Field label="Address" htmlFor="address" error={errors.address} className="sm:col-span-3">
              <Textarea id="address" rows={3} value={v.address} onChange={(e) => set("address", e.target.value)} maxLength={500} />
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Revenue share" description="Split of each successful student payment." icon={<Percent className="size-5" />} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="College %" htmlFor="collegeShare" required error={errors.collegeShare}>
                <Input id="collegeShare" type="number" min={0} max={100} step="0.01" value={v.collegeShare} onChange={(e) => onCollegeShare(e.target.value)} invalid={Boolean(errors.collegeShare)} />
              </Field>
              <Field label="MSY College %" htmlFor="rknexoraShare" required error={errors.rknexoraShare}>
                <Input id="rknexoraShare" type="number" min={0} max={100} step="0.01" value={v.rknexoraShare} onChange={(e) => onRknShare(e.target.value)} invalid={Boolean(errors.rknexoraShare)} />
              </Field>
            </div>
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="bg-brand-600" style={{ width: `${Math.max(0, Math.min(100, Number(v.collegeShare) || 0))}%` }} />
                <div className="bg-sky-400" style={{ width: `${Math.max(0, Math.min(100, Number(v.rknexoraShare) || 0))}%` }} />
              </div>
              <p className={`mt-1.5 text-xs ${shareTotal === 100 ? "text-slate-500" : "font-medium text-rose-600"}`}>
                Total: {Number.isFinite(shareTotal) ? `${shareTotal}%` : "—"} {shareTotal === 100 ? "" : "· must equal 100%"}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Logo" description="JPG, PNG or WEBP, up to 2 MB." />
          <CardBody className="space-y-3">
            {logoUrl && !removeLogo && !logo && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Current logo" className="size-14 rounded-lg object-contain" />
                <div className="flex-1 text-sm text-slate-600">Current logo</div>
                <Button variant="ghost" size="xs" icon={<Trash2 className="size-3.5" />} onClick={() => setRemoveLogo(true)}>
                  Remove
                </Button>
              </div>
            )}
            {removeLogo && !logo && (
              <Alert tone="warning" action={<Button size="xs" variant="outline" onClick={() => setRemoveLogo(false)}>Undo</Button>}>
                The logo will be removed when you save.
              </Alert>
            )}
            <FileInput
              accept=".jpg,.jpeg,.png,.webp"
              maxBytes={2 * 1024 * 1024}
              value={logo}
              onChange={setLogo}
              preview
              label={logoUrl ? "Upload a new logo" : "Choose a logo or drag it here"}
              error={errors.logo}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="College-admin login"
            description={hasLogin ? "Used by the college to sign in to the college portal." : "This college has no login yet — create one below."}
            icon={<KeyRound className="size-5" />}
          />
          <CardBody className="space-y-4">
            <Field label="Username" htmlFor="username" required error={errors.username}>
              <Input id="username" value={v.username} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, ""))} invalid={Boolean(errors.username)} autoComplete="off" />
            </Field>
            <Field label="Login email" htmlFor="loginEmail" error={errors.loginEmail} hint="Optional. Can also be used to sign in and reset the password.">
              <Input id="loginEmail" type="email" value={v.loginEmail} onChange={(e) => set("loginEmail", e.target.value)} invalid={Boolean(errors.loginEmail)} autoComplete="off" />
            </Field>
            {mode === "edit" && hasLogin && <Checkbox label="Reset the password" checked={resetPw} onChange={(e) => setResetPw(e.target.checked)} />}
            {resetPw && (
              <>
                <Field
                  label={mode === "create" || !hasLogin ? "Password" : "New password"}
                  htmlFor="password"
                  required
                  error={errors.password ?? errors.newPassword}
                  hint={mode === "edit" && hasLogin ? "All existing sessions of this login will be signed out." : "At least 8 characters."}
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
                onClick={() => setConfirmDelete(true)}
                disabled={!deletable.allowed}
                title={deletable.allowed ? undefined : deletable.reason}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ButtonLink href="/admin/colleges" variant="outline">
                Cancel
              </ButtonLink>
              <Button type="submit" loading={loading} icon={<Save className="size-4" />}>
                {mode === "create" ? "Create college" : "Save changes"}
              </Button>
            </div>
          </CardFooter>
        </Card>
        {mode === "edit" && deletable && !deletable.allowed && <p className="text-xs text-slate-500">{deletable.reason}</p>}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={del.loading}
        tone="danger"
        confirmLabel="Delete college"
        title="Delete this college?"
        description="The college, its custom domain fees and its login will be removed. This cannot be undone."
      />
    </form>
  );
}
