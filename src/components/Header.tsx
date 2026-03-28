import { Search, Bell, MessageCircle } from "lucide-react";
import { useState } from "react";

const Header = () => {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="flex items-center justify-between px-4 md:px-8 py-3">
        {/* Logo */}
        <h1 className="text-2xl md:text-3xl font-bold text-gradient tracking-tight select-none">
          Facelook
        </h1>

        {/* Search */}
        <div className={`relative flex-1 max-w-md mx-4 md:mx-8 transition-all duration-300 ${searchFocused ? 'max-w-lg' : ''}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Search people, groups..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full glass border-none outline-none text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button className="relative p-2.5 rounded-full glass hover:scale-105 transition-transform">
            <MessageCircle size={20} className="text-foreground" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-accent rounded-full" />
          </button>
          <button className="relative p-2.5 rounded-full glass hover:scale-105 transition-transform">
            <Bell size={20} className="text-foreground" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full" />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold text-sm">
            U
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
