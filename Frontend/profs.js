document.addEventListener('DOMContentLoaded', () => {
    fetchStats();

    // Attacher les écouteurs d'événements
    document.getElementById('form-cours').addEventListener('submit', handleCoursSubmit);
    document.getElementById('form-exercice').addEventListener('submit', handleExerciceSubmit);
});

/**
 * Récupère le nombre d'élèves et le top 10 des questions IA
 */
async function fetchStats() {
    try {
        const response = await fetch('/api/prof/dashboard-stats');
        const data = await response.json();

        // 1. Mise à jour du compteur d'élèves
        document.getElementById('stat-eleves').textContent = data.totalEleves || 0;

        // 2. Mise à jour de la liste des questions
        const listContainer = document.getElementById('list-top-questions');
        listContainer.innerHTML = '';

        if (!data.topQuestions || data.topQuestions.length === 0) {
            listContainer.innerHTML = '<li class="py-3 text-sm text-slate-400 italic">Aucune question enregistrée pour le moment.</li>';
            return;
        }

        data.topQuestions.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'py-3 flex items-center justify-between gap-4 text-sm';
            
            li.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <span class="font-bold text-slate-400 w-5 text-right">${index + 1}.</span>
                    <span class="text-slate-700 truncate font-medium">${escapeHtml(item.question)}</span>
                </div>
                <span class="shrink-0 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-100">
                    ${item.frequence} fois
                </span>
            `;
            listContainer.appendChild(li);
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des données du tableau de bord:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    loadCoursesDropdown(); // <-- Ajouter cet appel ici

    document.getElementById('form-cours').addEventListener('submit', handleCoursSubmit);
    document.getElementById('form-exercice').addEventListener('submit', handleExerciceSubmit);
});

// Fonction pour remplir automatiquement le menu déroulant des cours
async function loadCoursesDropdown() {
    const selectEl = document.getElementById('select-cours');
    try {
        const res = await fetch('/api/prof/liste-cours');
        const coursList = await res.json();

        selectEl.innerHTML = '<option value="">-- Sélectionnez un cours --</option>';

        if (coursList.length === 0) {
            selectEl.innerHTML = '<option value="">Aucun cours disponible (créez-en un d\'abord)</option>';
            return;
        }

        coursList.forEach(cours => {
            const option = document.createElement('option');
            option.value = cours.id; // L'ID reste envoyé au backend
            option.textContent = cours.titre; // Mais le prof voit le TITRE !
            selectEl.appendChild(option);
        });

    } catch (err) {
        console.error("Erreur chargement des cours dans le select:", err);
        selectEl.innerHTML = '<option value="">Erreur de chargement</option>';
    }
}

/**
 * Soumission du formulaire de cours
 */
async function handleCoursSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch('/api/prof/cours', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('msg-cours', result.message || 'Cours ajouté avec succès !', true);
            form.reset();
            loadCoursesDropdown();
        } else {
            showNotification('msg-cours', result.error || 'Erreur lors de l\'ajout du cours.', false);
        }
    } catch (error) {
        showNotification('msg-cours', 'Erreur de réseau ou serveur injoignable.', false);
    }
}

/**
 * Soumission du formulaire d'exercice
 */
async function handleExerciceSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch('/api/prof/exercices', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('msg-exercice', result.message || 'Exercice ajouté avec succès !', true);
            form.reset();
            
        } else {
            showNotification('msg-exercice', result.error || 'Erreur lors de l\'ajout de l\'exercice.', false);
        }
    } catch (error) {
        showNotification('msg-exercice', 'Erreur de réseau ou serveur injoignable.', false);
    }
}

/**
 * Affiche une alerte stylisée Tailwind
 */
function showNotification(elementId, message, isSuccess) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    
    // Réinitialiser les classes
    el.className = 'p-3 rounded-lg text-sm font-medium border transition-all duration-200';

    if (isSuccess) {
        el.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    } else {
        el.classList.add('bg-rose-50', 'text-rose-700', 'border-rose-200');
    }

    el.classList.remove('hidden');

    setTimeout(() => {
        el.classList.add('hidden');
    }, 4000);
}

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 */
function escapeHtml(str) {
    return str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : '';
}