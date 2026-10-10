import { next } from "@vercel/edge";
import { createDynamicShareResponse } from "./src/lib/serverShareMetadata";

export const config = {
  matcher: ["/post/:path*", "/"],
};

export default async function middleware(request: Request): Promise<Response> {
  const response = await createDynamicShareResponse(
    request.url,
    request.headers.get("user-agent") || "",
    process.env,
  );
  return response || next();
}
