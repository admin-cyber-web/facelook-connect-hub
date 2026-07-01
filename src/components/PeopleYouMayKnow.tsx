import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { UserPlus, Check, Sparkles } from "lucide-react";
import { useProfileViewer } from "@/context/ProfileViewerContext";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

interface Props {
  currentUserId?: string;
}

export default function PeopleYouMayKnow({ currentUserId }: Props) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const { openProfile } = useProfileViewer();

  useEffect(() => {
    async function fetchPeople() {
      if (!currentUserId) return;

      const [{ data: profiles }, { data: existing }, { data: blocks }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, username")
          .neq("id", currentUserId)
          .limit(30),
        supabase
          .from("friend_requests")
          .select("receiver_id")
          .eq("sender_id", currentUserId),
        supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`),
      ]);

      const blockedSet = new Set<string>();
      for (const b of blocks || []) {
        if (b.blocker_id === currentUserId) blockedSet.add(b.blocked_id);
        if (b.blocked_id === currentUserId) blockedSet.add(b.blocker_id);
      }

      if (profiles) {
        const visible = (profiles as Profile[]).filter(p => !blockedSet.has(p.id)).slice(0, 9);
        setPeople(visible);
      }
      if (existing) {
        setSentRequests(new Set(existing.map((r: any) => r.receiver_id)));
      }
    }
    fetchPeople();
  }, [currentUserId]);

  const handleAddFriend = async (e: React.MouseEvent, personId: string) => {
    e.stopPropagation();
    if (!currentUserId || sentRequests.has(personId)) return;
    setSentRequests((prev) => new Set([...prev, personId]));
    await supabase.from("friend_requests").insert({
      sender_id: currentUserId,
      receiver_id: personId,
      status: "pending",
    });
  };

  if (people.length === 0) return null;

  return (
    <div className="px-3 py-3" style={{ fontFamily: '"Inter","Segoe UI",system-ui,sans-serif' }}>
      {/* ── Section header — softer, friendlier title ─────────────────────── */}
      <div className="flex items-center gap-2 px-1 mb-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center"
             style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
          <Sparkles size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[14px] font-extrabold text-gray-900 tracking-tight leading-none">
            People You May Know
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 tracking-wide font-medium">
            Tap to view · Add to grow your circle
          </p>
        </div>
      </div>

      {/* ── Cards ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {people.slice(0, 3).map((person) => {
          const sent = sentRequests.has(person.id);
          return (
            <div
              key={person.id}
              className="bg-white rounded-2xl flex flex-col items-center overflow-hidden cursor-pointer transition-transform active:scale-[0.97]"
              style={{
                boxShadow: "0 2px 10px rgba(16,185,129,0.10), 0 1px 3px rgba(0,0,0,0.06)",
                border: "1px solid #f0fdf4",
              }}
              onClick={() => openProfile(person.id)}
            >
              {/* Avatar — square top */}
              <div className="w-full aspect-square overflow-hidden relative"
                   style={{ background: "linear-gradient(135deg,#34d399,#059669)" }}>
                {person.avatar_url ? (
                  <img
                    src={person.avatar_url}
                    alt={person.full_name || "User"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                   decoding="async"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-black text-3xl tracking-tight">
                    {(person.full_name || person.username || "?")[0].toUpperCase()}
                  </div>
                )}
                {/* subtle bottom-fade so the name overlays cleanly if needed */}
                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/15 to-transparent" />
              </div>

              {/* Name */}
              <p className="text-[12.5px] font-extrabold text-gray-900 text-center px-2 mt-2.5 leading-tight line-clamp-1 w-full truncate tracking-tight">
                {person.full_name || person.username || "Flicks User"}
              </p>
              {person.username && person.full_name && (
                <p className="text-[10px] text-gray-400 text-center px-2 mt-0.5 truncate w-full font-medium">
                  @{person.username}
                </p>
              )}

              {/* Add Friend — green pill */}
              <button
                onClick={(e) => handleAddFriend(e, person.id)}
                disabled={sent}
                className={`flex items-center justify-center gap-1.5 mt-2.5 mb-3 px-3 py-2 rounded-full text-[11.5px] font-extrabold tracking-wide transition-all active:scale-95 w-[88%] ${
                  sent
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "text-white"
                }`}
                style={
                  sent
                    ? {}
                    : {
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        boxShadow: "0 4px 12px rgba(16,185,129,0.45), 0 0 0 1px rgba(16,185,129,0.2) inset",
                      }
                }
              >
                {sent ? (
                  <><Check size={13} strokeWidth={3} /> Requested</>
                ) : (
                  <><UserPlus size={13} strokeWidth={2.75} /> Add Friend</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
