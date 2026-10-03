// profs.js - Logique de l'espace enseignant

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

    // 3. Initialisation des données
    chargerStatsDashboard();
    chargerListeCours();
    setupFormListeners(currentUser);
});

/**
 * Charge le nombre d'élèves et le top 10 des notions demandées à l'IA
 */
async function chargerStatsDashboard() {
    try {
        const response = await fetch('/api/prof/dashboard-stats');
        if (response.ok) {
            const data = await response.json();
            
            // Mise à jour du total d'élèves
            const statEleves = document.getElementById('stat-total-eleves');
            if (statEleves) statEleves.textContent = data.totalEleves || 0;

            // Mise à jour du Top 10 des questions IA
            const listContainer = document.getElementById('list-top-questions');
            if (listContainer) {
                listContainer.innerHTML = '';
                if (!data.topQuestions || data.topQuestions.length === 0) {
                    listContainer.innerHTML = `<li class="text-xs text-slate-400 italic">Aucune donnée disponible pour le moment.</li>`;
                } else {
                    data.topQuestions.forEach((item, index) => {
                        const li = document.createElement('li');
                        li.className = 'flex justify-between items-center py-1 border-b border-slate-100 last:border-none';
                        li.innerHTML = `
                            <span><strong>${index + 1}.</strong> ${item.question}</span>
                            <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">${item.frequence} fois</span>
                        `;
                        listContainer.appendChild(li);
                    });
                }
            }
        }
    } catch (err) {
        console.error("Erreur chargement statistiques :", err);
    }
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
            formData.append('ecole_id', currentUser.ecole ? currentUser.ecole.id : 1);

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
                    chargerListeCours(); // Met à jour la liste des cours disponibles
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