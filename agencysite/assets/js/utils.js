import { auth, db, signOut } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export async function setupHeaderButtons(user) {
  const container = document.getElementById("header-buttons");
  if (!container) return;

  container.innerHTML = "";

  if (user) {
    // 1. DASHBOARD BUTTON
    const dashboardBtn = document.createElement("button");
    dashboardBtn.textContent = "Dashboard";
    dashboardBtn.className = "ghost"; // Using 'ghost' for a glass-on-glass look
    dashboardBtn.style.marginRight = "8px"; 

    dashboardBtn.onclick = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const role = snap.exists() ? snap.data().role : "user";
        window.location.href = role === "admin" ? "/admin/index.html" : "/editor/index.html";
      } catch (err) {
        console.error("Dashboard error:", err);
      }
    };

    // 2. LOGOUT BUTTON
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Logout";
    logoutBtn.className = "danger"; // Matches the Red Glass style we created

    logoutBtn.onclick = async () => {
      await signOut(auth);
      window.location.href = "/login.html";
    };

    container.appendChild(dashboardBtn);
    container.appendChild(logoutBtn);

  } else {
    // LOGGED OUT STATE
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Editor Login";
    loginBtn.className = "primary"; // Solid white/glass button

    loginBtn.onclick = () => {
      window.location.href = "/login.html";
    };

    container.appendChild(loginBtn);
  }
}

export function logout() {
  signOut(auth)
    .then(() => window.location.href = "/login.html")
    .catch(err => console.error("Logout error:", err));
}