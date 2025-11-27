// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCHtiPnbOoRSkRS02nYEnQjMAqc7vfMWX0",
  authDomain: "pothole-webapp.firebaseapp.com",
  projectId: "pothole-webapp",
  storageBucket: "pothole-webapp.firebasestorage.app",
  messagingSenderId: "117334135242",
  appId: "1:117334135242:web:a76b6aaaa5983a2a643f33",
  measurementId: "G-4SN6TLLEXC" ,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth exports
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Helper login function
export function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

// Helper logout function
export function logout() {
  return signOut(auth);
}

// Auth state listener
export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
