import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();

export function showAuthError(message) {
  const errorEl = document.getElementById("auth-error");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
}

export function showSignupError(message) {
  const errorEl = document.getElementById("signup-error");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
}

export function showResetError(message) {
  const errorEl = document.getElementById("reset-error");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
}

export async function ensureUserDocument(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      active: true,
      created_at: serverTimestamp(),
      email: user.email,
      lastSeen: serverTimestamp(),
      online: true,
      role: "user",
      uid: user.uid,
      username: user.displayName || user.email.split("@")[0],
      updatedAt: serverTimestamp()
    });
  } else {
    const userData = userSnap.data();
    await setDoc(userRef, {
      ...userData,
      online: true,
      lastSeen: serverTimestamp()
    }, { merge: true });
  }
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    await ensureUserDocument(user);
    return user;
  } catch (error) {
    console.error("Google sign-in error:", error);
    showAuthError(error.message);
    throw error;
  }
}

export async function signInWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    await ensureUserDocument(user);
    return user;
  } catch (error) {
    console.error("Email sign-in error:", error);
    showAuthError(error.message);
    throw error;
  }
}

export async function signUpWithEmail(email, password, username) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    await updateProfile(user, { displayName: username });

    await setDoc(doc(db, "users", user.uid), {
      active: true,
      created_at: serverTimestamp(),
      email: email,
      lastSeen: serverTimestamp(),
      online: true,
      role: "user",
      uid: user.uid,
      username: username,
      updatedAt: serverTimestamp()
    });

    return user;
  } catch (error) {
    console.error("Sign-up error:", error);
    showSignupError(error.message);
    throw error;
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    console.error("Password reset error:", error);
    showResetError(error.message);
    throw error;
  }
}

export async function logout() {
  try {
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        online: false,
        lastSeen: serverTimestamp()
      }, { merge: true });
    }
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
}

export async function getCurrentUserData(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Get user data error:", error);
    return null;
  }
}

export { onAuthStateChanged, auth };
