import { db, auth } from "./firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} 
  from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { setupHeaderButtons } from "/assets/js/utils.js"
import { attachSkeel } from "./animations.js";

auth.onAuthStateChanged((user) => {
  setupHeaderButtons(user);
});


attachSkeel();

const editorsContainer = document.getElementById("editor-list");

async function loadEditors() {
  if (!editorsContainer) return;

  const q = query(
    collection(db, "users"),
    where("role", "==", "editor"),
    where("active", "==", true)
  );

  const snap = await getDocs(q);
  editorsContainer.innerHTML = "";

  snap.forEach(doc => {
    const data = doc.data();
    const card = document.createElement("div");
    card.className = "editor-card job-card"; 

    card.innerHTML = `
      <img src="${data.photo || "assets/img/avatar-placeholder.png"}" class="editor-avatar">
      <h4>${data.username}</h4>
      <p>${data.speciality || "Video Editor"}</p>
    `;

    editorsContainer.appendChild(card);
  });

  if (editorsContainer.children.length > 0) {
    const originalHTML = editorsContainer.innerHTML;
    const spacer = `<div style="width: 50px;"></div>`;
    editorsContainer.innerHTML = originalHTML + spacer + originalHTML + spacer;
  }
}

/* ================= FEATURED TESTIMONIALS ================= */
/* Supports type: "text" | "image" | "video"                */
/* Media stored as Google Drive embed URLs in Firestore     */

const testimonialGrid = document.getElementById("testimonial-grid");

async function loadFeaturedTestimonials() {
  if (!testimonialGrid) return;

  const q = query(
    collection(db, "testimonials"),
    where("featured", "==", true),
    orderBy("rating", "desc")
  );

  const snap = await getDocs(q);
  testimonialGrid.innerHTML = "";

  snap.forEach(docSnap => {
    const t       = docSnap.data();
    const type    = t.type || "text";
    const initial = (t.clientName || "?")[0].toUpperCase();

    const div = document.createElement("div");
    div.className = "testimonial-card card";

    let mediaHTML = "";
    if (type === "image" && t.mediaUrl) {
      mediaHTML = `
        <img
          src="${t.mediaUrl}"
          alt="Client screenshot"
          class="testimonial-screenshot"
          loading="lazy"
        >
      `;
    } else if (type === "video" && t.mediaUrl) {
      mediaHTML = `
        <div class="testimonial-video-wrap">
          <iframe
            src="${t.mediaUrl}"
            allow="autoplay"
            allowfullscreen
            loading="lazy">
          </iframe>
        </div>
      `;
    }

    /* Avatar: real image with initial-letter fallback */
    const avatarHTML = t.avatarUrl
      ? `<img
           src="${t.avatarUrl}"
           alt="${t.clientName}"
           style="width:36px;height:36px;border-radius:50%;object-fit:cover;
                  border:2px solid rgba(255,255,255,0.12);flex-shrink:0;"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
         >
         <div style="display:none;width:36px;height:36px;border-radius:50%;
           background:rgba(99,102,241,0.25);align-items:center;justify-content:center;
           font-weight:700;font-size:0.95rem;color:#818cf8;flex-shrink:0;">
           ${initial}
         </div>`
      : `<div style="display:flex;width:36px;height:36px;border-radius:50%;
           background:rgba(99,102,241,0.25);align-items:center;justify-content:center;
           font-weight:700;font-size:0.95rem;color:#818cf8;flex-shrink:0;">
           ${initial}
         </div>`;

    div.innerHTML = `
      ${mediaHTML}
      <p>"${t.message}"</p>
      <div style="display:flex;align-items:center;gap:10px;margin-top:12px;">
        ${avatarHTML}
        <strong style="font-size:0.95rem;">— ${t.clientName}</strong>
      </div>
      <span class="stars" style="display:block;margin-top:6px;padding-left:46px;">${"★".repeat(t.rating || 5)}</span>
    `;

    testimonialGrid.appendChild(div);
  });
}

/* ================= INIT ================= */

loadEditors();
loadFeaturedTestimonials();