export type QuizCategory = "bollywood" | "math" | "birds" | "songs";

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  question: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
}

export const ALL_QUESTIONS: QuizQuestion[] = [
  // ── BOLLYWOOD (12) ─────────────────────────────────────────────────────────
  {
    id: "b1", category: "bollywood",
    question: "\"DDLJ\" mein Shah Rukh Khan ka character ka naam kya tha?",
    options: ["Rahul", "Raj", "Rohan", "Rajan"], correct: 1,
  },
  {
    id: "b2", category: "bollywood",
    question: "\"Sholay\" mein Gabbar Singh ka iconic dialogue kaun sa hai?",
    options: ["Jai Maharashtra!", "Kitne Aadmi The?", "Mogambo Khush Hua", "Don Ko Pakadna Mushkil"], correct: 1,
  },
  {
    id: "b3", category: "bollywood",
    question: "\"3 Idiots\" mein Aamir Khan ka character ka naam?",
    options: ["Farhan", "Raju", "Rancho", "Virus"], correct: 2,
  },
  {
    id: "b4", category: "bollywood",
    question: "\"Dangal\" mein Aamir Khan ne kiska role play kiya?",
    options: ["Milkha Singh", "Mahavir Singh Phogat", "MS Dhoni", "Dara Singh"], correct: 1,
  },
  {
    id: "b5", category: "bollywood",
    question: "\"RRR\" ka director kaun hai?",
    options: ["Karan Johar", "Rohit Shetty", "SS Rajamouli", "Sanjay Leela Bhansali"], correct: 2,
  },
  {
    id: "b6", category: "bollywood",
    question: "\"Animal\" (2023) mein Ranbir Kapoor ne kiska role play kiya?",
    options: ["Ranvijay", "Arjun", "Rocky", "Kabir"], correct: 0,
  },
  {
    id: "b7", category: "bollywood",
    question: "\"Naatu Naatu\" song kaun si film se hai jisne Oscar jeeta?",
    options: ["Bahubali", "KGF", "RRR", "Pushpa"], correct: 2,
  },
  {
    id: "b8", category: "bollywood",
    question: "\"Bahubali 2\" mein Kattappa ne Bahubali ko kyun maara?",
    options: ["Dhoka kiya", "Rani ke orders the", "Usse nafrat thi", "Bimaar tha"], correct: 1,
  },
  {
    id: "b9", category: "bollywood",
    question: "\"Pushpa: The Rise\" mein Allu Arjun ka character kya karta hai?",
    options: ["Police Inspector", "Red sandalwood smuggler", "Politician", "Farmer"], correct: 1,
  },
  {
    id: "b10", category: "bollywood",
    question: "\"KGF Chapter 2\" ka villain kaun tha?",
    options: ["Sanjay Dutt (Adheera)", "Bobby Deol (Vijayendra)", "Raveena Tandon", "Prakash Raj"], correct: 0,
  },
  {
    id: "b11", category: "bollywood",
    question: "\"Jawan\" (2023) mein SRK ne kul kitne characters play kiye?",
    options: ["1", "2", "3", "4"], correct: 1,
  },
  {
    id: "b12", category: "bollywood",
    question: "\"Pathaan\" mein Shah Rukh Khan ke saath kaun se 2 stars hain?",
    options: ["Deepika & John", "Katrina & Salman", "Alia & Hrithik", "Anushka & Tiger"], correct: 0,
  },

  // ── MATH EASY (12) ─────────────────────────────────────────────────────────
  {
    id: "m1", category: "math",
    question: "15 × 4 = ?",
    options: ["50", "55", "60", "65"], correct: 2,
  },
  {
    id: "m2", category: "math",
    question: "100 − 37 = ?",
    options: ["53", "63", "73", "57"], correct: 1,
  },
  {
    id: "m3", category: "math",
    question: "8 × 9 = ?",
    options: ["63", "72", "81", "56"], correct: 1,
  },
  {
    id: "m4", category: "math",
    question: "√144 (144 ka square root) = ?",
    options: ["10", "11", "12", "14"], correct: 2,
  },
  {
    id: "m5", category: "math",
    question: "200 ka 25% kitna hoga?",
    options: ["25", "40", "50", "75"], correct: 2,
  },
  {
    id: "m6", category: "math",
    question: "1000 ÷ 25 = ?",
    options: ["30", "35", "40", "45"], correct: 2,
  },
  {
    id: "m7", category: "math",
    question: "3² + 4² = ?",
    options: ["23", "25", "49", "7"], correct: 1,
  },
  {
    id: "m8", category: "math",
    question: "7 × 7 × 7 = ?",
    options: ["343", "147", "441", "49"], correct: 0,
  },
  {
    id: "m9", category: "math",
    question: "50 + 50 + 50 + 50 = ?",
    options: ["150", "200", "250", "300"], correct: 1,
  },
  {
    id: "m10", category: "math",
    question: "Ek ghante mein kitne minutes hote hain?",
    options: ["50", "60", "90", "100"], correct: 1,
  },
  {
    id: "m11", category: "math",
    question: "12 × 12 = ?",
    options: ["132", "144", "124", "148"], correct: 1,
  },
  {
    id: "m12", category: "math",
    question: "500 + 250 + 125 = ?",
    options: ["825", "875", "775", "900"], correct: 1,
  },

  // ── BIRDS (8) ──────────────────────────────────────────────────────────────
  {
    id: "p1", category: "birds",
    question: "India ka Rashtriya Pakshi (National Bird) kaun hai?",
    options: ["Tota (Parrot)", "Mor (Peacock)", "Kauwa (Crow)", "Kabutar (Pigeon)"], correct: 1,
  },
  {
    id: "p2", category: "birds",
    question: "Kaun sa pakshi raat mein sabse achha dekhta hai?",
    options: ["Eagle", "Flamingo", "Owl (Ullu)", "Penguin"], correct: 2,
  },
  {
    id: "p3", category: "birds",
    question: "Duniya ka sabse bada pakshi kaun hai?",
    options: ["Eagle", "Ostrich (Shuturmurg)", "Flamingo", "Condor"], correct: 1,
  },
  {
    id: "p4", category: "birds",
    question: "Kaun sa pakshi insaan ki tarah bol sakta hai?",
    options: ["Sparrow", "Crow", "Parrot (Tota)", "Pigeon"], correct: 2,
  },
  {
    id: "p5", category: "birds",
    question: "Flamingo ka rang kaisa hota hai?",
    options: ["White (Safed)", "Yellow (Peela)", "Pink (Gulaabi)", "Blue (Neela)"], correct: 2,
  },
  {
    id: "p6", category: "birds",
    question: "Sabse tez udne wala pakshi kaun hai?",
    options: ["Eagle", "Peregrine Falcon", "Sparrow", "Hummingbird"], correct: 1,
  },
  {
    id: "p7", category: "birds",
    question: "Penguin kahan rehta hai?",
    options: ["Amazon Jungle", "Sahara Desert", "Antarctica", "Himalaya"], correct: 2,
  },
  {
    id: "p8", category: "birds",
    question: "Hummingbird (Shaheen) kya peeti/khati hai?",
    options: ["Insects only", "Seeds", "Flowers ka nectar", "Fish"], correct: 2,
  },

  // ── TRENDING SONGS (8) ─────────────────────────────────────────────────────
  {
    id: "s1", category: "songs",
    question: "\"Kesariya\" song kaun si movie se hai?",
    options: ["Rocky Aur Rani", "Brahmastra", "Pathaan", "Animal"], correct: 1,
  },
  {
    id: "s2", category: "songs",
    question: "\"Srivalli\" song kaun si film ka hai?",
    options: ["RRR", "Bahubali", "Pushpa: The Rise", "KGF"], correct: 2,
  },
  {
    id: "s3", category: "songs",
    question: "\"Naatu Naatu\" song kisne gaya?",
    options: ["Anirudh & Devi Sri Prasad", "MM Keeravani & Rahul Sipligunj", "A.R. Rahman & Udit Narayan", "Pritam & Arijit Singh"], correct: 1,
  },
  {
    id: "s4", category: "songs",
    question: "\"Arjan Vailly\" song kaun si movie ka hai?",
    options: ["Jawan", "Animal", "Dunki", "Gadar 2"], correct: 1,
  },
  {
    id: "s5", category: "songs",
    question: "\"Jhoome Jo Pathaan\" song kaun si film se hai?",
    options: ["Tiger 3", "War 2", "Pathaan", "Jawan"], correct: 2,
  },
  {
    id: "s6", category: "songs",
    question: "\"Oo Antava\" song Pushpa mein kisne gaya?",
    options: ["Deepika Padukone", "Pooja Hegde", "Samantha Ruth Prabhu", "Rashmika Mandanna"], correct: 2,
  },
  {
    id: "s7", category: "songs",
    question: "\"Deva Deva\" song kaun si film se hai?",
    options: ["War", "Brahmastra", "Shershaah", "83"], correct: 1,
  },
  {
    id: "s8", category: "songs",
    question: "\"Kaavaalaa\" song kaun si film se hai?",
    options: ["Leo", "Vikram", "Jailer", "Master"], correct: 2,
  },
];

/** Deterministic shuffle using session ID as seed — both players get same order */
export function seededQuestions(sessionId: string, count = 10): QuizQuestion[] {
  let seed = 0;
  for (let i = 0; i < sessionId.length; i++) {
    seed = (seed * 31 + sessionId.charCodeAt(i)) >>> 0;
  }
  const shuffled = [...ALL_QUESTIONS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export const CATEGORY_LABELS: Record<QuizCategory, string> = {
  bollywood: "🎬 Bollywood",
  math:      "🔢 Math",
  birds:     "🦅 Birds",
  songs:     "🎵 Songs",
};

export const CATEGORY_COLORS: Record<QuizCategory, string> = {
  bollywood: "from-pink-600 to-purple-700",
  math:      "from-blue-600 to-cyan-500",
  birds:     "from-green-500 to-teal-600",
  songs:     "from-yellow-500 to-orange-600",
};
