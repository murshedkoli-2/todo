import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
];
const MAX_SIZE_MB = 5;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ImgBB API key not configured" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, GIF, AVIF, and BMP are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_SIZE_MB} MB.` },
        { status: 400 }
      );
    }

    // Convert file to base64 for ImgBB API
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Upload to ImgBB
    const imgbbForm = new FormData();
    imgbbForm.append("key", apiKey);
    imgbbForm.append("image", base64);
    // Use original filename without extension as the image name
    const name = file.name.replace(/\.[^/.]+$/, "").slice(0, 100);
    if (name) imgbbForm.append("name", name);

    const imgbbRes = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: imgbbForm,
    });

    if (!imgbbRes.ok) {
      const errText = await imgbbRes.text();
      console.error("ImgBB upload failed:", errText);
      return NextResponse.json(
        { error: "Image upload to ImgBB failed. Please try again." },
        { status: 502 }
      );
    }

    const imgbbData = await imgbbRes.json();

    if (!imgbbData.success) {
      console.error("ImgBB returned failure:", imgbbData);
      return NextResponse.json(
        { error: imgbbData.error?.message || "ImgBB upload failed." },
        { status: 502 }
      );
    }

    // Return the direct display URL and optional delete URL
    return NextResponse.json(
      {
        url:        imgbbData.data.display_url as string,
        deleteUrl:  imgbbData.data.delete_url  as string,
        thumbUrl:   imgbbData.data.thumb?.url  as string | undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
