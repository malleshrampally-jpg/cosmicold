// users.js – Admin User Manager (Firebase v9)
// All user fields editable after creation via modal

import { db, auth } from "../firebase.js";
import {
  collection, addDoc, setDoc, doc, getDocs,
  updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { logout } from "../utils.js";
import { guardRoute } from "../guard.js";

guardRoute("admin");
document.getElementById("logout-btn")?.addEventListener("click", logout);

/* -------------------------------------------------- */
/* TOAST                                              */
/* -------------------------------------------------- */

function toast(msg, type = "success", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 350);
  }, duration);
}

/* -------------------------------------------------- */
/* PASSWORD STRENGTH                                  */
/* -------------------------------------------------- */

const passwordInput  = document.getElementById("password");
const confirmInput   = document.getElementById("password-confirm");
const strengthFill   = document.getElementById("pw-strength-fill");
const strengthLabel  = document.getElementById("pw-strength-label");
const matchLabel     = document.getElementById("pw-match-label");

function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (pw.length >= 12)         score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

passwordInput?.addEventListener("input", () => {
  const pw    = passwordInput.value;
  const score = getStrength(pw);
  const pct   = pw.length === 0 ? 0 : Math.max(10, score * 20);
  const colors = ["#FF453A","#FF453A","#FF9F0A","#FF9F0A","#30D158","#30D158"];
  const labels = ["Too short","Weak","Fair","Fair","Strong","Very strong"];
  if (strengthFill) { strengthFill.style.width = pw.length ? pct+"%" : "0%"; strengthFill.style.background = colors[score] || "#505060"; }
  if (strengthLabel) { strengthLabel.textContent = pw.length ? labels[score] : "Enter a password"; strengthLabel.style.color = pw.length ? colors[score] : "#505060"; }
  checkMatch();
});
confirmInput?.addEventListener("input", checkMatch);

function checkMatch() {
  if (!confirmInput || !matchLabel) return;
  const pw  = passwordInput?.value || "";
  const pw2 = confirmInput.value;
  if (!pw2) { matchLabel.textContent = ""; return; }
  if (pw === pw2) { matchLabel.textContent = "✓ Passwords match";      matchLabel.style.color = "#30D158"; }
  else            { matchLabel.textContent = "✕ Passwords don't match"; matchLabel.style.color = "#FF453A"; }
}

/* -------------------------------------------------- */
/* CREATE USER                                        */
/* -------------------------------------------------- */

const usernameInput   = document.getElementById("username");
const roleSelect      = document.getElementById("role");
const specialityInput = document.getElementById("speciality");
const photoInput      = document.getElementById("photo");
const createBtn       = document.getElementById("create-user-btn");

createBtn?.addEventListener("click", async () => {
  const username   = usernameInput.value.trim();
  const password   = passwordInput.value.trim();
  const confirm    = confirmInput?.value.trim() || password;
  const role       = roleSelect.value;
  const speciality = specialityInput ? specialityInput.value.trim() : "";
  const photo      = photoInput      ? photoInput.value.trim()      : "";

  if (!username || !password || !role) { toast("Fill all fields", "error"); return; }
  if (password !== confirm)            { toast("Passwords don't match", "error"); return; }
  if (getStrength(password) < 2)       { toast("Password is too weak", "error"); return; }

  const email = `${username}@cosmic.com`;
  createBtn.disabled    = true;
  createBtn.textContent = "Creating…";

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCred.user.uid), {
      username, email, role, active: true, rulesAccepted: false,
      createdAt: serverTimestamp(), photo, speciality,
    });
    toast(`✓ User "${username}" created as ${role}`, "success");
    usernameInput.value = "";
    passwordInput.value = "";
    if (confirmInput)   confirmInput.value   = "";
    if (specialityInput) specialityInput.value = "";
    if (photoInput)     photoInput.value     = "";
    if (strengthFill)  strengthFill.style.width = "0%";
    if (strengthLabel) { strengthLabel.textContent = "Enter a password"; strengthLabel.style.color = "#505060"; }
    if (matchLabel)    matchLabel.textContent = "";
  } catch (err) {
    console.error(err);
    toast("Error: " + err.message, "error", 5000);
  } finally {
    createBtn.disabled    = false;
    createBtn.textContent = "Create User";
  }
});

/* -------------------------------------------------- */
/* EDIT USER MODAL                                    */
/* -------------------------------------------------- */

function openEditModal(id, d) {
  document.getElementById("user-edit-modal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "user-edit-modal";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:3000;
    display:flex;align-items:center;justify-content:center;padding:20px;
    background:rgba(0,0,0,0.82);backdrop-filter:blur(32px);
    opacity:0;transition:opacity .25s ease;
  `;

  const initial = (d.username || "?").slice(0,2).toUpperCase();
  const avatarEl = d.photo
    ? `<img src="${d.photo}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.12);flex-shrink:0;" onerror="this.style.display='none'">`
    : `<div style="width:52px;height:52px;border-radius:50%;background:rgba(10,132,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#0A84FF;flex-shrink:0;">${initial}</div>`;

  overlay.innerHTML = `
    <div id="user-edit-inner" style="
      width:min(520px,96vw);max-height:88vh;overflow-y:auto;
      background:rgba(8,9,18,0.98);border:1px solid rgba(255,255,255,0.12);
      border-radius:22px;padding:28px;position:relative;
      box-shadow:0 24px 64px rgba(0,0,0,0.8);
      transform:scale(0.95);transition:transform .25s cubic-bezier(0.25,1,0.5,1);
    ">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;">
        <div id="edit-avatar-preview">${avatarEl}</div>
        <div style="flex:1;min-width:0;">
          <h3 style="font-size:18px;font-weight:700;margin:0 0 4px;">${d.username || "User"}</h3>
          <span style="font-size:11px;font-family:monospace;color:#505060;">${d.email || ""}</span>
        </div>
        <button id="user-edit-close" style="
          background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);
          color:#fff;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
          transition:background .18s,transform .18s;">✕</button>
      </div>

      <!-- Fields -->
      <div style="display:flex;flex-direction:column;gap:14px;">

        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#88889a;">
          Username
          <input id="ue-username" type="text" value="${d.username || ''}"
            style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:10px;padding:10px 12px;color:#f0f0f5;font-size:14px;font-family:inherit;width:100%;box-sizing:border-box;">
        </label>

        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#88889a;">
          Role
          <select id="ue-role" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:10px;padding:10px 12px;color:#f0f0f5;font-size:14px;font-family:inherit;">
            <option value="editor" ${d.role === 'editor' ? 'selected' : ''}>Editor</option>
            <option value="admin"  ${d.role === 'admin'  ? 'selected' : ''}>Admin</option>
          </select>
        </label>

        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#88889a;">
          Speciality
          <input id="ue-speciality" type="text" value="${d.speciality || ''}" placeholder="e.g. High-retention Shorts"
            style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:10px;padding:10px 12px;color:#f0f0f5;font-size:14px;font-family:inherit;width:100%;box-sizing:border-box;">
        </label>

        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#88889a;">
          Photo URL
          <input id="ue-photo" type="url" value="${d.photo || ''}" placeholder="https://example.com/photo.jpg"
            style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:10px;padding:10px 12px;color:#f0f0f5;font-size:14px;font-family:inherit;width:100%;box-sizing:border-box;">
        </label>

        <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:#88889a;cursor:pointer;">
          <input type="checkbox" id="ue-active" ${d.active !== false ? 'checked' : ''}
            style="width:16px;height:16px;accent-color:#30D158;cursor:pointer;">
          Account Active
        </label>

        <div id="ue-feedback" style="font-size:13px;min-height:18px;"></div>

        <button id="ue-save" style="
          background:#fff;color:#000;border:none;border-radius:999px;
          padding:12px 24px;font-weight:700;font-size:15px;cursor:pointer;
          transition:transform .18s,box-shadow .18s;">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    document.getElementById('user-edit-inner').style.transform = 'scale(1)';
  });

  // Live photo preview
  const photoField   = overlay.querySelector('#ue-photo');
  const avatarPreview = overlay.querySelector('#edit-avatar-preview');
  photoField.addEventListener('input', () => {
    const val = photoField.value.trim();
    if (val) {
      avatarPreview.innerHTML = `<img src="${val}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.12);" onerror="this.style.display='none'">`;
    } else {
      avatarPreview.innerHTML = `<div style="width:52px;height:52px;border-radius:50%;background:rgba(10,132,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#0A84FF;">${initial}</div>`;
    }
  });

  function closeModal() {
    overlay.style.opacity = '0';
    document.getElementById('user-edit-inner').style.transform = 'scale(0.95)';
    setTimeout(() => overlay.remove(), 280);
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('user-edit-close').addEventListener('click', closeModal);

  const closeBtn = document.getElementById('user-edit-close');
  closeBtn.onmouseenter = () => { closeBtn.style.background = '#FF453A'; closeBtn.style.transform = 'rotate(90deg)'; };
  closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,255,255,0.07)'; closeBtn.style.transform = ''; };

  const saveBtn = document.getElementById('ue-save');
  saveBtn.onmouseenter = () => { saveBtn.style.transform = 'scale(1.03)'; saveBtn.style.boxShadow = '0 8px 24px rgba(255,255,255,0.2)'; };
  saveBtn.onmouseleave = () => { saveBtn.style.transform = ''; saveBtn.style.boxShadow = ''; };

  saveBtn.addEventListener('click', async () => {
    const fb = document.getElementById('ue-feedback');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await updateDoc(doc(db, 'users', id), {
        username:  document.getElementById('ue-username').value.trim()   || d.username,
        role:      document.getElementById('ue-role').value,
        speciality:document.getElementById('ue-speciality').value.trim() || "",
        photo:     document.getElementById('ue-photo').value.trim()      || "",
        active:    document.getElementById('ue-active').checked,
      });
      fb.style.color  = '#30D158';
      fb.textContent  = '✓ Saved';
      toast(`User "${d.username}" updated`, 'success');
      setTimeout(closeModal, 700);
    } catch (err) {
      fb.style.color = '#FF453A';
      fb.textContent = '✕ Failed — check console';
      console.error(err);
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

/* -------------------------------------------------- */
/* LOAD + RENDER USER LIST                            */
/* -------------------------------------------------- */

const usersList       = document.getElementById("users-list");
const usersCount      = document.getElementById("users-count");
const usersSearch     = document.getElementById("users-search");
const usersRoleFilter = document.getElementById("users-filter-role");

let usersCache = [];

const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
onSnapshot(q, snapshot => {
  usersCache = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
  renderUsers();
}, err => console.error("Users listener error", err));

function debounce(fn, t = 220) {
  let timer;
  return (...a) => { clearTimeout(timer); timer = setTimeout(() => fn(...a), t); };
}
usersSearch?.addEventListener("input",  debounce(renderUsers, 200));
usersRoleFilter?.addEventListener("change", renderUsers);

function renderUsers() {
  if (!usersList) return;
  const search     = (usersSearch?.value || "").toLowerCase().trim();
  const roleFilter = usersRoleFilter?.value || "";

  const filtered = usersCache.filter(({ id, data: d }) => {
    if (roleFilter && d.role !== roleFilter) return false;
    if (search) {
      const hay = [d.username, d.role, d.email, d.speciality, id].join(" ").toLowerCase();
      return hay.includes(search);
    }
    return true;
  });

  if (usersCount) usersCount.textContent = `${filtered.length} user${filtered.length !== 1 ? "s" : ""}`;

  if (filtered.length === 0) {
    usersList.innerHTML = '<p style="color:#505060;padding:8px 0;">No users found.</p>';
    return;
  }

  usersList.innerHTML = "";
  filtered.forEach(({ id, data: d }) => {
    const initials = (d.username || "?").slice(0,2).toUpperCase();
    const isActive = d.active !== false;

    const avatarHtml = d.photo
      ? `<img src="${d.photo}" class="user-avatar" alt="${d.username}" style="object-fit:cover;" onerror="this.style.display='none'">`
      : `<div class="user-avatar">${initials}</div>`;

    const specialityHtml = d.speciality
      ? ` · <span style="color:var(--text-primary);font-weight:500;">${d.speciality}</span>`
      : "";

    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <div class="status-dot ${isActive ? "active" : "inactive"}" title="${isActive ? "Active" : "Disabled"}"></div>
      ${avatarHtml}
      <div class="user-info">
        <div class="user-name">${d.username || "—"}</div>
        <div class="user-meta">${d.email || ""}${specialityHtml} · Joined ${formatDate(d.createdAt)}</div>
      </div>
      <span class="role-badge role-${d.role || "editor"}">${d.role || "editor"}</span>
      <div class="user-actions"></div>
    `;

    const actions = row.querySelector(".user-actions");

    // Edit button
    const editBtn       = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.style.cssText = `
      background:rgba(10,132,255,0.10);color:#0A84FF;
      border:1px solid rgba(10,132,255,0.25);
      border-radius:8px;padding:5px 14px;font-size:12px;font-weight:600;
      cursor:pointer;transition:background .15s;
    `;
    editBtn.onmouseenter = () => { editBtn.style.background = '#0A84FF'; editBtn.style.color = '#fff'; };
    editBtn.onmouseleave = () => { editBtn.style.background = 'rgba(10,132,255,0.10)'; editBtn.style.color = '#0A84FF'; };
    editBtn.onclick = () => openEditModal(id, d);

    // Toggle active
    const toggleBtn       = document.createElement("button");
    toggleBtn.textContent = isActive ? "Disable" : "Enable";
    toggleBtn.style.cssText = `
      background:${isActive ? "rgba(255,159,10,0.10)" : "rgba(48,209,88,0.10)"};
      color:${isActive ? "#FF9F0A" : "#30D158"};
      border:1px solid ${isActive ? "rgba(255,159,10,0.25)" : "rgba(48,209,88,0.25)"};
      border-radius:8px;padding:5px 14px;font-size:12px;font-weight:600;
      cursor:pointer;transition:background .15s;
    `;
    toggleBtn.onclick = async () => {
      try {
        await updateDoc(doc(db, "users", id), { active: !isActive });
        toast(`User "${d.username}" ${isActive ? "disabled" : "enabled"}`, "success");
      } catch (err) {
        toast("Failed to update user", "error"); console.error(err);
      }
    };

    // Delete
    const delBtn       = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.style.cssText = `
      background:rgba(255,69,58,0.08);color:#FF453A;
      border:1px solid rgba(255,69,58,0.20);border-radius:8px;
      padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s;
    `;
    delBtn.onmouseenter = () => { delBtn.style.background = "#FF453A"; delBtn.style.color = "#fff"; };
    delBtn.onmouseleave = () => { delBtn.style.background = "rgba(255,69,58,0.08)"; delBtn.style.color = "#FF453A"; };
    delBtn.onclick = async () => {
      if (!confirm(`Permanently delete user "${d.username}"? This cannot be undone.`)) return;
      try {
        await deleteDoc(doc(db, "users", id));
        row.remove();
        toast(`User "${d.username}" deleted`, "success");
      } catch (err) {
        toast("Failed to delete user", "error"); console.error(err);
      }
    };

    actions.append(editBtn, toggleBtn, delBtn);
    usersList.appendChild(row);
  });
}

function formatDate(d) {
  if (!d) return "—";
  try { return new Date(d.toDate ? d.toDate() : d).toLocaleDateString(); } catch { return "—"; }
}