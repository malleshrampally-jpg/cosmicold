import { auth, db, onAuthStateChanged } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/**
 * Guard a page to only allow users with expectedRole
 * @param {string} expectedRole - "admin" or "editor"
 */
export function guardRoute(expectedRole) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Not logged in → redirect to login
      window.location.href = "/login.html";
      return;
    }

    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (!docSnap.exists()) {
        alert("User not found in database");
        auth.signOut();
        window.location.href = "/login.html";
        return;
      }

      const userData = docSnap.data();

      // Role check
      if (expectedRole && userData.role !== expectedRole) {
        alert("Access denied for your role");
        window.location.href = "/login.html";
        return;
      }
    } catch (err) {
      console.error(err);
      auth.signOut();
      window.location.href = "/login.html";
    }
  });
}
