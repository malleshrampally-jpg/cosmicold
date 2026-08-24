import { logout } from "../utils.js";
import { guardRoute } from "../guard.js";
guardRoute("admin"); // Prevents access by non-editors
document.getElementById("logout-btn")?.addEventListener("click", logout);