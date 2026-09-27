import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { getAuth } from "@/lib/auth";
import { canAccessFile, readStoredFile } from "@/lib/files";

/** Serve an uploaded file after an access check (NFR-11). ?download=1 forces attachment. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) throw new ApiError(404, "File not found");
  const auth = await getAuth();
  if (!(await canAccessFile(auth, file))) throw new ApiError(auth ? 403 : 401, "You do not have access to this file");
  const buf = await readStoredFile(file).catch(() => {
    throw new ApiError(404, "File is missing from storage");
  });
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(file.originalName)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
