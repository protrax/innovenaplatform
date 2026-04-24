"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Download, File, Loader2, Trash2, Upload } from "lucide-react";

export interface ProjectFile {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  visibility: "shared" | "internal";
  uploaded_by: string;
  uploader_name: string;
  tenant_id: string | null;
  created_at: string;
}

export function FilesPanel({
  projectId,
  initialFiles,
  currentUserId,
  canSeeInternal,
  canUploadInternal,
}: {
  projectId: string;
  initialFiles: ProjectFile[];
  currentUserId: string;
  canSeeInternal: boolean;
  canUploadInternal: boolean;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadVisibility, setUploadVisibility] = useState<
    "shared" | "internal"
  >("shared");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    setError(null);
    try {
      const signRes = await fetch("/api/project-files/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          visibility: uploadVisibility,
        }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) {
        setError(sign.error ?? "Kunne ikke forberede opplasting");
        return;
      }

      const uploadRes = await fetch(sign.upload_url, {
        method: "PUT",
        headers: file.type ? { "content-type": file.type } : {},
        body: file,
      });
      if (!uploadRes.ok) {
        setError(`Opplasting feilet (${uploadRes.status})`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(id: string) {
    setDeletingId(id);
    await fetch(`/api/project-files/${id}`, { method: "DELETE" });
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setDeletingId(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Filer</CardTitle>
            <CardDescription>
              Del dokumenter, designfiler og eksporter trygt mellom partene.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            {canUploadInternal ? (
              <select
                value={uploadVisibility}
                onChange={(e) =>
                  setUploadVisibility(e.target.value as "shared" | "internal")
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="shared">Synlig for kunde</option>
                <option value="internal">Kun internt</option>
              </select>
            ) : null}
            <label className="inline-flex">
              <Button asChild variant="outline" size="sm" disabled={uploading}>
                <span>
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Laster opp…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Last opp fil
                    </>
                  )}
                </span>
              </Button>
              <input
                type="file"
                onChange={handleFileChange}
                disabled={uploading}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        ) : null}

        {files.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ingen filer ennå.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((f) => (
              <li
                key={f.id}
                className="group flex items-center justify-between py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <File className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {f.filename}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(f.size_bytes)} · {f.uploader_name} ·{" "}
                      {formatDate(f.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {f.visibility === "internal" && canSeeInternal ? (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      Intern
                    </Badge>
                  ) : null}
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/project-files/${f.id}/download`}>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {f.uploaded_by === currentUserId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFile(f.id)}
                      disabled={deletingId === f.id}
                      className="hover:text-destructive"
                    >
                      {deletingId === f.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
