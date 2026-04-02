export interface MovieEntry {
  title: string;
  poster: string;
  emojis: string;
  hint: string;
  jumbled: string;
}

function jumble(title: string): string {
  const letters = title.toUpperCase().replace(/[^A-Z]/g, "").split("");
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join("-");
}

function missingLetters(title: string): string {
  const upper = title.toUpperCase();
  return upper
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      return i % 2 === 0 ? ch : "_";
    })
    .join(" ");
}

const RAW: Omit<MovieEntry, "jumbled">[] = [
  {
    title: "ANIMAL",
    poster: "https://image.tmdb.org/t/p/w500/jafkqFMPxAMUrF7DqBGlCNOBxyz.jpg",
    emojis: "🦁🪓🩸",
    hint: "Ranbir Kapoor's dark revenge action movie (2023)",
  },
  {
    title: "PATHAAN",
    poster: "https://image.tmdb.org/t/p/w500/nmGWzTLMXy9x7mKd8NKPLmHtWGa.jpg",
    emojis: "🕵️💣🇮🇳",
    hint: "SRK returns as a super-spy saving India",
  },
  {
    title: "JAWAN",
    poster: "https://image.tmdb.org/t/p/w500/oqC7nBJvPdAToMfR4gEZYxbBHwP.jpg",
    emojis: "👮‍♂️🚂🔥",
    hint: "Shah Rukh Khan plays a jail warden with a secret past",
  },
  {
    title: "GADAR 2",
    poster: "https://image.tmdb.org/t/p/w500/o75FXDHmE0cLnSatsoMqtNjQMr4.jpg",
    emojis: "🌲🔫❤️",
    hint: "Sunny Deol goes back to Pakistan for his son",
  },
  {
    title: "DANGAL",
    poster: "https://image.tmdb.org/t/p/w500/f7Gls9DExGMKhJ0Q3GqNKsTWfkE.jpg",
    emojis: "🤼‍♀️🥇🇮🇳",
    hint: "Aamir Khan trains his daughters to become wrestling champions",
  },
  {
    title: "3 IDIOTS",
    poster: "https://image.tmdb.org/t/p/w500/66A9MqXOyVFCssoloscw79z8Tew.jpg",
    emojis: "🎓😂❤️",
    hint: "Three friends challenge the Indian education system",
  },
  {
    title: "PK",
    poster: "https://image.tmdb.org/t/p/w500/5pLhcD3VHJtSBMUHfG3PL7Ly0AM.jpg",
    emojis: "👽📡🙏",
    hint: "An alien on Earth questions religion and blind faith",
  },
  {
    title: "BAAHUBALI",
    poster: "https://image.tmdb.org/t/p/w500/mVDZOBBxNX66s7Q3ZLMnmIAh18O.jpg",
    emojis: "👑⚔️🌊",
    hint: "Epic tale of a warrior prince and his kingdom",
  },
  {
    title: "RRR",
    poster: "https://image.tmdb.org/t/p/w500/nEufeZlyAOLqO2brrs0yeF1lgXO.jpg",
    emojis: "🔥🐯🌊",
    hint: "Two freedom fighters in British India — fire and water",
  },
  {
    title: "KGF",
    poster: "https://image.tmdb.org/t/p/w500/4j0PNHkMr5ax3IA8tjtxcmPU3QT.jpg",
    emojis: "⛏️💰🔱",
    hint: "Yash rises from poverty to rule a gold mining empire",
  },
  {
    title: "PUSHPA",
    poster: "https://image.tmdb.org/t/p/w500/rugyJdeoJm7cSJL1q4jBpTNbxyU.jpg",
    emojis: "🌺🪵🔥",
    hint: "Allu Arjun as a red sandalwood smuggler with attitude",
  },
  {
    title: "SALAAR",
    poster: "https://image.tmdb.org/t/p/w500/rFAuRrVMhGjMRkJEBwOHg9PWqOe.jpg",
    emojis: "☠️🏛️⚔️",
    hint: "Prabhas in a violent tale of friendship and power",
  },
  {
    title: "LEO",
    poster: "https://image.tmdb.org/t/p/w500/hhsGJLKM3WBbnTvDTYSMBZP1dvS.jpg",
    emojis: "🦁☕🔫",
    hint: "Vijay plays a cafe owner with a dark secret past",
  },
  {
    title: "JAILER",
    poster: "https://image.tmdb.org/t/p/w500/3mhCOwIqiYgEqcXBCzxHGgDlbm9.jpg",
    emojis: "🗝️🏛️💥",
    hint: "Rajinikanth as a retired jailer hunting down criminals",
  },
  {
    title: "VIKRAM",
    poster: "https://image.tmdb.org/t/p/w500/eTNxSFCTOHIPaThMBN1z5L14Mhk.jpg",
    emojis: "🎭🔫🕶️",
    hint: "Kamal Haasan in a high-octane multi-starrer action thriller",
  },
  {
    title: "MASTER",
    poster: "https://image.tmdb.org/t/p/w500/5bwSQOaKjCpSAojlZFLkRrAmKdl.jpg",
    emojis: "🏫🍺💪",
    hint: "Vijay as an alcoholic professor sent to reform school",
  },
  {
    title: "DILWALE DULHANIA LE JAYENGE",
    poster: "https://image.tmdb.org/t/p/w500/gu8Q0hBQkuFi95gLyj5E8lTF4hP.jpg",
    emojis: "🚂🌻💑",
    hint: "SRK and Kajol's classic Europe romance — Raj loves Simran",
  },
  {
    title: "SHOLAY",
    poster: "https://image.tmdb.org/t/p/w500/2myfyiNtPNiFdHKobmQUYRMt02b.jpg",
    emojis: "🏜️🐎🔫",
    hint: "Iconic dacoit movie — Gabbar Singh's 'Kitne Aadmi The'",
  },
  {
    title: "LAGAAN",
    poster: "https://image.tmdb.org/t/p/w500/gWh0gVPumBBBlFIIBqNpiNlkDqv.jpg",
    emojis: "🏏💧🌧️",
    hint: "Aamir Khan challenges British officers to a cricket match to cancel taxes",
  },
  {
    title: "TAARE ZAMEEN PAR",
    poster: "https://image.tmdb.org/t/p/w500/3IH6P7iyCOu8fQ2FXjbY9VjUTtm.jpg",
    emojis: "⭐🎨😢",
    hint: "A dyslexic child finds hope through a caring art teacher",
  },
  {
    title: "ZINDAGI NA MILEGI DOBARA",
    poster: "https://image.tmdb.org/t/p/w500/3ACfJPHSxToJa0GIfN9JXyCELa0.jpg",
    emojis: "🏊‍♂️🏍️🪂",
    hint: "Three friends on a Spain road trip face their fears",
  },
  {
    title: "DIL CHAHTA HAI",
    poster: "https://image.tmdb.org/t/p/w500/pXVRhWZgRHoEK2C0fFVDfPb4jA8.jpg",
    emojis: "👯‍♂️🎉❤️",
    hint: "Three best friends navigate love and life after college",
  },
  {
    title: "KABHI KHUSHI KABHIE GHAM",
    poster: "https://image.tmdb.org/t/p/w500/ndNhNnmolBJGEcMEi0J7ILOQ5a4.jpg",
    emojis: "👨‍👩‍👦🏠💎",
    hint: "A rich family drama — 'It's all about loving your parents'",
  },
  {
    title: "URI",
    poster: "https://image.tmdb.org/t/p/w500/7mYuLNP0YT4bS1PEV9FmrTxVILI.jpg",
    emojis: "💣🪖🇮🇳",
    hint: "Vicky Kaushal leads the Indian Army's surgical strike in Pakistan",
  },
  {
    title: "ANDHADHUN",
    poster: "https://image.tmdb.org/t/p/w500/jFy2YEG0IZe3yFhXl3MhPJ7XKBZ.jpg",
    emojis: "🎹🙈💊",
    hint: "A blind pianist accidentally witnesses a murder — or did he?",
  },
  {
    title: "STREE",
    poster: "https://image.tmdb.org/t/p/w500/UrRaMHJPNBWNRiV0q7wAoQ44AGM.jpg",
    emojis: "👗👁️‍🗨️😱",
    hint: "A horror-comedy about a ghost who takes men in a small town",
  },
  {
    title: "TUMBBAD",
    poster: "https://image.tmdb.org/t/p/w500/2mJdLCpBFvF0YQnHJaKKB2TbAHi.jpg",
    emojis: "🪙👹🌧️",
    hint: "A cursed village in Maharashtra hides a god's forbidden gold",
  },
  {
    title: "ARTICLE 15",
    poster: "https://image.tmdb.org/t/p/w500/m9yOLmVXhfrgFhJBH3FXWzSHlf5.jpg",
    emojis: "⚖️🩸🔍",
    hint: "An IPS officer investigates caste-based crimes in rural India",
  },
  {
    title: "KABIR SINGH",
    poster: "https://image.tmdb.org/t/p/w500/6wbXr3C4fVNXpHNtYANqFHjMlA1.jpg",
    emojis: "💉❤️🩺",
    hint: "Shahid Kapoor as a self-destructive surgeon in love",
  },
  {
    title: "WAR",
    poster: "https://image.tmdb.org/t/p/w500/sOHeTMPHXQ6ILOqp6ySuQNYEIhN.jpg",
    emojis: "🔫💥🕶️",
    hint: "Hrithik vs Tiger — a RAW agent hunts his rogue mentor",
  },
  {
    title: "SULTAN",
    poster: "https://image.tmdb.org/t/p/w500/wqnGOYOBiDs4sCrKrb2w2M82Cca.jpg",
    emojis: "🤼‍♂️🏆💪",
    hint: "Salman Khan as a wrestler who lost everything for his family",
  },
  {
    title: "BAJRANGI BHAIJAAN",
    poster: "https://image.tmdb.org/t/p/w500/iYzgMm5aezBK3BFQ42hJfAsMpmD.jpg",
    emojis: "🐒👧🇵🇰",
    hint: "Salman Khan takes a mute Pakistani girl home across the border",
  },
  {
    title: "RANG DE BASANTI",
    poster: "https://image.tmdb.org/t/p/w500/1PxQb6tQFJpLfpIGZOJXJT2zqaV.jpg",
    emojis: "🟡🎓💥",
    hint: "College friends re-live freedom fighters' lives and revolt",
  },
  {
    title: "CHAK DE INDIA",
    poster: "https://image.tmdb.org/t/p/w500/bDUoJLs8M5zFLANLJINizd5RqaA.jpg",
    emojis: "🏑🇮🇳🏆",
    hint: "SRK coaches India's women's hockey team to World Cup glory",
  },
  {
    title: "SWADES",
    poster: "https://image.tmdb.org/t/p/w500/tCBzmto8hPVMBCOr7A4C7YHKGSL.jpg",
    emojis: "🚀🌾🇮🇳",
    hint: "NASA scientist returns to India and finds his roots",
  },
  {
    title: "BLACK",
    poster: "https://image.tmdb.org/t/p/w500/f6MDXi4aMYJNLiG28YMqJPwRWcK.jpg",
    emojis: "🖤🕯️🤲",
    hint: "Amitabh Bachchan teaches a deaf-blind girl about life and love",
  },
  {
    title: "BRAHMASTRA",
    poster: "https://image.tmdb.org/t/p/w500/7gLPIYdBSSi8WFSMNBBkMzBzE3B.jpg",
    emojis: "🔱🔥✨",
    hint: "Ranbir Kapoor discovers he has a connection to an ancient celestial weapon",
  },
  {
    title: "ROCKY AUR RANI",
    poster: "https://image.tmdb.org/t/p/w500/duxSyMSdBE89Zya5L3KfGTepI4E.jpg",
    emojis: "💪💃💑",
    hint: "A Punjabi dude and a Bengali journalist fall in love",
  },
  {
    title: "DUNKI",
    poster: "https://image.tmdb.org/t/p/w500/6FJxiKPkPMa5Qu6oHK1G8K5tnXy.jpg",
    emojis: "🛂✈️💔",
    hint: "SRK helps friends illegally immigrate to London — the donkey route",
  },
  {
    title: "ADIPURUSH",
    poster: "https://image.tmdb.org/t/p/w500/b4gYVcl8pParX7bHQHFpDPNqhpW.jpg",
    emojis: "🏹👹🌺",
    hint: "Prabhas as Ram in a CGI retelling of the Ramayana",
  },
  {
    title: "SOORARAI POTTRU",
    poster: "https://image.tmdb.org/t/p/w500/xnXBQSX0vCXuVk0XpJFDIVnNxKS.jpg",
    emojis: "✈️💪🌾",
    hint: "Suriya as a man who dreams of starting a low-cost airline",
  },
  {
    title: "JAI BHIM",
    poster: "https://image.tmdb.org/t/p/w500/ql12hj8VNuvUVBKY7Mn5bFVaVAe.jpg",
    emojis: "⚖️✊🩸",
    hint: "Suriya as a lawyer fighting caste discrimination in 1990s India",
  },
  {
    title: "KAITHI",
    poster: "https://image.tmdb.org/t/p/w500/nmGWzTLMXy9x7mKd8NKPLmHtWGa.jpg",
    emojis: "🚗🌃🔫",
    hint: "Karthi fights drug gangs through a single night to meet his daughter",
  },
  {
    title: "PONNIYIN SELVAN",
    poster: "https://image.tmdb.org/t/p/w500/dkJqKEaBbfb8H1PCsjVqxpfcNBQ.jpg",
    emojis: "👑🏰🌊",
    hint: "Epic Chola empire saga — Mani Ratnam's magnum opus",
  },
  {
    title: "PUSHPA 2",
    poster: "https://image.tmdb.org/t/p/w500/2Yy0XUjB8WJDiJzOTAKyXsRj3T8.jpg",
    emojis: "🌺🔥👑",
    hint: "Allu Arjun returns — 'Pushpa The Rule', bigger and more brutal",
  },
  {
    title: "DEVDAS",
    poster: "https://image.tmdb.org/t/p/w500/pSqtMjbj74NJLWR2PY1QxdPmMjM.jpg",
    emojis: "🍷💔🥀",
    hint: "SRK drowns his heartbreak in alcohol — tragic love triangle",
  },
  {
    title: "MUGHAL-E-AZAM",
    poster: "https://image.tmdb.org/t/p/w500/4WkI1Wy6WNBFy70Sp6iyFMzn9cY.jpg",
    emojis: "👑🌺⚔️",
    hint: "Dilip Kumar as Salim, son of Akbar, in love with a dancer",
  },
  {
    title: "DRISHYAM",
    poster: "https://image.tmdb.org/t/p/w500/aFhEj76O3d3Mfc0FeiiGqHDnN8g.jpg",
    emojis: "🎬👁️🏠",
    hint: "A cable TV man protects his family from murder investigation",
  },
  {
    title: "QUEEN",
    poster: "https://image.tmdb.org/t/p/w500/9rvYP2VFBV1BPt5gXFmJQNpGHuL.jpg",
    emojis: "👸🌍💃",
    hint: "Kangana Ranaut goes on her honeymoon alone after being dumped",
  },
  {
    title: "PINK",
    poster: "https://image.tmdb.org/t/p/w500/bMPj6bHEBpf0WQBH7RjNa6qAoAT.jpg",
    emojis: "🩷⚖️✊",
    hint: "Amitabh Bachchan defends three women against sexual harassment charges",
  },
  {
    title: "SPECIAL 26",
    poster: "https://image.tmdb.org/t/p/w500/vRrJBBTWAQ1L2NLfXTqDmcD0Rk4.jpg",
    emojis: "🏦🎭👮",
    hint: "Akshay Kumar leads fake CBI officers who rob corrupt businessmen",
  },
];

export const MOVIES: MovieEntry[] = RAW.map((m) => ({
  ...m,
  jumbled: jumble(m.title),
}));

export function getMissingLetters(title: string): string {
  return missingLetters(title);
}

export function getRandomMovies(count: number = 5): MovieEntry[] {
  const shuffled = [...MOVIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
