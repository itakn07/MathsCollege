// profs.js - Logique de l'espace enseignant (Gérant multi-classes & historique)

let dashboardProfData = {
    classes: [],
    coursPublies: [],
    selectedClassId: null
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Contrôle d'accès et de session
    const userStored = localStorage.getItem('user');
    const currentUser = userStored ? JSON.parse(userStored) : null;

    if (!currentUser || (currentUser.role !== 'professeur' && currentUser.role !== 'sudo_admin')) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Écouteur pour la déconnexion
    const btnLogout = document.getElementById("btn-logout-prof");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }

    // 3. Initialisation des données du tableau de bord
    chargerStatsDashboard(currentUser.id);
    chargerListeCours();
    setupFormListeners(currentUser);
});

/**
 * Charge les classes, les effectifs, le top 10 IA et l'historique des publications
 */
async function chargerStatsDashboard(professeurId) {
    try {
        const response = await fetch(`/api/prof/dashboard-stats?professeur_id=${professeurId}`);
        if (response.ok) {
            const data = await response.json();
            
            if (data.success) {

const schoolBadge = document.getElementById('school-name-badge');
if (schoolBadge && data.ecoleNom) {
    schoolBadge.textContent = data.ecoleNom;
}

                dashboardProfData.classes = data.classes || [];
                dashboardProfData.coursPublies = data.coursPublies || [];

                // Sélectionner par défaut la première classe s'il y en a
                if (dashboardProfData.classes.length > 0) {
                    dashboardProfData.selectedClassId = dashboardProfData.classes[0].id;
                }

                renderClassesCards();
                renderSelectedClassStats();
                renderHistoriquePublications();
            }
        }
    } catch (err) {
        console.error("Erreur chargement statistiques :", err);
    }
}

/**
 * Affiche les cartes cliquables des classes de l'enseignant
 */
function renderClassesCards() {
    const container = document.getElementById("classes-cards-container");
    if (!container) return;

    container.innerHTML = "";

    if (dashboardProfData.classes.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic col-span-full">Aucune classe ne vous a encore été attribuée.</p>`;
        return;
    }

    dashboardProfData.classes.forEach(cls => {
        const isSelected = cls.id === dashboardProfData.selectedClassId;
        const card = document.createElement("button");
        card.className = `p-3.5 rounded-xl border text-left transition cursor-pointer ${
            isSelected 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
        }`;
        card.innerHTML = `
            <div class="text-[10px] uppercase font-semibold opacity-80">Classe</div>
            <div class="text-base font-black">${cls.nom}</div>
            <div class="text-xs font-normal mt-1 opacity-90">${cls.totalEleves} élève(s)</div>
        `;
        
        card.addEventListener("click", () => {
            dashboardProfData.selectedClassId = cls.id;
            renderClassesCards();
            renderSelectedClassStats();
        });

        container.appendChild(card);
    });
}

/**
 * Met à jour l'effectif et le Top 10 IA pour la classe actuellement sélectionnée
 */
function renderSelectedClassStats() {
    const selectedClass = dashboardProfData.classes.find(c => c.id === dashboardProfData.selectedClassId);
    
    const statEleves = document.getElementById('stat-total-eleves');
    const listContainer = document.getElementById('list-top-questions');

    if (!selectedClass) {
        if (statEleves) statEleves.textContent = "0";
        if (listContainer) {
            listContainer.innerHTML = `<li class="text-xs text-slate-400 italic">Sélectionnez une classe.</li>`;
        }
        return;
    }

    // Effectif de la classe active
    if (statEleves) statEleves.textContent = selectedClass.totalEleves;

    // Top 10 des questions IA de cette classe
    if (listContainer) {
        listContainer.innerHTML = '';
        if (!selectedClass.topQuestions || selectedClass.topQuestions.length === 0) {
            listContainer.innerHTML = `<li class="text-xs text-slate-400 italic">Aucune question posée par les élèves de cette classe.</li>`;
        } else {
            selectedClass.topQuestions.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center py-1.5 border-b border-slate-100 last:border-none text-xs';
                li.innerHTML = `
                    <span class="text-slate-800 font-medium"><strong>${index + 1}.</strong> ${item.question}</span>
                    <span class="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold">${item.frequence} fois</span>
                `;
                listContainer.appendChild(li);
            });
        }
    }
}

/**
 * Affiche l'historique des cours et exercices publiés par l'enseignant en bas de page
 */
function renderHistoriquePublications() {
    const container = document.getElementById("historique-publications-list");
    if (!container) return;

    container.innerHTML = "";

    if (dashboardProfData.coursPublies.length === 0) {
        container.innerHTML = `<p class="py-2 text-xs text-slate-400 italic">Vous n'avez publié aucun cours pour le moment.</p>`;
        return;
    }

    dashboardProfData.coursPublies.forEach(pub => {
        const item = document.createElement("div");
        item.className = "py-2.5 flex justify-between items-center text-xs";
        item.innerHTML = `
            <div>
                <span class="font-bold text-slate-800">${pub.titre}</span>
                <span class="text-slate-400 ml-2">(${pub.domaine || 'Mathématiques'})</span>
            </div>
            <span class="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded">📘 Cours publié</span>
        `;
        container.appendChild(item);
    });
}

/**
 * Charge la liste des cours existants dans le menu déroulant du formulaire des exercices
 */
async function chargerListeCours() {
    try {
        const response = await fetch('/api/prof/liste-cours');
        if (response.ok) {
            const cours = await response.json();
            const selectExoCours = document.getElementById('exo-cours-id');
            if (selectExoCours) {
                selectExoCours.innerHTML = '<option value="">Sélectionnez un cours...</option>';
                cours.forEach(c => {
                    selectExoCours.innerHTML += `<option value="${c.id}">${c.titre}</option>`;
                });
            }
        }
    } catch (err) {
        console.error("Erreur chargement liste des cours :", err);
    }
}

/**
 * Configure la soumission des formulaires (cours et exercices)
 */
function setupFormListeners(currentUser) {
    // Formulaire de publication de cours
    const formCours = document.getElementById('form-add-cours');
    if (formCours) {
        formCours.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData();
            formData.append('titre', document.getElementById('cours-titre').value);
            formData.append('niveau_id', document.getElementById('cours-niveau').value);
            formData.append('domaine', document.getElementById('cours-domaine').value);
            formData.append('contenu', document.getElementById('cours-contenu').value);
            formData.append('professeur_id', currentUser.id);
            formData.append('ecole_id', currentUser.ecole_id || currentUser.ecole?.id || 1);

            const fileInput = document.getElementById('cours-pdf');
            if (fileInput && fileInput.files[0]) {
                formData.append('pdf_file', fileInput.files[0]);
            }

            try {
                const response = await fetch('/api/prof/cours', {
                    method: 'POST',
                    body: formData
                });

                const resData = await response.json();
                if (response.ok) {
                    alert("✅ " + resData.message);
                    formCours.reset();
                    chargerListeCours(); 
                    chargerStatsDashboard(currentUser.id); // Recharge l'historique et les stats
                } else {
                    alert("Erreur : " + (resData.error || "Impossible de publier le cours."));
                }
            } catch (err) {
                console.error("Erreur lors de la publication du cours :", err);
                alert("Une erreur réseau est survenue.");
            }
        });
    }

    // Formulaire de publication d'exercice
    const formExercice = document.getElementById('form-add-exercice');
    if (formExercice) {
        formExercice.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData();
            formData.append('cours_id', document.getElementById('exo-cours-id').value);
            formData.append('titre', document.getElementById('exo-titre').value);
            formData.append('enonce', document.getElementById('exo-enonce').value);
            formData.append('reponse_correcte', document.getElementById('exo-reponse').value);

            const fileInput = document.getElementById('exo-pdf');
            if (fileInput && fileInput.files[0]) {
                formData.append('pdf_file', fileInput.files[0]);
            }

            try {
                const response = await fetch('/api/prof/exercices', {
                    method: 'POST',
                    body: formData
                });

                const resData = await response.json();
                if (response.ok) {
                    alert("✅ " + resData.message);
                    formExercice.reset();
                } else {
                    alert("Erreur : " + (resData.error || "Impossible de publier l'exercice."));
                }
            } catch (err) {
                console.error("Erreur lors de la publication de l'exercice :", err);
                alert("Une erreur réseau est survenue.");
            }
        });
    }
}