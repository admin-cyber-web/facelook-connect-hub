export type QuoteCategory = "Motivational" | "Love" | "Sad" | "Dhokha" | "Romantic" | "Happy";
export type QuoteLang = "hindi" | "hinglish" | "english";

export interface Quote {
  id: number;
  text: string;
  category: QuoteCategory;
  lang: QuoteLang;
}

export const QUOTES: Quote[] = [
  // ── MOTIVATIONAL / HINDI ──────────────────────────────────────────────────
  { id: 1,  category: "Motivational", lang: "hindi",    text: "जो हार नहीं मानता, जीत उसी की होती है।" },
  { id: 2,  category: "Motivational", lang: "hindi",    text: "मंजिलें उन्हीं को मिलती हैं जिनके सपनों में जान होती है।" },
  { id: 3,  category: "Motivational", lang: "hindi",    text: "उठो, जागो और तब तक मत रुको जब तक लक्ष्य प्राप्त न हो जाए।" },
  { id: 4,  category: "Motivational", lang: "hindi",    text: "कठिनाइयाँ वो खजाना हैं जो मेहनत की चाबी से खुलते हैं।" },
  { id: 5,  category: "Motivational", lang: "hindi",    text: "हर रात के बाद सुबह आती है, हर तूफान के बाद शांति।" },
  { id: 6,  category: "Motivational", lang: "hindi",    text: "सफलता का कोई शॉर्टकट नहीं होता, बस मेहनत और लगन।" },

  // ── MOTIVATIONAL / HINGLISH ───────────────────────────────────────────────
  { id: 7,  category: "Motivational", lang: "hinglish", text: "Bhai, mushkilein aati hain toh life interesting hoti hai. Keep going!" },
  { id: 8,  category: "Motivational", lang: "hinglish", text: "Sapne bade rakho, tabhi duniya choti lagegi." },
  { id: 9,  category: "Motivational", lang: "hinglish", text: "Kal ke darr se aaj ki mehnat mat chod. Chal, uth ja!" },
  { id: 10, category: "Motivational", lang: "hinglish", text: "Jab sab chhod dete hain, tab bhi tum khud ka saath mat chodo." },
  { id: 11, category: "Motivational", lang: "hinglish", text: "Log kya sochenge — yeh sochna band karo, aur kuch kar ke dikhao." },
  { id: 12, category: "Motivational", lang: "hinglish", text: "Haar ke baad jo khada hota hai, wahi champion kehlata hai." },

  // ── MOTIVATIONAL / ENGLISH ────────────────────────────────────────────────
  { id: 13, category: "Motivational", lang: "english",  text: "The only way to do great work is to love what you do." },
  { id: 14, category: "Motivational", lang: "english",  text: "Every storm runs out of rain. Keep pushing forward." },
  { id: 15, category: "Motivational", lang: "english",  text: "Your greatest competition is who you were yesterday." },
  { id: 16, category: "Motivational", lang: "english",  text: "Don't count the days. Make the days count." },
  { id: 17, category: "Motivational", lang: "english",  text: "Stars can't shine without darkness. Embrace the struggle." },
  { id: 18, category: "Motivational", lang: "english",  text: "Success is not final, failure is not fatal — courage is what counts." },

  // ── LOVE / HINDI ─────────────────────────────────────────────────────────
  { id: 19, category: "Love", lang: "hindi",    text: "तुम्हारे बिना मेरी दुनिया अधूरी है, जैसे आसमान बिना तारों के।" },
  { id: 20, category: "Love", lang: "hindi",    text: "मोहब्बत वो नहीं जो दिखाई दे, मोहब्बत वो है जो महसूस हो।" },
  { id: 21, category: "Love", lang: "hindi",    text: "तुम्हारी एक मुस्कान मेरे हजार दर्द भुला देती है।" },
  { id: 22, category: "Love", lang: "hindi",    text: "इश्क में डूबना हो तो तुम्हारी आँखों में डूबना चाहता हूँ।" },
  { id: 23, category: "Love", lang: "hindi",    text: "कुछ रिश्ते शब्दों से नहीं, साँसों से महसूस होते हैं।" },
  { id: 24, category: "Love", lang: "hindi",    text: "तुम मेरी कहानी के वो हिस्से हो, जो सबसे खूबसूरत है।" },

  // ── LOVE / HINGLISH ──────────────────────────────────────────────────────
  { id: 25, category: "Love", lang: "hinglish", text: "Teri ek smile ke liye main kuch bhi kar sakta hoon, sach mein." },
  { id: 26, category: "Love", lang: "hinglish", text: "Pyaar karna asan nahi, par tujhse karna bohot easy lag raha hai." },
  { id: 27, category: "Love", lang: "hinglish", text: "Tum mere notifications se zyada important ho. Aur yeh baat serious hai." },
  { id: 28, category: "Love", lang: "hinglish", text: "Teri yaad aati hai toh dil kehta hai — kash tu yahan hoti." },
  { id: 29, category: "Love", lang: "hinglish", text: "Chhoti si baat hai par dil ki hai — tujhse mohabbat hai." },
  { id: 30, category: "Love", lang: "hinglish", text: "Duniya ki bheed mein bhi tujhe dhundh lunga, yeh waada hai." },

  // ── LOVE / ENGLISH ───────────────────────────────────────────────────────
  { id: 31, category: "Love", lang: "english",  text: "In a world full of people, my eyes will always search for you." },
  { id: 32, category: "Love", lang: "english",  text: "You are the first thought in my morning and the last in my night." },
  { id: 33, category: "Love", lang: "english",  text: "Loving you isn't just a feeling — it's my favourite habit." },
  { id: 34, category: "Love", lang: "english",  text: "Every love story is beautiful, but ours is my favourite." },
  { id: 35, category: "Love", lang: "english",  text: "You make ordinary moments feel extraordinary just by being there." },
  { id: 36, category: "Love", lang: "english",  text: "I fell in love with you in your silence, in your laughter, in your eyes." },

  // ── SAD / HINDI ──────────────────────────────────────────────────────────
  { id: 37, category: "Sad", lang: "hindi",    text: "अकेलापन कभी-कभी सबसे अच्छा दोस्त होता है — कम से कम धोखा नहीं देता।" },
  { id: 38, category: "Sad", lang: "hindi",    text: "दर्द बताना भी मुश्किल है उन्हें, जो दर्द देकर मुस्कुरा रहे हैं।" },
  { id: 39, category: "Sad", lang: "hindi",    text: "आँखें नम हैं पर होंठ मुस्कुरा रहे हैं — यही तो जिंदगी है।" },
  { id: 40, category: "Sad", lang: "hindi",    text: "जब अपने ही पराए हो जाएं, तो दुनिया बहुत बड़ी लगने लगती है।" },
  { id: 41, category: "Sad", lang: "hindi",    text: "वो चले गए और एक खालीपन छोड़ गए जो शायद कभी न भरे।" },
  { id: 42, category: "Sad", lang: "hindi",    text: "रात जितनी लंबी होती है, सुबह की रोशनी उतनी ही प्यारी होती है।" },

  // ── SAD / HINGLISH ───────────────────────────────────────────────────────
  { id: 43, category: "Sad", lang: "hinglish", text: "Kuch dard aisa hota hai jo sirf raat ko aata hai jab sab so rahe hote hain." },
  { id: 44, category: "Sad", lang: "hinglish", text: "Hasna padta hai kyunki rona toh koi samjhega nahi." },
  { id: 45, category: "Sad", lang: "hinglish", text: "Akela hoon lekin tang nahi — bas thoda sa dard hai jo andar rehta hai." },
  { id: 46, category: "Sad", lang: "hinglish", text: "Unhe yaad karte karte neend aa jati hai, wahi buri baat hai." },
  { id: 47, category: "Sad", lang: "hinglish", text: "Zindagi ne sikhaya — jo tumse pyaar kare, wahi chhod bhi jaata hai." },
  { id: 48, category: "Sad", lang: "hinglish", text: "Thakaan sirf body mein nahi hoti, dil bhi thak jaata hai kabhi kabhi." },

  // ── SAD / ENGLISH ────────────────────────────────────────────────────────
  { id: 49, category: "Sad", lang: "english",  text: "Sometimes you smile not because you're happy, but because no one cares why you're sad." },
  { id: 50, category: "Sad", lang: "english",  text: "The heaviest thing to carry is a heart full of unsaid words." },
  { id: 51, category: "Sad", lang: "english",  text: "Missing someone is the loneliest feeling — especially when they're still here." },
  { id: 52, category: "Sad", lang: "english",  text: "I'm not broken. I'm just tired of being okay when I'm not." },
  { id: 53, category: "Sad", lang: "english",  text: "The saddest word in the world is 'almost'." },
  { id: 54, category: "Sad", lang: "english",  text: "Pain changes people — but it also reveals who they truly are." },

  // ── DHOKHA / HINDI ───────────────────────────────────────────────────────
  { id: 55, category: "Dhokha", lang: "hindi",    text: "धोखा उसी से मिलता है जिस पर सबसे ज्यादा यकीन होता है।" },
  { id: 56, category: "Dhokha", lang: "hindi",    text: "जो रोज मिलते थे, आज अनजान हो गए — यही धोखे की तस्वीर है।" },
  { id: 57, category: "Dhokha", lang: "hindi",    text: "भरोसा टूटने के बाद रिश्ता जुड़ता तो है, पर वो पहले जैसा नहीं रहता।" },
  { id: 58, category: "Dhokha", lang: "hindi",    text: "नकाब पहनने वाले बहुत मिले, असली चेहरा बहुत कम।" },
  { id: 59, category: "Dhokha", lang: "hindi",    text: "उसने आँखें बंद करके विश्वास किया, उसने आँखें खुली रखकर धोखा दिया।" },
  { id: 60, category: "Dhokha", lang: "hindi",    text: "जिसे दिल का राज दिया, उसी ने दिल को तार-तार किया।" },

  // ── DHOKHA / HINGLISH ────────────────────────────────────────────────────
  { id: 61, category: "Dhokha", lang: "hinglish", text: "Yaaron ne yaarana nibhaya nahi — yeh toh sochna hi band karo ab." },
  { id: 62, category: "Dhokha", lang: "hinglish", text: "Jis par itna trust kiya tha, usne wahi chiz tod di — dil." },
  { id: 63, category: "Dhokha", lang: "hinglish", text: "Bura nahi maanta dhokhe ka, par apna saath chhod gaya — yeh bura laga." },
  { id: 64, category: "Dhokha", lang: "hinglish", text: "Galti meri nahi thi, bas main sahi insaan ko galat samjhta raha." },
  { id: 65, category: "Dhokha", lang: "hinglish", text: "Dil se diya tha, woh hassi se liya aur chale gaye." },
  { id: 66, category: "Dhokha", lang: "hinglish", text: "Ab trust karna seekh raha hoon — slowly, carefully, and never blindly." },

  // ── DHOKHA / ENGLISH ─────────────────────────────────────────────────────
  { id: 67, category: "Dhokha", lang: "english",  text: "The worst kind of betrayal comes wrapped in trust and smiling eyes." },
  { id: 68, category: "Dhokha", lang: "english",  text: "I gave you my truth, and you used it against me. Lesson learned." },
  { id: 69, category: "Dhokha", lang: "english",  text: "Not everyone who stays is loyal. Not everyone who leaves is gone." },
  { id: 70, category: "Dhokha", lang: "english",  text: "They smiled in front and stabbed behind. That's how it ends sometimes." },
  { id: 71, category: "Dhokha", lang: "english",  text: "Betrayal doesn't break you — it reveals exactly who you should trust next time." },
  { id: 72, category: "Dhokha", lang: "english",  text: "Once trust is broken, the silence speaks louder than any apology." },

  // ── ROMANTIC / HINDI ─────────────────────────────────────────────────────
  { id: 73, category: "Romantic", lang: "hindi",    text: "तुम्हारी आँखों में खोना, मेरा सबसे पसंदीदा शौक है।" },
  { id: 74, category: "Romantic", lang: "hindi",    text: "तुम हो तो हर लम्हा खास लगता है, चाहे कुछ हो या ना हो।" },
  { id: 75, category: "Romantic", lang: "hindi",    text: "तुम्हारे साथ बैठना, कुछ ना करते हुए भी बहुत कुछ पाना लगता है।" },
  { id: 76, category: "Romantic", lang: "hindi",    text: "प्यार में डूबने का यही तरीका है — बस महसूस करो, सोचो मत।" },
  { id: 77, category: "Romantic", lang: "hindi",    text: "तुम्हारे हाथ थामे हुए लगता है, दुनिया की हर मुश्किल आसान है।" },
  { id: 78, category: "Romantic", lang: "hindi",    text: "हर सुबह तुम्हारे नाम से शुरू हो, यही मेरी दुआ है।" },

  // ── ROMANTIC / HINGLISH ──────────────────────────────────────────────────
  { id: 79, category: "Romantic", lang: "hinglish", text: "Tere saath chai peena — ye moment kisi luxury se kam nahi." },
  { id: 80, category: "Romantic", lang: "hinglish", text: "Teri awaaz sunne ke liye kaafi hoon main. Kuch bolna nahi parta." },
  { id: 81, category: "Romantic", lang: "hinglish", text: "Baarish mein tere saath bheegna — yaar, yeh toh dream scene hai." },
  { id: 82, category: "Romantic", lang: "hinglish", text: "Tu paas ho toh duniya ki shor bhi music lagti hai." },
  { id: 83, category: "Romantic", lang: "hinglish", text: "Tere bina photos achhi lagti hain, par teri smile se lagti hain perfect." },
  { id: 84, category: "Romantic", lang: "hinglish", text: "Raat ko teri baatein sun sun ke neend aati hai — yeh love hai bhai." },

  // ── ROMANTIC / ENGLISH ───────────────────────────────────────────────────
  { id: 85, category: "Romantic", lang: "english",  text: "Let's grow old arguing about silly things and loving each other fiercely." },
  { id: 86, category: "Romantic", lang: "english",  text: "You're the plot twist I never saw coming but always needed." },
  { id: 87, category: "Romantic", lang: "english",  text: "Holding your hand feels like the world finally makes sense." },
  { id: 88, category: "Romantic", lang: "english",  text: "Every night ends, but the thought of you stays all morning." },
  { id: 89, category: "Romantic", lang: "english",  text: "You are my favourite distraction, my sweetest chaos." },
  { id: 90, category: "Romantic", lang: "english",  text: "We don't need a perfect moment — we just need each other." },

  // ── HAPPY / HINDI ────────────────────────────────────────────────────────
  { id: 91,  category: "Happy", lang: "hindi",    text: "खुशियाँ छोटी-छोटी होती हैं, बस उन्हें देखने की नज़र होनी चाहिए।" },
  { id: 92,  category: "Happy", lang: "hindi",    text: "हँसते रहो, क्योंकि यह दुनिया की सबसे बड़ी ताकत है।" },
  { id: 93,  category: "Happy", lang: "hindi",    text: "आज का दिन खुशियों के नाम — कल की चिंता कल करेंगे।" },
  { id: 94,  category: "Happy", lang: "hindi",    text: "जिंदगी में मुस्कुराते रहो — यही सबसे बड़ी जीत है।" },
  { id: 95,  category: "Happy", lang: "hindi",    text: "जो है वो काफी है, जो होगा वो और अच्छा होगा।" },
  { id: 96,  category: "Happy", lang: "hindi",    text: "हर पल को जियो — जिंदगी एक बार ही मिलती है।" },

  // ── HAPPY / HINGLISH ─────────────────────────────────────────────────────
  { id: 97,  category: "Happy", lang: "hinglish", text: "Aaj ka din tera hai — aaj khub haans aur kha, kal ki chinta mat kar." },
  { id: 98,  category: "Happy", lang: "hinglish", text: "Khushi chhoti cheez mein hai — chai, dost aur thodi dhoop." },
  { id: 99,  category: "Happy", lang: "hinglish", text: "Zindagi chhoti hai yaar, isliye bada soch, bada khaa aur bada hass." },
  { id: 100, category: "Happy", lang: "hinglish", text: "Jo hua, sahi hua. Jo ho raha hai, mast ho raha hai. Life is good!" },
  { id: 101, category: "Happy", lang: "hinglish", text: "Apni khushi khud banao — dusron pe depend mat karo." },
  { id: 102, category: "Happy", lang: "hinglish", text: "Good vibes only. Tension ko bolo — bye bye!" },

  // ── HAPPY / ENGLISH ──────────────────────────────────────────────────────
  { id: 103, category: "Happy", lang: "english",  text: "Choose joy. Not because life is perfect, but because it's worth it." },
  { id: 104, category: "Happy", lang: "english",  text: "Happiness is homemade — build it every single day." },
  { id: 105, category: "Happy", lang: "english",  text: "Life is short. Eat the cake. Laugh too loud. Love too deep." },
  { id: 106, category: "Happy", lang: "english",  text: "Good things are coming. Keep the door open and the vibes high." },
  { id: 107, category: "Happy", lang: "english",  text: "Today I choose happiness. Not because everything is perfect, but because I am." },
  { id: 108, category: "Happy", lang: "english",  text: "Smile — it's free and it looks good on everyone." },
];

export const CATEGORIES: QuoteCategory[] = ["Motivational", "Love", "Sad", "Dhokha", "Romantic", "Happy"];
export const LANGS: { key: QuoteLang; label: string }[] = [
  { key: "hindi",    label: "हिंदी" },
  { key: "hinglish", label: "Hinglish" },
  { key: "english",  label: "English" },
];

export function filterQuotes(category: QuoteCategory, lang: QuoteLang): Quote[] {
  return QUOTES.filter((q) => q.category === category && q.lang === lang);
}
