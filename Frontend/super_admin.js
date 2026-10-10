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
// 2. LOGIQUE D'ABONNEMENT ET CALCUL AUTOMATIQUE
// ==========================================

// Calcule la date de fin d'abonnement selon la formule sélectionnée (mensuel / annuel)
function calculerDateFinAutomatique() {
    const formuleEl = document.getElementById("ecole-formule");
    const dateInput = document.getElementById("ecole-date-fin");
    const statutInput = document.getElementById("ecole-statut");

    if (!formuleEl || !dateInput) return;

    const formule = formuleEl.value;
    const maintenant = new Date();

    if (formule === "mensuel") {
        maintenant.setMonth(maintenant.getMonth() + 1);
    } else if (formule === "annuel") {
        maintenant.setFullYear(maintenant.getFullYear() + 1);
    }

    // Format compatible avec <input type="datetime-local"> (YYYY-MM-DDTHH:mm)
    const year = maintenant.getFullYear();
    const month = String(maintenant.getMonth() + 1).padStart(2, '0');
    const day = String(maintenant.getDate()).padStart(2, '0');
    const hours = String(maintenant.getHours()).padStart(2, '0');
    const minutes = String(maintenant.getMinutes()).padStart(2, '0');

    dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (statutInput) {
        statutInput.value = "actif";
    }
}

// ==========================================
// 3. REQUÊTES API (FETCH)
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
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Aucun établissement enregistré.</td></tr>`;
            return;
        }

        tbody.innerHTML = ecoles.map(e => {
            const localisation = [e.quartier, e.arrondissement, e.ville].filter(Boolean).join(", ") || 'Non précisée';
            
            // Formatage de la date de fin d'abonnement
            let dateFinFormatee = "—";
            if (e.date_fin_abonnement) {
                const dateObj = new Date(e.date_fin_abonnement);
                dateFinFormatee = dateObj.toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }

            // Statut badge
            const estActif = e.statut_abonnement === 'actif';
            const badgeClass = estActif 
                ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                : "bg-rose-100 text-rose-800 border-rose-200";

            return `
                <tr class="hover:bg-slate-50">
                    <td class="p-4 font-bold text-slate-600">#${e.id}</td>
                    <td class="p-4 font-semibold text-slate-800">
                        <div class="flex items-center gap-2">
                            ${e.logo_url ? `<img src="${e.logo_url}" class="w-6 h-6 object-contain rounded">` : ''}
                            <span>${e.nom}</span>
                        </div>
                        <div class="text-xs text-slate-400 font-normal mt-0.5">${localisation}</div>
                    </td>
                    <td class="p-4 text-xs font-medium text-slate-600">
                        <span class="capitalize font-semibold">${e.formule_abonnement || '—'}</span><br>
                        <span class="text-slate-400 text-[11px]">Fin: ${dateFinFormatee}</span>
                    </td>
                    <td class="p-4">
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full border ${badgeClass}">
                            ${e.statut_abonnement || 'inactif'}
                        </span>
                    </td>
                    <td class="p-4 text-right space-x-2">
                        <button onclick="renouvelerAbonnement(${e.id}, '${e.formule_abonnement || 'mensuel'}')" class="text-brand-600 hover:text-brand-800 font-semibold text-xs bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg border border-brand-200 transition">
                            Renouveler
                        </button>
                        <button onclick="supprimerEcole(${e.id})" class="text-rose-500 hover:text-rose-700 font-semibold text-xs">
                            Supprimer
                        </button>
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

async function renouvelerAbonnement(id, formuleActuelle) {
    const formule = prompt("Choisissez la formule de renouvellement (mensuel ou annuel) :", formuleActuelle || "mensuel");
    if (!formule || (formule !== "mensuel" && formule !== "annuel")) return;

    try {
        const res = await fetch(`${API_URL}/ecoles/${id}/renouveler`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ formule })
        });

        if (res.ok) {
            const data = await res.json();
            alert(data.message || "Abonnement renouvelé avec succès !");
            chargerEcoles();
            chargerStatistiques();
        } else {
            const errData = await res.json();
            alert("Erreur lors du renouvellement : " + (errData.error || "Erreur serveur"));
        }
    } catch (err) {
        console.error("Erreur renouvellement abonnement:", err);
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
// 4. GESTION DE LA MODALE
// ==========================================

function ouvrirModalEcole() {
    const form = document.getElementById("formAddEcole");
    if (form) form.reset();

    // Valeurs par défaut
    document.getElementById("ecole-couleur").value = "#4F46E5";
    document.getElementById("ecole-formule").value = "mensuel";

    // Calculer automatiquement la date de fin
    calculerDateFinAutomatique();

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


// --- GESTION DE LA MODALE ADMIN D'ÉCOLE ---

// Ouvrir la modale et charger la liste des écoles dans le select
async function ouvrirModalAdminEcole() {
    const modal = document.getElementById('modal-admin-ecole');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const selectEcole = document.getElementById('admin-ecole-select');
    selectEcole.innerHTML = '<option value="">Chargement des écoles...</option>';

    try {
        const res = await fetch('/api/admin/ecoles');
        const ecoles = await res.json();

        selectEcole.innerHTML = '<option value="">-- Choisir une école --</option>';
        ecoles.forEach(ecole => {
            const option = document.createElement('option');
            option.value = ecole.id;
            option.textContent = ecole.nom;
            selectEcole.appendChild(option);
        });
    } catch (err) {
        console.error("Erreur chargement écoles :", err);
        selectEcole.innerHTML = '<option value="">Erreur de chargement</option>';
    }
}

function fermerModalAdminEcole() {
    const modal = document.getElementById('modal-admin-ecole');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    document.getElementById('formAddAdminEcole').reset();
}

// Envoyer la création de l'admin d'école au backend
async function creerAdminEcole(event) {
    event.preventDefault();

    const username = document.getElementById('admin-username').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const ecoleId = document.getElementById('admin-ecole-select').value;

    if (!ecoleId) {
        alert("Veuillez sélectionner un établissement.");
        return;
    }

    try {
        const response = await fetch('/api/admin/creer-admin-ecole', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                email: email,
                password: password,
                ecole_id: ecoleId
            })
        });

        const data = await response.json();
        if (data.success) {
            alert("Administrateur d'école créé avec succès !");
            fermerModalAdminEcole();
            // Recharge la liste des utilisateurs si la fonction existe
            if (typeof chargerUtilisateurs === 'function') {
                chargerUtilisateurs();
            }
        } else {
            alert(data.message || "Erreur lors de la création.");
        }
    } catch (err) {
        console.error("Erreur réseau :", err);
        alert("Erreur réseau ou serveur.");
    }
}