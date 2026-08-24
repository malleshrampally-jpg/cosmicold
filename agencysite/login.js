import { auth, db } from "./assets/js/firebase.js";
import { signInWithEmailAndPassword } from 
"https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc } from 
"https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const errorDiv = document.getElementById("login-error");

loginBtn.addEventListener("click", async () => {
  errorDiv.textContent = "";
  errorDiv.style.color = "red";

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    errorDiv.textContent = "Please enter username and password";
    return;
  }

  // 🔹 Firebase requires email format
  const email = `${username}@cosmic.com`;

  try {
    // 🔹 Authenticate user
    const userCred = await signInWithEmailAndPassword(auth, email, password);

    // 🔹 Fetch user data using UID
    const userRef = doc(db, "users", userCred.user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found in database");
    }

    const userData = userSnap.data();

    if (!userData.active) {
      throw new Error("Account is disabled");
    }

    // 🔹 Redirect based on role
    if (userData.role === "admin") {
      window.location.href = "/admin/index.html";
    } else if (userData.role === "editor") {
      window.location.href = "/editor/index.html";
    } else {
      throw new Error("Invalid role");
    }

  } catch (err) {
    console.error(err);
    errorDiv.textContent = "Invalid username or password";
  }
});
