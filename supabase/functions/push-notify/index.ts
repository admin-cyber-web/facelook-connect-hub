// Supabase Edge Function — push-notify
// Triggered by Database Webhooks on INSERT into `messages` and `likes`.
// Looks up the recipient's OneSignal player ID and sends a push notification.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID = "cee03105-9658-4f06-98fa-70957cb0e1cf";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

Deno.serve(async (req: Request) => {
  // Validate method
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!apiKey) {
    console.error("[push-notify] ONESIGNAL_REST_API_KEY secret is not set");
    return new Response("Server misconfigured", { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (payload.type !== "INSERT") {
    return new Response("Ignored (not INSERT)", { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const record = payload.record;

  // ── Determine recipient user ID and notification text ──────────────────
  let recipientId: string | null = null;
  let title = "Flicks India";
  let body = "";

  if (payload.table === "messages") {
    // New direct message — notify the receiver
    recipientId = record.receiver_id as string;
    const { data: sender } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", record.sender_id)
      .single();
    const name = sender?.full_name || sender?.username || "Someone";
    const preview = typeof record.content === "string"
      ? record.content.slice(0, 80)
      : "sent you a message";
    body = `${name}: ${preview}`;

  } else if (payload.table === "likes") {
    // New like on a post — notify the post author
    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", record.post_id)
      .single();

    if (!post?.author_id) {
      return new Response("Post not found", { status: 200 });
    }

    // Don't notify if the user liked their own post
    if (post.author_id === record.user_id) {
      return new Response("Self-like ignored", { status: 200 });
    }

    recipientId = post.author_id as string;
    const { data: liker } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", record.user_id)
      .single();
    const name = liker?.full_name || liker?.username || "Someone";
    body = `${name} liked your post ❤️`;

  } else {
    return new Response("Unhandled table", { status: 200 });
  }

  if (!recipientId) {
    return new Response("No recipient", { status: 200 });
  }

  // ── Look up recipient's OneSignal player ID ────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("onesignal_player_id")
    .eq("id", recipientId)
    .single();

  const playerId = profile?.onesignal_player_id as string | null;
  if (!playerId) {
    // User hasn't subscribed to push — skip silently
    return new Response("Recipient not subscribed", { status: 200 });
  }

  // ── Send via OneSignal REST API ────────────────────────────────────────
  const notification = {
    app_id: ONESIGNAL_APP_ID,
    include_subscription_ids: [playerId],
    headings: { en: title },
    contents: { en: body },
    android_channel_id: undefined, // set if you configure a channel in OneSignal dashboard
    web_url: "https://flicksindia.online",
    chrome_web_icon: "https://flicksindia.online/logo.png",
  };

  const res = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${apiKey}`,
    },
    body: JSON.stringify(notification),
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("[push-notify] OneSignal error:", JSON.stringify(result));
    return new Response("OneSignal error", { status: 502 });
  }

  console.log("[push-notify] Sent:", result.id, "→", recipientId);
  return new Response(JSON.stringify({ ok: true, id: result.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
