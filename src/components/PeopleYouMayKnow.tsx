import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { UserPlus } from "lucide-react";
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
  const { openProfile } = useProfileViewer();

  useEffect(() => {
    async function fetchPeople() {
      let query = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, username")
        .limit(9);

      if (currentUserId) {
        query = query.neq("id", currentUserId);
      }

      const { data, error } = await query;
      if (!error && data) {
        setPeople(data as Profile[]);
      }
    }
    fetchPeople();
  }, [currentUserId]);

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
            {/* Square profile photo */}
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

            {/* Name */}
            <p className="text-[12px] font-bold text-gray-900 text-center px-2 mt-2 leading-tight line-clamp-1 w-full truncate">
              {person.full_name || person.username || "Facelook User"}
            </p>

            {/* Add Friend button */}
            <button
              className="flex items-center gap-1 mt-2 mb-3 px-3 py-1.5 rounded-lg text-white text-[11px] font-bold transition-opacity active:opacity-80"
              style={{ background: "#22c55e" }}
            >
              <UserPlus size={12} strokeWidth={2.5} />
              Add Friend
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
