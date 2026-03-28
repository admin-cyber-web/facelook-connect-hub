import { Video, MessageSquare, Star } from "lucide-react";

interface Profile {
  name: string;
  initials: string;
  gradient: string;
}

const ProfileCircle = ({ profile }: { profile: Profile }) => (
  <div className="flex flex-col items-center gap-2">
    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full ${profile.gradient} flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg`}>
      {profile.initials}
    </div>
    <span className="text-xs text-muted-foreground font-medium">{profile.name}</span>
  </div>
);

const ConnectionLine = () => (
  <div className="flex items-center gap-0 flex-1 mx-2">
    <div className="connection-line flex-1 rounded-full" />
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center animate-connection-pulse">
      <Star size={14} className="text-primary" />
    </div>
    <div className="connection-line flex-1 rounded-full" />
  </div>
);

const ConnectionPanel = () => {
  const videoProfiles: [Profile, Profile] = [
    { name: "Ayesha", initials: "AY", gradient: "bg-gradient-to-br from-primary to-secondary" },
    { name: "Zain", initials: "ZN", gradient: "bg-gradient-to-br from-secondary to-accent" },
  ];

  const textProfiles: [Profile, Profile] = [
    { name: "Sara", initials: "SR", gradient: "bg-gradient-to-br from-accent to-primary" },
    { name: "Ali", initials: "AL", gradient: "bg-gradient-to-br from-primary to-accent" },
  ];

  return (
    <div className="space-y-6 px-4 md:px-8">
      {/* Video Chat */}
      <div className="glass rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Video size={18} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Live Connect</span>
          <span className="ml-auto px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">LIVE</span>
        </div>
        <div className="flex items-center justify-center">
          <ProfileCircle profile={videoProfiles[0]} />
          <ConnectionLine />
          <ProfileCircle profile={videoProfiles[1]} />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">Connected Video Chat</p>
      </div>

      {/* Text Chat */}
      <div className="glass rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-secondary" />
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">Text Chat</span>
          <span className="ml-auto px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-semibold">ACTIVE</span>
        </div>
        <div className="flex items-center justify-center">
          <ProfileCircle profile={textProfiles[0]} />
          <ConnectionLine />
          <ProfileCircle profile={textProfiles[1]} />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">Connected Text Chat</p>
      </div>
    </div>
  );
};

export default ConnectionPanel;
