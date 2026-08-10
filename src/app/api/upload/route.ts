import { handler } from "@/lib/api/route";
import { BadRequestError, UpstreamError } from "@/lib/api/errors";
import { detectImageType } from "@/lib/imageType";
import { enforceRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** Uploads are the most expensive authenticated endpoint, so they get a cap. */
const UPLOAD_LIMIT = { limit: 40, windowMs: 60 * 60_000 };

interface ImgBbResponse {
  success?: boolean;
  error?: { message?: string };
  data?: {
    display_url?: string;
    delete_url?: string;
    thumb?: { url?: string };
  };
}

export const POST = handler(
  async ({ userId, request }) => {
    await enforceRateLimit(`upload:${userId}`, UPLOAD_LIMIT);

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) throw new UpstreamError("Image hosting is not configured.");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) throw new BadRequestError("No file provided");
    if (file.size === 0) throw new BadRequestError("File is empty");
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestError(
        `File too large. Maximum size is ${MAX_SIZE_BYTES / 1024 / 1024} MB.`
      );
    }

    const bytes = await file.arrayBuffer();

    // Sniffed rather than trusting `file.type`, which the client sets freely.
    const detected = detectImageType(bytes);
    if (!detected) {
      throw new BadRequestError(
        "That file is not a supported image. Use JPEG, PNG, WebP, GIF, AVIF, or BMP."
      );
    }

    const imgbbForm = new FormData();
    imgbbForm.append("key", apiKey);
    imgbbForm.append("image", Buffer.from(bytes).toString("base64"));

    // Strip the extension and any path separators before echoing the name back.
    const safeName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w\-. ]/g, "")
      .slice(0, 100)
      .trim();
    if (safeName) imgbbForm.append("name", safeName);

    let payload: ImgBbResponse;
    try {
      const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: imgbbForm,
        signal: AbortSignal.timeout(30_000),
      });
      payload = (await response.json()) as ImgBbResponse;
      if (!response.ok || !payload.success) {
        console.error("ImgBB upload rejected:", payload.error?.message ?? response.status);
        throw new UpstreamError("Image upload failed. Please try again.");
      }
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      console.error("ImgBB upload error:", error);
      throw new UpstreamError("Image upload failed. Please try again.");
    }

    const url = payload.data?.display_url;
    if (!url) throw new UpstreamError("Image host returned no URL.");

    return {
      url,
      // ImgBB's delete link is a browser page, not an API endpoint, so it is
      // returned for the user rather than called programmatically. Uploaded
      // images stay publicly reachable by URL — see README.
      deleteUrl: payload.data?.delete_url,
      thumbUrl: payload.data?.thumb?.url,
    };
  },
  { status: 201 }
);
