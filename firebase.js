import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKCcDda45gUbsr-iNdMPQq_Bz7XE5evTQ",
  authDomain: "ghonse-media-site.firebaseapp.com",
  projectId: "ghonse-media-site",
  storageBucket: "ghonse-media-site.firebasestorage.app",
  messagingSenderId: "334804323154",
  appId: "1:334804323154:web:5f0784093e1630c798888b",
  measurementId: "G-B235F5YV98"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);