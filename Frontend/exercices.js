let domaineActuelExo = 'algebre';
const niveauChoisiExo = (localStorage.getItem('niveauSelectionne') || '6e').toLowerCase();
let listeExercicesCharges = [];

document.addEventListener("DOMContentLoaded", () => {
    chargerExercices();
});

function changerDomaineExo(domaine) {
    domaineActuelExo = domaine;
    
    // Basculer l'état visuel des onglets
    document.querySelectorAll('.btn-domaine-exo').forEach(btn => {
        btn.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
        btn.classList.add('text-slate-600');
    });

    const btnActif = document.getElementById(`btn-${domaine}-exo`);
    if (btnActif) {
        btnActif.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
        btnActif.classList.remove('text-slate-600');
    }

    chargerExercices();
}

async function chargerExercices() {
    const conteneur = document.getElementById("liste-exercices");
    if (!conteneur) return;

    try {
        const response = await fetch(`http://localhost:3000/api/exercices/${niveauChoisiExo}/${domaineActuelExo}`);
        
        if (!response.ok) throw new Error(`Erreur HTTP : ${response.status}`);

        listeExercicesCharges = await response.json();

        if (listeExercicesCharges.length === 0) {
            conteneur.innerHTML = `
                <div class="col-span-2 text-center py-12 bg-white rounded-3xl border border-slate-200">
                    <p class="text-slate-500 font-medium">Aucun exercice disponible pour cette section en ${niveauChoisiExo.toUpperCase()}.</p>
                </div>
            `;
            return;
        }

        conteneur.innerHTML = listeExercicesCharges.map((exo) => `
            <div onclick="afficherExercice(${exo.id})" class="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group">
                <div>
                    <span class="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        ${exo.cours_titre}
                    </span>
                    <h3 class="text-lg font-bold text-slate-900 mt-3 group-hover:text-indigo-600 transition">
                        ${exo.titre}
                    </h3>
                    <p class="text-sm text-slate-500 mt-1 line-clamp-2">
                        ${exo.enonce}
                    </p>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                    <span>Faire l'exercice</span>
                    <span>→</span>
                </div>
            </div>
        `).join("");

    } catch (error) {
        console.error("Erreur lors de la récupération des exercices :", error);
        conteneur.innerHTML = `
            <div class="col-span-2 text-center py-12 bg-red-50 rounded-3xl border border-red-100 text-red-600">
                <p class="font-semibold">Impossible de charger les exercices.</p>
                <p class="text-xs mt-1">Vérifie le terminal Node.js.</p>
            </div>
        `;
    }
}

function afficherExercice(idExo) {
    const exo = listeExercicesCharges.find(e => e.id === idExo);
    if (!exo) return;

    document.getElementById("vue-liste-exercices")?.classList.add("hidden");
    document.getElementById("vue-detail-exercice")?.classList.remove("hidden");

    let pdfHtml = '';
    if (exo.pdf_path) {
        const pdfUrl = exo.pdf_path.startsWith('/') ? exo.pdf_path : '/' + exo.pdf_path;
        pdfHtml = `
            <div class="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                    <p class="font-bold text-slate-800 text-sm">Fiche d'exercice (PDF)</p>
                    <p class="text-xs text-slate-500">Télécharge la fiche imprimable.</p>
                </div>
                <a href="http://localhost:3000${pdfUrl}" target="_blank" download class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition">
                    📄 Télécharger le sujet
                </a>
            </div>
        `;
    }

    document.getElementById("contenu-exercice").innerHTML = `
        <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <span class="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                ${exo.cours_titre}
            </span>
            <h2 class="text-xl font-bold text-slate-900 mt-2 mb-4">${exo.titre}</h2>
            
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-800 font-medium mb-6">
                ${exo.enonce}
            </div>

            ${pdfHtml}

            <!-- Solution -->
            <div class="mt-6 pt-6 border-t border-slate-100">
                <button onclick="document.getElementById('solution-exo').classList.toggle('hidden')" class="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition">
                    💡 Voir la réponse / correction
                </button>
                <div id="solution-exo" class="hidden mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-sm font-medium">
                    📌 <strong>Solution :</strong> ${exo.reponse_correcte}
                </div>
            </div>
        </div>
    `;

    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}

function retournerAuxExercices() {
    document.getElementById("vue-detail-exercice")?.classList.add("hidden");
    document.getElementById("vue-liste-exercices")?.classList.remove("hidden");
}