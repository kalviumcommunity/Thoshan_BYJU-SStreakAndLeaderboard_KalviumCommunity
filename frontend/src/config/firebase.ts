import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyDVRa1IOwXaNgYA0iYv-cmnc6Y4skMzSr0",
  authDomain: "byjus-leaderboard.firebaseapp.com",
  projectId: "byjus-leaderboard",
  storageBucket: "byjus-leaderboard.firebasestorage.app",
  messagingSenderId: "818662474032",
  appId: "1:818662474032:web:595b52fc98966b1dfbc8f5",
  measurementId: "G-7CEJEWHGV8"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase Auth instance
export const auth = getAuth(app);
export default app;
