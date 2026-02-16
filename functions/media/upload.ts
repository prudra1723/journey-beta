export interface Env {
  MEDIA_BUCKET: R2Bucket;
  PUBLIC_R2_URL: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (!env.MEDIA_BUCKET) {
    return new Response("R2 bucket binding (MEDIA_BUCKET) is missing", {
      status: 500,
      headers: corsHeaders,
    });
  }
  if (!env.PUBLIC_R2_URL) {
    return new Response("PUBLIC_R2_URL is missing", {
      status: 500,
      headers: corsHeaders,
    });
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response("Expected multipart/form-data", {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const groupId = form.get("groupId")?.toString() || "uploads";

    if (!(file instanceof File)) {
      return new Response("Missing file", { status: 400, headers: corsHeaders });
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

    return Response.json({ url, key }, { headers: corsHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly";
    return new Response(message, { status: 500, headers: corsHeaders });
  }
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
