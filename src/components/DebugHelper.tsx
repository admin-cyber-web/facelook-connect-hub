import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; // Apna supabase path check kar lena

export const DebugHelper = () => {
  const [report, setReport] = useState<any[]>([]);

  const log = (msg: string, status: "✅" | "❌" | "⚠️") => {
    setReport((prev) => [
      ...prev,
      { msg, status, time: new Date().toLocaleTimeString() },
    ]);
  };

  useEffect(() => {
    const runDiagnostics = async () => {
      setReport([]); // Reset report

      // 1. Check Session (Refresh Issue Check)
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        log(`User Logged In: ${sessionData.session.user.email}`, "✅");
      } else {
        log("User Not Found! Refresh killed the session.", "❌");
      }

      // 2. Check Database Table (Read Check)
      const { data: msgData, error: msgError } = await supabase
        .from("messages")
        .select("id")
        .limit(1);

      if (msgError) {
        log(`Database Read Error: ${msgError.message}`, "❌");
      } else {
        log("Database Connection/RLS: Working", "✅");
      }

      // 3. Check Realtime Status
      const channel = supabase
        .channel("debug-test")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          (payload) => {
            console.log("Realtime Test Payload:", payload);
          },
        )
        .subscribe((status) => {
          log(
            `Realtime Subscription: ${status}`,
            status === "SUBSCRIBED" ? "✅" : "⚠️",
          );
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    runDiagnostics();
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        right: "10px",
        zIndex: 9999,
        background: "#000",
        color: "#fff",
        padding: "15px",
        borderRadius: "10px",
        fontSize: "12px",
        border: "2px solid #333",
        maxWidth: "300px",
        opacity: 0.9,
      }}
    >
      <h3 style={{ margin: "0 0 10px 0" }}>🛠️ App Debugger</h3>
      {report.map((r, i) => (
        <div key={i} style={{ marginBottom: "5px" }}>
          {r.status} {r.time}: {r.msg}
        </div>
      ))}
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: "10px",
          width: "100%",
          background: "#444",
          color: "#fff",
          border: "none",
          padding: "5px",
        }}
      >
        Force Refresh & Re-test
      </button>
    </div>
  );
};
