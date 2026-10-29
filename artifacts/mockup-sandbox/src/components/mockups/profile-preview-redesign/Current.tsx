import { MessageCircle, X } from "lucide-react";
import "./_group.css";

const profile = {
  full_name: "Yami Goutham",
  username: "yami_g",
  avatar_url:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=420&q=85",
  bio: "I'm doomed to live in Meshech, cursed with a home in, whole life lived camping among quarrelling neighbors.",
  location: "Hyderabad, India",
  school: "Gems Arts & Science College",
};

export function Current() {
  return (
    <main className="profile-preview-current">
      <div className="backdrop">
        <section className="modal" aria-label="Current quick profile modal">
          <button className="close" type="button" aria-label="Close profile">
            <X size={17} />
          </button>
          <div className="avatar">
            <img src={profile.avatar_url} alt={`${profile.full_name} profile`} />
          </div>
          <h1 className="name">{profile.full_name}</h1>
          <p className="username">@{profile.username}</p>
          <p className="bio">{profile.bio}</p>
          <div className="facts">
            <span>{profile.location}</span>
            <span>{profile.school}</span>
          </div>
          <button className="message" type="button">
            <MessageCircle size={16} />
            Message
          </button>
        </section>
      </div>
    </main>
  );
}
