export interface Env {
  MEDIA_BUCKET: R2Bucket;
  PUBLIC_R2_URL: string;
}

function safeFolder(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "uploads";
}

function extFromName(name: string) {
  const parts = name.split(".");
  if (parts.length <= 1) return "bin";
  const ext = parts.pop()?.toLowerCase() || "bin";
  return ext.replace(/[^a-z0-9]/g, "") || "bin";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response("Expected multipart/form-data", { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const groupId = form.get("groupId")?.toString() || "uploads";

  if (!(file instanceof File)) {
    return new Response("Missing file", { status: 400 });
  }

  const folder = safeFolder(groupId);
  const ext = extFromName(file.name);
  const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  await env.MEDIA_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  const base = env.PUBLIC_R2_URL.replace(/\/+$/, "");
  const url = `${base}/${key}`;

  return Response.json({ url, key });
};
