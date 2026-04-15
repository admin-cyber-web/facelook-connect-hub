import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { UserPlus, Check, Clock } from "lucide-react";
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

      const [{ data: profiles }, { data: existing }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, username")
          .neq("id", currentUserId)
          .limit(9),
        supabase
          .from("friend_requests")
          .select("receiver_id")
          .eq("sender_id", currentUserId),
      ]);

      if (profiles) setPeople(profiles as Profile[]);
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
    <div className="px-3 py-2">
      <p className="text-[12px] font-black text-gray-700 mb-3">People You May Know</p>
      <div className="grid grid-cols-3 gap-3">
        {people.slice(0, 3).map((person) => (
          <div
            key={person.id}
            className="bg-white rounded-xl flex flex-col items-center overflow-hidden shadow-sm cursor-pointer"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
            onClick={() => openProfile(person.id)}
          >
            <div className="w-full aspect-square bg-gradient-to-br from-blue-400 to-indigo-600 overflow-hidden">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={person.full_name || "User"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-black text-2xl">
                  {(person.full_name || person.username || "?")[0].toUpperCase()}
                </div>
              )}
            </div>

            <p className="text-[12px] font-bold text-gray-900 text-center px-2 mt-2 leading-tight line-clamp-1 w-full truncate">
              {person.full_name || person.username || "Flicks User"}
            </p>

            <button
              onClick={(e) => handleAddFriend(e, person.id)}
              disabled={sentRequests.has(person.id)}
              className={`flex items-center justify-center gap-1.5 mt-2 mb-3 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all active:scale-95 w-[90%] shadow-md ${
                sentRequests.has(person.id)
                  ? "bg-gray-200 text-gray-500 shadow-none"
                  : "text-white"
              }`}
              style={
                sentRequests.has(person.id)
                  ? {}
                  : { background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(79,70,229,0.4)" }
              }
            >
              {sentRequests.has(person.id) ? (
                <><Clock size={14} strokeWidth={2.5} /> Requested</>
              ) : (
                <><UserPlus size={14} strokeWidth={2.5} /> Add Friend</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
