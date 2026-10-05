// Adresse de ton API Backend
const API_URL = "/api/admin";

// Exécution au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
    verifierAccesAdmin();
    chargerStatistiques();
});

// ==========================================
// 1. SÉCURITÉ ET NAVIGATION
// ==========================================

function verifierAccesAdmin() {
    const user = JSON.parse(localStorage.getItem("user"));
    
    // Vérifie si l'utilisateur est connecté et possède le rôle super_admin
    if (!user || user.role !== "super_admin") {
        alert("Accès refusé. Vous devez être connecté en tant que Super Admin.");
        window.location.href = "login.html";
        return;
    }

    // Affiche le nom de l'admin dans la sidebar
    const adminNameEl = document.getElementById("admin-name");
    if (adminNameEl) adminNameEl.textContent = user.username;
}

function switchTab(tab) {
    const sections = ['stats', 'ecoles', 'users', 'validations'];

    sections.forEach(s => {
        const sectionEl = document.getElementById(`section-${s}`);
        const btnEl = document.getElementById(`tab-btn-${s}`);

        if (sectionEl) sectionEl.classList.add("hidden");
        if (btnEl) {
            btnEl.classList.remove("bg-slate-800", "text-white");
            btnEl.classList.add("text-slate-400");
        }
    });

    const activeSection = document.getElementById(`section-${tab}`);
    const activeBtn = document.getElementById(`tab-btn-${tab}`);

    if (activeSection) activeSection.classList.remove("hidden");
    if (activeBtn) {
        activeBtn.classList.add("bg-slate-800", "text-white");
        activeBtn.classList.remove("text-slate-400");
    }

    const pageTitle = document.getElementById("page-title");
    const titles = {
        stats: "Tableau de bord Global",
        ecoles: "Gestion des Établissements",
        users: "Gestion des Utilisateurs",
        validations: "Validations des Enseignants"
    };
    if (pageTitle) pageTitle.textContent = titles[tab] || "Super Admin";

    if (tab === 'stats') chargerStatistiques();
    if (tab === 'ecoles') chargerEcoles();
    if (tab === 'users') chargerUtilisateurs();
    if (tab === 'validations') chargerProfesseursEnAttente();
}

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

// ==========================================
// 2. REQUÊTES API (FETCH)
// ==========================================

// --- STATISTIQUES ---
async function chargerStatistiques() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        const data = await res.json();

        document.getElementById("stat-ecoles").textContent = data.totalEcoles || 0;
        document.getElementById("stat-eleves").textContent = data.totalEleves || 0;
        document.getElementById("stat-profs").textContent = data.totalProfs || 0;
        document.getElementById("stat-pending").textContent = data.pendingProfs || 0;
    } catch (err) {
        console.error("Erreur lors du chargement des statistiques:", err);
    }
}

// --- ÉTABLISSEMENTS ---
async function chargerEcoles() {
    try {
        const res = await fetch(`${API_URL}/ecoles`);
        const ecoles = await res.json();
        const tbody = document.getElementById("tbl-ecoles");

        if (!Array.isArray(ecoles) || ecoles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Aucun établissement enregistré.</td></tr>`;
            return;
        }

        tbody.innerHTML = ecoles.map(e => {
            const localisation = [e.quartier, e.arrondissement, e.ville].filter(Boolean).join(", ") || 'Non précisée';
            return `
                <tr class="hover:bg-slate-50">
                    <td class="p-4 font-bold text-slate-600">#${e.id}</td>
                    <td class="p-4 font-semibold text-slate-800 flex items-center gap-2">
                        ${e.logo_url ? `<img src="${e.logo_url}" class="w-6 h-6 object-contain rounded">` : ''}
                        <span>${e.nom}</span>
                    </td>
                    <td class="p-4 text-slate-500">${localisation}</td>
                    <td class="p-4 text-right">
                        <button onclick="supprimerEcole(${e.id})" class="text-rose-500 hover:text-rose-700 font-semibold text-xs">Supprimer</button>
                    </td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        console.error("Erreur lors du chargement des écoles:", err);
    }
}

async function creerEcole(event) {
    if (event) event.preventDefault();

    const form = document.getElementById("formAddEcole");
    const nom = document.getElementById("ecole-nom").value.trim();

    if (!nom) {
        alert("Veuillez saisir le nom de l'établissement.");
        return;
    }

    // Capture automatiquement l'ensemble des champs du formulaire et l'image du logo
    const formData = new FormData(form);

    try {
        const res = await fetch(`${API_URL}/ecoles`, {
            method: "POST",
            // Ne pas définir manuellement le Content-Type lors de l'envoi d'un FormData
            body: formData
        });

        if (res.ok) {
            fermerModalEcole();
            chargerEcoles();
            chargerStatistiques();
        } else {
            const errorData = await res.json();
            alert("Erreur lors de la création de l'école : " + (errorData.error || "Erreur serveur"));
        }
    } catch (err) {
        console.error("Erreur création école:", err);
    }
}

async function supprimerEcole(id) {
    if (!confirm("Voulez-vous vraiment supprimer cet établissement ?")) return;

    try {
        const res = await fetch(`${API_URL}/ecoles/${id}`, { method: "DELETE" });
        if (res.ok) {
            chargerEcoles();
            chargerStatistiques();
        }
    } catch (err) {
        console.error("Erreur suppression école:", err);
    }
}

// --- UTILISATEURS ---
async function chargerUtilisateurs() {
    try {
        const res = await fetch(`${API_URL}/users`);
        const users = await res.json();
        const tbody = document.getElementById("tbl-users");

        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Aucun utilisateur trouvé.</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr class="hover:bg-slate-50">
                <td class="p-4 font-bold text-slate-800">${u.username}</td>
                <td class="p-4 text-slate-500">${u.email}</td>
                <td class="p-4"><span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">${u.role}</span></td>
                <td class="p-4 text-slate-500">${u.ecole_nom || '—'}</td>
                <td class="p-4 text-right">
                    <button onclick="supprimerUtilisateur(${u.id})" class="text-rose-500 hover:text-rose-700 font-semibold text-xs">Supprimer</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("Erreur lors du chargement des utilisateurs:", err);
    }
}

async function supprimerUtilisateur(id) {
    if (!confirm("Voulez-vous vraiment supprimer cet utilisateur ?")) return;

    try {
        const res = await fetch(`${API_URL}/users/${id}`, { method: "DELETE" });
        if (res.ok) {
            chargerUtilisateurs();
            chargerStatistiques();
        }
    } catch (err) {
        console.error("Erreur suppression utilisateur:", err);
    }
}

// --- VALIDATION ENSEIGNANTS ---
async function chargerProfesseursEnAttente() {
    try {
        const res = await fetch(`${API_URL}/pending-profs`);
        const profs = await res.json();
        const tbody = document.getElementById("tbl-validations");

        if (!Array.isArray(profs) || profs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Aucune demande en attente.</td></tr>`;
            return;
        }

        tbody.innerHTML = profs.map(p => `
            <tr class="hover:bg-slate-50">
                <td class="p-4 font-bold text-slate-800">${p.username}</td>
                <td class="p-4 text-slate-500">${p.email}</td>
                <td class="p-4 text-slate-500">${p.ecole_nom || 'Non renseigné'}</td>
                <td class="p-4 text-right space-x-2">
                    <button onclick="traiterValidationProf(${p.id}, true)" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition">Approuver</button>
                    <button onclick="traiterValidationProf(${p.id}, false)" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition">Refuser</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("Erreur lors du chargement des demandes:", err);
    }
}

async function traiterValidationProf(id, approuve) {
    try {
        const res = await fetch(`${API_URL}/validate-prof/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approuve })
        });

        if (res.ok) {
            chargerProfesseursEnAttente();
            chargerStatistiques();
        }
    } catch (err) {
        console.error("Erreur validation professeur:", err);
    }
}

// ==========================================
// 3. GESTION DE LA MODALE
// ==========================================

function ouvrirModalEcole() {
    const form = document.getElementById("formAddEcole");
    if (form) form.reset();
    document.getElementById("ecole-couleur").value = "#4F46E5";

    const modal = document.getElementById("modal-ecole");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function fermerModalEcole() {
    const form = document.getElementById("formAddEcole");
    if (form) form.reset();

    const modal = document.getElementById("modal-ecole");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}