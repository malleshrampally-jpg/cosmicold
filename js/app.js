import { auth, onAuthStateChanged } from "./auth.js";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  logout,
  getCurrentUserData,
  showAuthError,
  showSignupError,
  showResetError
} from "./auth.js";

const authContainer = document.getElementById("auth-container");
const appContainer = document.getElementById("app-container");
const mainNav = document.getElementById("main-nav");
const mainContent = document.getElementById("main-content");

let currentUser = null;
let currentUserData = null;

// Initialize app
function initApp() {
  setupAuthListeners();
  monitorAuthState();
}

function setupAuthListeners() {
  // Login form
  document.getElementById("google-login-btn")?.addEventListener("click", async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
    }
  });

  document.getElementById("login-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("email-input")?.value;
    const password = document.getElementById("password-input")?.value;
    if (email && password) {
      try {
        await signInWithEmail(email, password);
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Signup form
  document.getElementById("signup-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("login-form")?.style.display = "none";
    document.getElementById("signup-form")?.style.display = "flex";
  });

  document.getElementById("back-to-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("signup-form")?.style.display = "none";
    document.getElementById("login-form")?.style.display = "flex";
  });

  document.getElementById("signup-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("signup-email")?.value;
    const password = document.getElementById("signup-password")?.value;
    const confirm = document.getElementById("signup-confirm")?.value;
    const username = document.getElementById("signup-username")?.value;

    if (!email || !password || !username) {
      showSignupError("All fields required");
      return;
    }

    if (password !== confirm) {
      showSignupError("Passwords don't match");
      return;
    }

    try {
      await signUpWithEmail(email, password, username);
    } catch (error) {
      console.error(error);
    }
  });

  // Password reset
  document.getElementById("forgot-password-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("login-form")?.style.display = "none";
    document.getElementById("reset-form")?.style.display = "flex";
  });

  document.getElementById("back-to-login-reset")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("reset-form")?.style.display = "none";
    document.getElementById("login-form")?.style.display = "flex";
  });

  document.getElementById("reset-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("reset-email")?.value;
    if (email) {
      try {
        await resetPassword(email);
        const msgEl = document.getElementById("reset-message");
        if (msgEl) {
          msgEl.textContent = "Check your email for password reset link";
          msgEl.style.display = "block";
        }
      } catch (error) {
        console.error(error);
      }
    }
  });
}

function monitorAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      currentUserData = await getCurrentUserData(user.uid);
      showApp();
    } else {
      currentUser = null;
      currentUserData = null;
      showAuth();
    }
  });
}

function showAuth() {
  authContainer.style.display = "flex";
  appContainer.style.display = "none";
  document.getElementById("login-form")?.style.display = "flex";
  document.getElementById("signup-form")?.style.display = "none";
  document.getElementById("reset-form")?.style.display = "none";
}

function showApp() {
  authContainer.style.display = "none";
  appContainer.style.display = "block";
  renderNav();
  renderDashboard();
}

function renderNav() {
  const isAdmin = currentUserData?.role === "admin";
  
  mainNav.innerHTML = `
    <div class="nav-left">
      <span>Cosmic Academy</span>
    </div>
    <div class="nav-center">
      <a href="#" class="nav-link active" data-page="dashboard">Dashboard</a>
      ${!isAdmin ? `<a href="#" class="nav-link" data-page="training">Training</a>` : ''}
      ${!isAdmin ? `<a href="#" class="nav-link" data-page="tests">Tests</a>` : ''}
      ${!isAdmin ? `<a href="#" class="nav-link" data-page="attempts">My Attempts</a>` : ''}
      ${isAdmin ? `<a href="#" class="nav-link" data-page="candidates">Candidates</a>` : ''}
      ${isAdmin ? `<a href="#" class="nav-link" data-page="training-admin">Training</a>` : ''}
      ${isAdmin ? `<a href="#" class="nav-link" data-page="tests-admin">Tests</a>` : ''}
      <a href="#" class="nav-link" data-page="profile">Profile</a>
    </div>
    <div class="nav-right">
      <button class="btn btn-ghost" id="logout-btn" style="padding: 8px 16px; font-size: 12px;">Logout</button>
    </div>
  `;

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  });

  mainNav.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      
      mainNav.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      
      renderPage(page);
    });
  });
}

function renderDashboard() {
  const isAdmin = currentUserData?.role === "admin";
  
  mainContent.innerHTML = `
    <h1>Welcome, ${currentUserData?.username || 'User'}!</h1>
    <p class="text-secondary" style="margin-top: 20px;">${isAdmin ? 'Admin Dashboard' : 'Candidate Dashboard'}</p>
    
    ${!isAdmin ? `
      <div class="card" style="margin-top: 30px;">
        <h2>Your Application Status</h2>
        <div style="margin-top: 20px;">
          <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
            <span style="color: var(--success);">✓</span>
            <span>Application Started</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
            <span style="color: var(--ink-3);">○</span>
            <span class="text-muted">Training</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
            <span style="color: var(--ink-3);">○</span>
            <span class="text-muted">Testing</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
            <span style="color: var(--ink-3);">○</span>
            <span class="text-muted">Under Review</span>
          </div>
        </div>
      </div>
    ` : `
      <div style="margin-top: 30px;">
        <div class="grid">
          <div class="card">
            <h3>Total Candidates</h3>
            <p style="font-size: 2rem; color: var(--cyan); margin-top: 10px; font-weight: 700;">--</p>
          </div>
          <div class="card">
            <h3>Tests Created</h3>
            <p style="font-size: 2rem; color: var(--violet); margin-top: 10px; font-weight: 700;">--</p>
          </div>
          <div class="card">
            <h3>Training Videos</h3>
            <p style="font-size: 2rem; color: var(--gold); margin-top: 10px; font-weight: 700;">--</p>
          </div>
        </div>
      </div>
    `}
  `;
}

function renderPage(page) {
  switch(page) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'training':
      mainContent.innerHTML = '<h1>Training Library</h1><p class="text-secondary" style="margin-top: 20px;">Coming soon...</p>';
      break;
    case 'tests':
      mainContent.innerHTML = '<h1>Tests</h1><p class="text-secondary" style="margin-top: 20px;">Coming soon...</p>';
      break;
    case 'attempts':
      mainContent.innerHTML = '<h1>My Attempts</h1><p class="text-secondary" style="margin-top: 20px;">Coming soon...</p>';
      break;
    case 'profile':
      mainContent.innerHTML = `
        <h1>Profile</h1>
        <div class="card" style="margin-top: 20px; max-width: 500px;">
          <p><strong>Username:</strong> ${currentUserData?.username}</p>
          <p><strong>Email:</strong> ${currentUserData?.email}</p>
          <p><strong>Role:</strong> ${currentUserData?.role}</p>
          <p><strong>Member Since:</strong> ${currentUserData?.created_at?.toDate?.()?.toLocaleDateString?.() || 'N/A'}</p>
          <p><strong>Status:</strong> ${currentUserData?.active ? 'Active' : 'Inactive'}</p>
        </div>
      `;
      break;
    default:
      renderDashboard();
  }
}

initApp();
