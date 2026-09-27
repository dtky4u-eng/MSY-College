"use client";
import { useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAction } from "@/lib/client/hooks";
import { LIMITS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { FileInput } from "@/components/ui/file-input";
import { Avatar } from "@/components/ui/avatar";

/** Student photo with replace/remove actions (JPG/PNG/WEBP up to 2 MB). */
export function PhotoManager({ studentId, name, photoUrl }: { studentId: string; name: string; photoUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const upload = useAction();
  const remove = useAction();

  const submit = async () => {
    if (!file) {
      upload.setFields({ file: "Choose a photo to upload" });
      return;
    }
    const form = new FormData();
    form.append("file", file);
    const res = await upload.run(() => api(`/api/admin/students/${studentId}/photo`, { form }), { success: "Photo updated", refresh: true });
    if (res) {
      setOpen(false);
      setFile(null);
    }
  };

  const doRemove = async () => {
    const res = await remove.run(() => api(`/api/admin/students/${studentId}/photo`, { method: "DELETE" }), { success: "Photo removed", refresh: true });
    if (res !== undefined) {
      setConfirm(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <Avatar name={name} src={photoUrl} size={72} className="shadow-sm" />
      <button
        type="button"
        onClick={() => {
          setFile(null);
          upload.setFields({});
          setOpen(true);
        }}
        className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-brand-600"
        aria-label={photoUrl ? "Change photo" : "Upload photo"}
        title={photoUrl ? "Change photo" : "Upload photo"}
      >
        <Camera className="size-3.5" />
      </button>

      <Modal
        open={open}
        onClose={() => !upload.loading && setOpen(false)}
        size="sm"
        title={photoUrl ? "Change photo" : "Upload photo"}
        description="JPG, PNG or WEBP, up to 2 MB. The old photo is deleted."
        footer={
          <>
            {photoUrl && (
              <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)} disabled={upload.loading}>
                Remove
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={upload.loading}>
              Cancel
            </Button>
            <Button onClick={submit} loading={upload.loading} icon={<Upload className="size-4" />}>
              Upload
            </Button>
          </>
        }
      >
        <FileInput
          accept=".jpg,.jpeg,.png,.webp"
          maxBytes={LIMITS.imageBytes}
          value={file}
          onChange={(f) => {
            setFile(f);
            upload.setFields({});
          }}
          preview
          label="Choose a photo or drag it here"
          error={upload.fields.file}
          disabled={upload.loading}
        />
      </Modal>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doRemove}
        title="Remove photo?"
        description="The student's current photo will be permanently deleted."
        confirmLabel="Remove photo"
        tone="danger"
        loading={remove.loading}
      />
    </div>
  );
}
