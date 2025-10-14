import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

// Firebase configuration
// These are public config values - they're safe to expose in the frontend
// The actual security is handled by Firebase Storage rules
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "ladderup-5e25d.firebaseapp.com",
  projectId: "ladderup-5e25d",
  storageBucket: "ladderup-5e25d.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Storage
const storage = getStorage(app);

export { storage };
