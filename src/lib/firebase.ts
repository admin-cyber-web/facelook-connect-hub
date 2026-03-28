import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "",
  authDomain: "facelook-live.firebaseapp.com",
  projectId: "facelook-live",
  storageBucket: "facelook-live.firebasestorage.app",
  messagingSenderId: "844647356037",
  appId: "1:844647356037:web:fb3e6ca99fce076953bbec",
  measurementId: "G-YPEPB6V901",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Services (ताकि हम इन्हें कहीं भी Use कर सकें)
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
