import type { VercelRequest, VercelResponse } from "@vercel/node";

const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY || "02778420-6acb-480a-998ba7ac08a0-df96-411c";
const BUNNY_STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME || "flicks-india-storage";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send({ error: "Method not allowed" });
    return;
  }

  try {
    // Handle multipart form data for image upload
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    if (!file) {
      res.status(400).send({ error: "No file provided" });
      return;
    }

    // Convert File to Buffer for Bunny Storage PUT
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Bunny Storage via direct PUT
    const storageUrl = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE_NAME}/${fileName}`;

    const putResponse = await fetch(storageUrl, {
      method: "PUT",
      headers: {
        "AccessKey": BUNNY_STORAGE_API_KEY,
        "Content-Type": file.type || "application/octet-stream",
        "Content-Length": buffer.length,
      },
      body: buffer,
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error("Bunny Storage upload error:", errorText);
      res.status(putResponse.status).send({ error: errorText || "Failed to upload image" });
      return;
    }

    // Return the public CDN URL
    const cdnUrl = `https://flicks-india-storage.b-cdn.net/${fileName}`;

    res.status(200).send({
      url: cdnUrl,
      fileName,
    });
  } catch (error: any) {
    console.error("Bunny image upload error:", error);
    res.status(500).send({ error: error.message || "Failed to upload image" });
  }
}