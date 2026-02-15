type UploadResponse = {
  url: string;
  key?: string;
};

const DEFAULT_ENDPOINT = "/media/upload";

export async function uploadImageToR2(file: File, groupId: string) {
  const endpoint =
    import.meta.env.VITE_R2_UPLOAD_URL?.trim() || DEFAULT_ENDPOINT;

  const form = new FormData();
  form.append("file", file);
  form.append("groupId", groupId);

  const res = await fetch(endpoint, { method: "POST", body: form });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "Upload failed");
  }

  const data = (await res.json()) as UploadResponse;
  if (!data?.url) throw new Error("Upload failed");
  return data.url;
}
