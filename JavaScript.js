

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBKCcDda45gUbsr-iNdMPQq_Bz7XE5evTQ",
  authDomain: "ghonse-media-site.firebaseapp.com",
  projectId: "ghonse-media-site",
  storageBucket: "ghonse-media-site.firebasestorage.app",
  messagingSenderId: "334804323154",
  appId: "1:334804323154:web:5f0784093e1630c798888b",
  measurementId: "G-B235F5YV98"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

