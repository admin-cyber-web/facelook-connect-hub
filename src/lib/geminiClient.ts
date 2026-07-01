import { GoogleGenerativeAI } from "@google/generative-ai";

export type QuoteCategory =
  | "Motivational"
  | "Comedy"
  | "Jokes"
  | "Love"
  | "Dhokha"
  | "Sad"
  | "Attitude"
  | "MothersDay"
  | "FathersDay"
  | "Birthday"
  | "Anniversary"
  | "Festive";

export type QuoteLanguage = "English" | "Hindi" | "Hinglish";

// ── 100% OFFLINE PREMIUM QUOTES DATABASE ──
const FLICKS_INDIA_QUOTES: Record<
  QuoteCategory,
  Record<QuoteLanguage, string[]>
> = {
  Motivational: {
    Hindi: [
      "जीवन में शांति चाहते हैं तो दूसरों की शिकायतें करने से बेहतर है खुद को बदल लें।",
      "जीतने का असली मज़ा तब आता है, जब सब आपके हारने का इंतज़ार कर रहे हों।",
      "सफलता शक्ल देखकर नहीं, कड़ा परिश्रम और पागलपन देखकर कदम चूमती है।",
      "आज जो दर्द तुम महसूस कर रहे हो, कल wo तुम्हारी सबसे बड़ी ताकत बनेगा।",
      "मंजिलें उन्हीं को मिलती हैं जिनके सपनों में जान होती है, पंखों से कुछ नहीं होता हौसलों से उड़ान होती है।",
    ],
    Hinglish: [
      "Zindagi me shanti chahte ho to doosron ko nahi, khud ko badalna shuru karo.",
      "Jeetne ka asli mazaa tab hai, jab poori duniya aapke haarne ka wait kar rahi ho.",
      "Waqt badalna hai to khud ko mehnat ki bhatti me jhonkna padega, baithne se kuch nahi hoga.",
      "Koshish aisi karo ki haarte-haarte kab jeet jao, pata bhi na chale.",
      "Sapne wo nahi jo hum sote waqt dekhte hain, sapne wo hain jo humein sone nahi dete.",
    ],
    English: [
      "Push yourself, because no one else is going to do it for you. Your time is now.",
      "Great things never come from comfort zones. Stay hungry, stay foolish, and dominate.",
      "Success isn't just about what you accomplish, it's about what you inspire others to do.",
      "Hard work beats talent when talent fails to work hard. Keep grinding.",
      "Don't stop when you are tired. Stop when you are completely done.",
    ],
  },
  Sad: {
    Hindi: [
      "शीशा और दिल दोनों ही टूट कर बिखर जाते हैं, फर्क बस इतना है कि शीशा चुभता है और दिल रोता है।",
      "बड़ी अजीब है ये दुनिया, यहाँ झूठ बोलने से नहीं बल्कि सच बोलने से रिश्ते टूट जाते हैं।",
      "कहाँ खो गए वो दिन जब हम मुस्कुराया करते थे, अब तो बस यादों के साये में वक्त गुज़ारते हैं।",
      "दिखावे की मोहब्बत से दूर रहता हूँ, इसीलिए अक्सर अकेला और खामोश रहता हूँ।",
      "दिल को बहलाने का हुनर सीख लिया हमने, रोते हुए भी मुस्कुराने का हुनर सीख लिया हमने।",
    ],
    Hinglish: [
      "Sheesha aur dil dono hi toot kar bikharte hain, bas sheesha aankhon me chubhta hai aur dil andar se rota hai.",
      "Kash tum samajh paate is dil ki bebasi ko, jise tumne apna keh kar hi paraya kar diya.",
      "Zindagi me kuch zakhm aise hote hain jo kabhi nahi bharte, bas unhe chhupane ki aadat ho jaati hai.",
      "Mohabbat ka toh pata nahi par tumne rona achhe se sikha diya.",
      "Ajeeb rishta raha hamara, paas reh kar bhi dooriyan kam na ho saki.",
    ],
    English: [
      "The hardest part about walking away from someone is when you realize they won't follow you.",
      "It's sad how quickly people can become strangers after sharing absolutely everything together.",
      "Sometimes the people who used to make you feel so special, now make you feel so unwanted.",
      "Behind every fake smile is a breaking heart that no one will ever understand.",
      "Trying to forget someone you love is like trying to remember someone you never met.",
    ],
  },
  Attitude: {
    Hindi: [
      "हुकूमत वो नहीं जो डरा कर की जाए, हुकूमत वो है जो दिलों पर राज करे।",
      "हम अपनी रियासत के राजा खुद हैं, किसी की चापलूसी करना हमारे खून में नहीं।",
      "अंदाज़ कुछ अलग है मेरा, सब को पसंद आ जाऊं इतना आम नहीं हूँ मैं।",
      "शोर करने से नाम नहीं बनता, काम ऐसा करो कि खामोशी भी अखबारों में छप जाए।",
      "पीठ पीछे कौन क्या बोलता है फर्क नहीं पड़ता, सामने किसी का मुंह नहीं खुलता यही काफी है।",
    ],
    Hinglish: [
      "Hukumat wo nahi jo darr ke bal par ki jaye, asli raja wo hai jo sabke dilon par raj kare.",
      "Apni sharton par jeete hain hum, kisi ke ishare par chalna hamari fitrat me nahi.",
      "Mera attitude meri knowledge aur self-respect ka reflection hai, arrogance ka nahi.",
      "Naam aur pehchan chahe chhoti ho, par khud ke dum par honi chahiye.",
      "Hum unme se nahi jo rasta badal lete hain, hum wo hain jo rasta bana dete hain.",
    ],
    English: [
      "I don't race, I don't compete. I am the standard and I set my own rules.",
      "My attitude is high, my standards are premium, and your opinion doesn't matter.",
      "They talk about me because if they spoke about themselves, nobody would listen.",
      "Be a game changer, the world is already full of ordinary players.",
      "Excellence is not a skill, it's an attitude that defines who you are.",
    ],
  },
  Love: {
    Hindi: [
      "तुम मिले तो लगा जैसे अधूरी दुआ पूरी हो गई, धड़कन को जीने की नई वजह मिल गई।",
      "सच्ची मोहब्बत रूह से होती है, जिस्म पर मरने वाले तो हर मोड़ पर मिल जाते हैं।",
      "प्यार वो नहीं जो जताने से मिले, प्यार वो है जो बिना कहे सब कुछ समझ जाए।",
      "तेरी हर अदा खूबसूरत है, जैसे दरिया का कोई हसीन और शांत किनारा हो।",
      "ज़िंदगी बहुत खूबसूरत है अगर साथ निभाने वाला दिल से सच्चा हो।",
    ],
    Hinglish: [
      "Tum mile to laga jaise koi bhatki hui dua poori ho gayi, is dil ko jeene ki wajah mil gayi.",
      "Mohabbat rooh se honi chahiye, jism par marne wale to har mod par mil jaate hain.",
      "Tere bina zindagi me koi khushi nahi, tu sath hai toh har dukh bhi pyara lagta hai.",
      "Kuch log itne khas hote hain ki unse door reh kar bhi dil unke hi paas rehta hai.",
      "Sachi mohabbat me shartein nahi hoti, bas ek doosre ke liye beintehaa fikar hoti hai.",
    ],
    English: [
      "You are my today and all of my tomorrows. In your presence, I find my complete peace.",
      "True love isn't something you find, it is something you build together, line by line.",
      "Every time I look into your eyes, I see my entire universe staring right back at me.",
      "To love and be loved by you is the greatest privilege in this world.",
      "In a world full of temporary trends, you are my permanent comforting reality.",
    ],
  },
  Dhokha: {
    Hindi: [
      "भरोसा सब पर करो पर सावधानी के साथ, क्योंकि कभी-कभी खुद के दांत भी जीभ को काट लेते हैं।",
      "धोखा देकर तो बच जाओगे दुनिया की नज़रों से, पर खुद के ज़मीर को क्या जवाब दोगे।",
      "गैरों ने तो सिर्फ वार किया था, पर पीठ पर खंजर अपनों ने ही उतारा था।",
    ],
    Hinglish: [
      "Dhokha hamesha wahi dete hain jinpar hum aankhein band karke sabse zyada bharosa karte hain.",
      "Waqt ne sikha diya ki har muskurata chehra apna nahi hota, dhokha aahiste se aata hai.",
      "Unka badalna toh samajh aata hai, par unka dhokha dena dil bardasht nahi kar pata.",
    ],
    English: [
      "The saddest thing about betrayal and cheating is that it never comes from your enemies.",
      "Trust takes years to build, seconds to break, and a lifetime to repair.",
      "They didn't just cheat on me; they destroyed the beautiful meaning of love for me.",
    ],
  },
  Comedy: {
    Hindi: ["ज़िंदगी में बस एक ही दुःख है, सुबह नींद नहीं आती..."],
    Hinglish: [
      "Zindagi me bas ek hi dukh hai, subah uthte waqt neend aati hai aur raat ko sote waqt gayab ho jaati hai.",
      "Ghar wale bolte hain jaldi utha karo, ab unhe kaun samjhaye ki bistar se mohahbat gehri hai.",
    ],
    English: [
      "My bed is a magical place where I suddenly remember everything I was supposed to do.",
      "I am not lazy, I am just on energy-saving mode to protect the environment.",
    ],
  },
  Jokes: {
    Hindi: [
      "टीचर: न्यूटन का नियम बताओ? छात्र: सर, न्यूटन पेड़ के नीचे बैठा था, सेब गिरा, नियम बन गया। अगर नारियल गिरता तो किस्सा ही खत्म था!",
      "पप्पू ने डॉक्टर से पूछा: क्या वजन कम करने के लिए कोई आसान तरीका है? डॉक्टर: बस अपनी गर्दन दाएं से बाएं हिलाएं जब कोई खाने को पूछे!",
    ],
    Hinglish: [
      "Teacher: Newton ka niyam batao? Pappu: Sir agar Apple ki jagah Coconut gira hota toh physics ka kissa hi khatam tha!",
      "Doctor: Weight kam karne ke liye gardan left aur right hila liya karo. Patient: Kab doctor saab? Doctor: Jab koi khane ko pooche!",
    ],
    English: [
      "Teacher: Why are you late? Student: Because of a sign down the road. It said, 'School Ahead, Go Slow!'",
      "I told my doctor that I broke my arm in two places. He told me to stop going to those places.",
    ],
  },
  MothersDay: {
    Hindi: [
      "दवा जब बेअसर हो जाए तो वो नज़र उतारती है, माँ है साहब जो हार कर भी अपनी दुआओं से सब संवारती है।",
      "मांगने पर जहाँ हर मन्नत पूरी होती है, माँ के कदमों में ही वो जन्नत होती है।",
    ],
    Hinglish: [
      "Dawa jab be-asar ho jaye toh wo nazar utarti hai, Maa ki duayein hi har mushkil ko hamesha taalti hain.",
      "Jannat ka har gosha dekh liya maine, par sukoon jo Maa की गोद me mila wo kahi nahi mila.",
    ],
    English: [
      "A mother's love is the fuel that enables a normal human being to do the absolute impossible.",
      "God could not be everywhere, and therefore he made beautiful, loving mothers.",
    ],
  },
  FathersDay: {
    Hindi: ["पापा का साया जब तक सिर पर रहता है, दुनिया का हर रास्ता आसान...' "],
    Hinglish: [
      "Papa ka saya jab tak sar par hota hai, duniya ka har ek rasta aasan aur bekhauf lagta hai.",
      "Apni khushiyon ko bech kar jo bacho ke khwaab poore karta hai, use Pita kehte hain.",
    ],
    English: [
      "A father is neither an anchor to hold us back, nor a sail to take us there, but a guiding light whose love shows us the way.",
    ],
  },
  Birthday: {
    Hindi: [
      "खुदा करे आपको ज़िंदगी की हर खुशी मिले, कामयाबी की हर राह आपके कदमों के नीचे खिले। जन्मदिन मुबारक हो!",
      "यह खास दिन आपके जीवन में अपार खुशियां, अच्छी सेहत और तरक्की लेकर आए। हैप्पी बर्थडे!",
    ],
    Hinglish: [
      "Khuda kare aapko zindagi ki har khushi mile, aapka har sapna sach ho. Happy Birthday!",
      "Baar baar yeh din aaye, baar baar yeh dil gaaye, aap jiyo hazaaron saal, yahi hai meri aarzoo. Happy Birthday!",
    ],
    English: [
      "May this birthday bring you endless joy, peace, and massive success in everything you build. Happy Birthday!",
      "Wishing you a magnificent day filled with laughter, great blessings, and beautiful memories. Happy Birthday!",
    ],
  },
  Anniversary: {
    Hindi: [
      "आप दोनों की जोड़ी हमेशा सलामत रहे, प्यार और विश्वास से आपकी ज़िंदगी महकती रहे। शादी की सालगिरह मुबारक हो!",
      "दो दिलों का ये खूबसूरत सफर यूं ही चलता रहे, हर साल आपकी मोहब्बत का रंग और गहरा होता रहे।",
    ],
    Hinglish: [
      "Aap dono ki jodi hamesha salamat rahe, pyar aur vishwas se aapki zindagi mehakti rahe. Happy Anniversary!",
      "Safar mohabbat ka yuhi chalta rahe, saal-dar-saal aapki jodi aur majboot hoti rahe.",
    ],
    English: [
      "Wishing a perfect anniversary celebration to a perfect couple. May your love grow stronger with each passing year.",
    ],
  },
  Festive: {
    Hindi: ["त्योहारों की ये उमंग आपके घर में खुशहाली...' "],
    Hinglish: [
      "Tyoharon ki ye umang aapke ghar me khushali aur samriddhi laye. Aap sabhi ko dher saari shubhkamnayein!",
      "Deep jalte rahein, dilon me prem bana rahe, is paavan parv par sukh-shanti ka vaas rahe.",
    ],
    English: [
      "May the bright colors and divine lights of this festive season fill your life with eternal peace, prosperity, and joy.",
    ],
  },
};

const CONTEXT_FALLBACKS = [
  "सच्ची बातें हमेशा दिल को छूती हैं, बस समझने का नज़रिया होना चाहिए।",
  "Flicks India - Where community meets authenticity and real premium connections thrive.",
  "वक्त के साथ खुद को इतना बदल लो कि लोग तुम्हें पुराने अंदाज़ के लिए तरस जाएं।",
];

// ── 100% OFFLINE DATA SYSTEM ENGINE ──
export async function generateAIQuote(
  category: QuoteCategory = "Motivational",
  language: QuoteLanguage = "Hindi",
  contextText?: string,
): Promise<string> {
  const categoryData =
    FLICKS_INDIA_QUOTES[category] || FLICKS_INDIA_QUOTES["Motivational"];
  const quotesList =
    categoryData[language] || categoryData["Hindi"] || CONTEXT_FALLBACKS;

  if (contextText && contextText.trim().length > 0) {
    const searchWord = contextText.trim().toLowerCase();
    const matchedQuotes = quotesList.filter((q) =>
      q.toLowerCase().includes(searchWord),
    );

    if (matchedQuotes.length > 0) {
      const randomIndex = Math.floor(Math.random() * matchedQuotes.length);
      return matchedQuotes[randomIndex];
    }
  }

  const randomIndex = Math.floor(Math.random() * quotesList.length);
  return quotesList[randomIndex];
}

// ── CANVAS UTILS FOR GALLERY GRAPHICS PIPELINE ──
export interface RenderQuoteCanvasOptions {
  canvas: HTMLCanvasElement;
  imageSrc: string;
  text: string;
  textColor: string;
  fontSize: number;
  emoji?: string;
}

export function renderQuoteToCanvas(
  options: RenderQuoteCanvasOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    const { canvas, imageSrc, text, textColor, fontSize, emoji } = options;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      canvas.width = 600;
      canvas.height = 600;
      ctx.drawImage(img, 0, 0, 600, 600);

      // Readability Dark Shader Layer overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(0, 0, 600, 600);

      // Text Alignment System configuration
      ctx.fillStyle = textColor;
      ctx.font = `bold ${fontSize + 4}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const words = text.split(" ");
      let line = "";
      const lines = [];
      const maxWidth = 500;
      const lineHeight = fontSize + 12;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          lines.push(line);
          line = words[n] + " ";
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      let startY = 300 - ((lines.length - 1) * lineHeight) / 2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 300, startY);
        startY += lineHeight;
      }

      if (emoji) {
        ctx.font = "44px sans-serif";
        ctx.fillText(emoji, 300, startY + 36);
      }
      resolve(true);
    };
    img.onerror = () => resolve(false);
  });
}

export function resolveApiKey(): string {
  return (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
}

export function getClient(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(resolveApiKey());
}

export const getGeminiClient = () => {
  return getClient();
};

export const isGeminiConfigured = (): boolean => true;

// ── SEO METADATA GENERATOR ──
export interface PostSEO {
  meta_title: string;
  meta_description: string;
  seo_keywords: string;
}

export async function generatePostSEO(postContent: string): Promise<PostSEO> {
  const clean = postContent.trim().replace(/\s+/g, " ");
  return {
    meta_title:
      (clean ? clean.slice(0, 40) : "Trending Post") + " | Flicks India",
    meta_description: clean
      ? clean.slice(0, 150) + "..."
      : "Discover trending updates on Flicks India.",
    seo_keywords: "flicks india, social media, quotes app, trending, viral",
  };
}

// ── PERMANENT GOOGLE INDEXING PIPELINE ──
export async function submitToGoogleIndexing(url: string): Promise<boolean> {
  const token =
    process.env.GOOGLE_ACCESS_TOKEN ||
    import.meta.env.VITE_GOOGLE_ACCESS_TOKEN ||
    "";

  if (!token) {
    console.log(
      "[Indexing] ⚠️ Temporary Access Token not found in Secrets. Skipping.",
    );
    return false;
  }

  try {
    console.log(
      `[Indexing] 🚀 Submitting URL to Google via Access Token: ${url}`,
    );

    const response = await fetch(
      "https://indexing.googleapis.com/v3/urlNotifications:publish",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: url,
          type: "URL_UPDATED",
        }),
      },
    );

    const data = await response.json();

    if (response.ok) {
      console.log(`🎉 [Indexing] ✅ URL submitted to Google successfully!`);
      return true;
    } else {
      console.error(
        "[Indexing] ❌ Google API Error:",
        data.error?.message || data,
      );
      return false;
    }
  } catch (error) {
    console.error("[Indexing] ❌ Fetch Error:", error);
    return false;
  }
}
