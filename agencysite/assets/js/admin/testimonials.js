// testimonials.js – Admin Testimonials Manager (Firebase v9)
// All fields editable: clientName, message, rating, featured, avatarUrl, type, mediaUrl

import { auth, db } from "../firebase.js";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc,
  doc, serverTimestamp, orderBy, query
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* -------------------------------------------------- */
/* DOM ELEMENTS                                       */
/* -------------------------------------------------- */

const form            = document.querySelector("form");
const clientNameInput = document.getElementById("clientName");
const messageInput    = document.getElementById("message");
const ratingInput     = document.getElementById("rating");
const featuredInput   = document.getElementById("featured");
const typeSelect      = document.getElementById("testimonialType");
const mediaLinkInput  = document.getElementById("mediaLink");
const mediaWrapper    = document.getElementById("mediaWrapper");
const mediaPreview    = document.getElementById("mediaPreview");
const testimonialList = document.getElementById("testimonialList");
const avatarInput     = document.getElementById("avatarUrl");
const avatarPreview   = document.getElementById("avatarPreview");
const avatarPreviewImg= document.getElementById("avatarPreviewImg");

/* -------------------------------------------------- */
/* TOAST                                              */
/* -------------------------------------------------- */

function toast(msg, type = "success", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = "position:fixed;bottom:28px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.style.cssText = `
    padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;
    opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s;pointer-events:none;max-width:320px;
    ${type === "success" ? "background:rgba(48,209,88,0.18);border:1px solid rgba(48,209,88,0.4);color:#30D158;" :
      type === "error"   ? "background:rgba(255,69,58,0.18);border:1px solid rgba(255,69,58,0.4);color:#FF453A;" :
                           "background:rgba(10,132,255,0.18);border:1px solid rgba(10,132,255,0.4);color:#0A84FF;"}
  `;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }));
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(12px)"; setTimeout(() => el.remove(), 350); }, duration);
}

/* -------------------------------------------------- */
/* AVATAR PREVIEW (add form)                          */
/* -------------------------------------------------- */

avatarInput?.addEventListener("input", () => {
  const val = avatarInput.value.trim();
  if (val) {
    avatarPreviewImg.src = val;
    avatarPreview.style.display = "flex";
    avatarPreviewImg.onerror = () => { avatarPreview.style.display = "none"; };
    avatarPreviewImg.onload  = () => { avatarPreview.style.display = "flex"; };
  } else {
    avatarPreview.style.display = "none";
  }
});

/* -------------------------------------------------- */
/* GOOGLE DRIVE LINK → EMBED URL                      */
/* -------------------------------------------------- */

function driveToEmbedUrl(link, type) {
  if (!link) return null;
  let fileId = null;
  const matchFile = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile) fileId = matchFile[1];
  if (!fileId) {
    const matchId = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId) fileId = matchId[1];
  }
  if (!fileId) return null;
  if (type === "image") return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  if (type === "video") return `https://drive.google.com/file/d/${fileId}/preview`;
  return null;
}

/* -------------------------------------------------- */
/* TYPE SELECT → SHOW / HIDE MEDIA FIELD              */
/* -------------------------------------------------- */

function updateMediaField() {
  const type = typeSelect?.value;
  if (!mediaWrapper) return;
  if (type === "text") {
    mediaWrapper.style.display = "none";
    if (mediaLinkInput) mediaLinkInput.value = "";
    if (mediaPreview)   mediaPreview.innerHTML = "";
  } else {
    mediaWrapper.style.display = "block";
    const hint = document.getElementById("mediaHint");
    if (hint) hint.textContent = type === "image" ? "Paste a Google Drive image share link" : "Paste a Google Drive video share link";
  }
}

typeSelect?.addEventListener("change", () => { updateMediaField(); if (mediaPreview) mediaPreview.innerHTML = ""; });

mediaLinkInput?.addEventListener("input", () => {
  const type     = typeSelect?.value;
  const link     = mediaLinkInput.value.trim();
  const embedUrl = driveToEmbedUrl(link, type);
  if (!mediaPreview) return;
  if (!embedUrl) { mediaPreview.innerHTML = link ? `<p class="hint error">Could not read file ID.</p>` : ""; return; }
  if (type === "image") {
    mediaPreview.innerHTML = `<img src="${embedUrl}" style="max-width:100%;max-height:200px;border-radius:8px;margin-top:8px;" onerror="this.parentElement.innerHTML='<p class=\\'hint error\\'>Image failed.</p>'">`;
  } else if (type === "video") {
    mediaPreview.innerHTML = `<iframe src="${embedUrl}" style="width:100%;height:200px;border-radius:8px;margin-top:8px;border:none;" allow="autoplay" allowfullscreen></iframe>`;
  }
});

/* -------------------------------------------------- */
/* AUTH + ADMIN CHECK                                 */
/* -------------------------------------------------- */

auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = "/login.html"; return; }
  const snap = await getDocs(collection(db, "users"));
  let isAdmin = false;
  snap.forEach(d => { if (d.id === user.uid && d.data().role === "admin") isAdmin = true; });
  if (!isAdmin) { alert("Admins only"); window.location.href = "/"; return; }
  updateMediaField();
  loadTestimonials();
});

/* -------------------------------------------------- */
/* ADD TESTIMONIAL                                    */
/* -------------------------------------------------- */

form.addEventListener("submit", async e => {
  e.preventDefault();
  const name      = clientNameInput.value.trim();
  const message   = messageInput.value.trim();
  const rating    = Math.min(5, Math.max(1, Number(ratingInput.value) || 5));
  const featured  = featuredInput.checked;
  const type      = typeSelect?.value || "text";
  const rawLink   = mediaLinkInput?.value.trim() || "";
  const avatarUrl = avatarInput?.value.trim() || "";

  if (!name || !message) { alert("Client name and review are required"); return; }

  let mediaUrl = null, driveLink = null;
  if (type !== "text") {
    if (!rawLink) { alert("Please paste a Google Drive link for image/video testimonials"); return; }
    const embedUrl = driveToEmbedUrl(rawLink, type);
    if (!embedUrl) { alert("Couldn't read a Google Drive file ID from that link."); return; }
    mediaUrl = embedUrl;
    driveLink = rawLink;
  }

  const submitBtn       = form.querySelector("button[type=submit]");
  submitBtn.disabled    = true;
  submitBtn.textContent = "Saving...";

  try {
    await addDoc(collection(db, "testimonials"), {
      clientName: name, message, rating, featured, type,
      mediaUrl, driveLink, avatarUrl: avatarUrl || "", createdAt: serverTimestamp()
    });
    form.reset();
    if (mediaPreview)  mediaPreview.innerHTML = "";
    if (avatarPreview) avatarPreview.style.display = "none";
    updateMediaField();
    toast("Testimonial added!", "success");
    loadTestimonials();
  } catch (err) {
    console.error(err);
    toast("Failed to save: " + err.message, "error");
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = "Add Testimonial";
  }
});

/* -------------------------------------------------- */
/* LOAD TESTIMONIALS                                  */
/* -------------------------------------------------- */

async function loadTestimonials() {
  testimonialList.innerHTML = "<p>Loading...</p>";
  try {
    const q    = query(collection(db, "testimonials"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    testimonialList.innerHTML = "";
    if (snap.empty) { testimonialList.innerHTML = "<p>No testimonials yet.</p>"; return; }
    snap.forEach(d => renderCard(d));
  } catch (err) {
    console.error(err);
    testimonialList.innerHTML = "<p>Failed to load.</p>";
  }
}

/* -------------------------------------------------- */
/* AVATAR HTML HELPER                                 */
/* -------------------------------------------------- */

function avatarHTML(url, name, size = 36) {
  const initial = (name || "?")[0].toUpperCase();
  const fallback = `display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;
    background:rgba(99,102,241,0.25);align-items:center;justify-content:center;
    font-weight:700;font-size:${Math.round(size*0.4)}px;color:#818cf8;flex-shrink:0;`;
  if (url) {
    return `<img src="${url}" alt="${name}"
      style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;
             border:2px solid rgba(255,255,255,0.12);flex-shrink:0;vertical-align:middle;"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
    ><span style="${fallback}display:none;">${initial}</span>`;
  }
  return `<span style="${fallback}">${initial}</span>`;
}

/* -------------------------------------------------- */
/* RENDER ADMIN CARD                                  */
/* -------------------------------------------------- */

function renderCard(d) {
  const data    = d.data();
  const div     = document.createElement("div");
  div.className = "testimonial-card card";
  div.dataset.id = d.id;

  const typeIcon = { text: "💬", image: "🖼️", video: "🎬" }[data.type || "text"] || "💬";

  let mediaHTML = "";
  if (data.type === "image" && data.mediaUrl) {
    mediaHTML = `<img src="${data.mediaUrl}" alt="Screenshot" class="admin-media-thumb">`;
  } else if (data.type === "video" && data.mediaUrl) {
    mediaHTML = `<iframe src="${data.mediaUrl}" class="admin-media-thumb" style="width:100%;height:160px;border:none;border-radius:8px;margin:8px 0;" allowfullscreen></iframe>`;
  }

  const inputStyle  = `padding:7px 10px;border-radius:7px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:inherit;font-size:0.9rem;width:100%;box-sizing:border-box;font-family:inherit;`;
  const labelStyle  = `font-size:0.8rem;color:#888;display:flex;flex-direction:column;gap:4px;`;

  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      ${avatarHTML(data.avatarUrl, data.clientName, 36)}
      <strong style="flex:1;">${typeIcon} ${data.clientName}</strong>
      <span class="badge ${data.featured ? "badge-featured" : "badge-hidden"}">
        ${data.featured ? "🔥 Featured" : "Hidden"}
      </span>
    </div>

    ${mediaHTML}

    <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">

      <label style="${labelStyle}">
        Client Name
        <input class="e-name" type="text" value="${(data.clientName || '').replace(/"/g,'&quot;')}" style="${inputStyle}">
      </label>

      <label style="${labelStyle}">
        Review Text
        <textarea class="e-message" rows="3" style="${inputStyle}resize:vertical;">${data.message || ''}</textarea>
      </label>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <label style="${labelStyle}">
          Rating
          <select class="e-rating" style="${inputStyle}">
            ${[1,2,3,4,5].map(n => `<option value="${n}" ${data.rating === n ? "selected" : ""}>${n} ★</option>`).join("")}
          </select>
        </label>
        <label style="${labelStyle}">
          Type
          <select class="e-type" style="${inputStyle}">
            <option value="text"  ${data.type === 'text'  ? 'selected' : ''}>💬 Text</option>
            <option value="image" ${data.type === 'image' ? 'selected' : ''}>🖼️ Image</option>
            <option value="video" ${data.type === 'video' ? 'selected' : ''}>🎬 Video</option>
          </select>
        </label>
      </div>

      <div class="e-media-wrap" style="${data.type === 'text' ? 'display:none;' : ''}flex-direction:column;gap:4px;">
        <label style="${labelStyle}">
          Google Drive Link
          <input class="e-driveLink" type="url" value="${data.driveLink || ''}" placeholder="https://drive.google.com/file/d/…/view" style="${inputStyle}">
        </label>
        <div class="e-media-preview"></div>
      </div>

      <label style="${labelStyle}">
        Avatar URL
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="e-avatar" type="url" value="${data.avatarUrl || ''}" placeholder="https://example.com/photo.jpg" style="${inputStyle}">
          <div class="e-avatar-preview" style="width:32px;height:32px;flex-shrink:0;">${avatarHTML(data.avatarUrl, data.clientName, 32)}</div>
        </div>
      </label>

      <label style="font-size:0.8rem;color:#888;display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" class="e-featured" ${data.featured ? "checked" : ""} style="width:15px;height:15px;accent-color:#f59e0b;cursor:pointer;">
        Featured on homepage
      </label>

    </div>

    <div class="card-actions" style="margin-top:12px;"></div>
  `;

  /* ── Type → show/hide media wrap ── */
  const typeEl         = div.querySelector(".e-type");
  const mediaWrapEl    = div.querySelector(".e-media-wrap");
  const driveLinkEl    = div.querySelector(".e-driveLink");
  const mediaPreviewEl = div.querySelector(".e-media-preview");

  typeEl.addEventListener("change", () => {
    mediaWrapEl.style.display = typeEl.value === "text" ? "none" : "flex";
    mediaPreviewEl.innerHTML  = "";
  });

  driveLinkEl.addEventListener("input", () => {
    const t   = typeEl.value;
    const url = driveToEmbedUrl(driveLinkEl.value.trim(), t);
    if (!url) { mediaPreviewEl.innerHTML = ""; return; }
    if (t === "image") mediaPreviewEl.innerHTML = `<img src="${url}" style="max-width:100%;max-height:140px;border-radius:7px;margin-top:4px;">`;
    else if (t === "video") mediaPreviewEl.innerHTML = `<iframe src="${url}" style="width:100%;height:130px;border:none;border-radius:7px;margin-top:4px;" allowfullscreen></iframe>`;
  });

  /* ── Avatar live preview ── */
  const avatarField   = div.querySelector(".e-avatar");
  const avatarPrevEl  = div.querySelector(".e-avatar-preview");
  avatarField.addEventListener("input", () => {
    avatarPrevEl.innerHTML = avatarHTML(avatarField.value.trim() || null, data.clientName, 32);
  });

  /* ── Save ── */
  const saveBtn       = document.createElement("button");
  saveBtn.textContent = "Save Changes";
  saveBtn.onclick = async () => {
    const newType      = typeEl.value;
    const newDriveLink = driveLinkEl.value.trim();
    let   newMediaUrl  = data.mediaUrl || null;

    if (newType !== "text" && newDriveLink) {
      const embed = driveToEmbedUrl(newDriveLink, newType);
      if (embed) newMediaUrl = embed;
    } else if (newType === "text") {
      newMediaUrl = null;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = "Saving...";
    try {
      await updateDoc(doc(db, "testimonials", d.id), {
        clientName: div.querySelector(".e-name").value.trim()    || data.clientName,
        message:    div.querySelector(".e-message").value.trim() || data.message,
        rating:     Number(div.querySelector(".e-rating").value),
        featured:   div.querySelector(".e-featured").checked,
        avatarUrl:  avatarField.value.trim() || "",
        type:       newType,
        mediaUrl:   newMediaUrl,
        driveLink:  newDriveLink || null,
      });
      toast("Testimonial updated", "success");
      loadTestimonials();
    } catch (err) {
      console.error(err);
      toast("Failed: " + err.message, "error");
      saveBtn.disabled    = false;
      saveBtn.textContent = "Save Changes";
    }
  };

  /* ── Delete ── */
  const delBtn       = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.className   = "danger";
  delBtn.onclick = async () => {
    if (!confirm(`Delete testimonial from "${data.clientName}"?`)) return;
    await deleteDoc(doc(db, "testimonials", d.id));
    toast(`Deleted testimonial from "${data.clientName}"`, "info");
    div.remove();
  };

  div.querySelector(".card-actions").append(saveBtn, delBtn);
  testimonialList.appendChild(div);
}