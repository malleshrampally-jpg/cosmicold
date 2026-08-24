import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCjuqKxvpAz4Vq3QS0AeD10RGr1fyCiZ_Q",
  authDomain: "agency-dashboard-79dd6.firebaseapp.com",
  projectId: "agency-dashboard-79dd6",
  storageBucket: "agency-dashboard-79dd6.appspot.com",
  messagingSenderId: "1032733387157",
  appId: "1:1032733387157:web:eadbc515898b1dcf242e9c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);  // ✅ Add this
export { db, auth, storage, signOut, onAuthStateChanged };
