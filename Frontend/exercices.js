// Récupération sécurisée de l'utilisateur et de son école
const userStored = localStorage.getItem('user');
const currentUser = userStored ? JSON.parse(userStored) : null;
const ecoleId = currentUser?.ecole_id || currentUser?.ecole?.id || 1;
const couleurEcole = currentUser?.ecole_couleur || currentUser?.ecole?.couleur || currentUser?.couleur_primaire;

let domaineActuelExo = 'algebre';
const niveauChoisiExo = (localStorage.getItem('niveauSelectionne') || '6e').toLowerCase();
let listeExercicesCharges = [];

document.addEventListener("DOMContentLoaded", () => {
    // 1. Personnalisation du header et footer (Nom de l'école, Logo)
    if (currentUser) {
        const nomEcole = currentUser.ecole_nom || currentUser.ecole?.nom || currentUser.nom_ecole || (typeof currentUser.ecole === 'string' ? currentUser.ecole : null);
        const logoEcole = currentUser.ecole?.logo || currentUser.logo || currentUser.ecole_logo;
        
        if (nomEcole && nomEcole !== "1" && nomEcole !== "MathsCollege") {
            const headerTitleEl = document.getElementById('header-title');
            if (headerTitleEl) {
                headerTitleEl.textContent = nomEcole;
                headerTitleEl.className = "text-lg font-extrabold text-slate-900";
            }

            const headerLogoEl = document.getElementById('header-logo');
            if (headerLogoEl && logoEcole) {
                headerLogoEl.src = logoEcole;
            }

            const footerTitleEl = document.getElementById('footer-title');
            if (footerTitleEl) {
                footerTitleEl.textContent = nomEcole;
                footerTitleEl.className = "text-xl font-extrabold text-slate-900";
            }

            const footerLogoEl = document.getElementById('footer-logo');
            if (footerLogoEl && logoEcole) {
                footerLogoEl.src = logoEcole;
            }
        }
    }

    // Affichage du niveau dans l'en-tête
    const titreNiv = document.getElementById('niveau-titre-texte');
    if (titreNiv) {
        titreNiv.textContent = niveauChoisiExo.toUpperCase();
    }

    // Appliquer la couleur de l'école au chargement sur le bouton actif
    appliquerCouleurBoutonActif();

    chargerExercices();
});

function appliquerCouleurBoutonActif() {
    const btnAlg = document.getElementById('btn-algebre-exo');
    const btnGeo = document.getElementById('btn-geometrie-exo');
    
    const btnActif = (domaineActuelExo === 'algebre') ? btnAlg : btnGeo;
    const btnInactif = (domaineActuelExo === 'algebre') ? btnGeo : btnAlg;

    if (btnActif && btnInactif) {
        btnActif.className = "btn-domaine-exo px-4 py-2 rounded-xl transition text-white shadow-sm font-semibold";
        btnInactif.className = "btn-domaine-exo px-4 py-2 rounded-xl transition text-slate-600 hover:text-slate-900 font-semibold bg-white/50";

        if (couleurEcole) {
            btnActif.style.backgroundColor = couleurEcole;
            btnInactif.style.backgroundColor = '';
        } else {
            btnActif.classList.add('bg-brand-500');
        }
    }
}

function changerDomaineExo(domaine) {
    domaineActuelExo = domaine;
    appliquerCouleurBoutonActif();
    chargerExercices();
}

async function chargerExercices() {
    const conteneur = document.getElementById("liste-exercices");
    if (!conteneur) return;

    conteneur.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 text-sm">
            Chargement des exercices en cours...
        </div>
    `;

    try {
        // Ajout de l'ecole_id en paramètre pour respecter l'isolation des données par école
        const response = await fetch(`/api/exercices/${niveauChoisiExo}/${domaineActuelExo}?ecole_id=${ecoleId}`);
        
        if (!response.ok) throw new Error(`Erreur HTTP : ${response.status}`);

        listeExercicesCharges = await response.json();

        if (listeExercicesCharges.length === 0) {
            conteneur.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div class="text-3xl mb-2">📝</div>
                    <p class="text-slate-600 font-bold">Aucun exercice en ${domaineActuelExo}</p>
                    <p class="text-slate-400 text-xs mt-1">Aucun exercice n'a encore été ajouté pour cette section en ${niveauChoisiExo.toUpperCase()}.</p>
                </div>
            `;
            return;
        }

        conteneur.innerHTML = listeExercicesCharges.map((exo) => `
            <div onclick="afficherExercice(${exo.id})" class="bg-white p-5 rounded-3xl border border-slate-100 hover:border-slate-300 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group">
                <div>
                    <span class="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
                        ${exo.cours_titre || 'Chapitre'}
                    </span>
                    <h3 class="text-base font-bold text-slate-900 mt-3 group-hover:text-brand-600 transition">
                        ${exo.titre}
                    </h3>
                    <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        ${exo.enonce}
                    </p>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-600">
                    <span>Faire l'exercice</span>
                    <span>→</span>
                </div>
            </div>
        `).join("");

    } catch (error) {
        console.error("Erreur lors de la récupération des exercices :", error);
        conteneur.innerHTML = `
            <div class="col-span-full text-center py-12 bg-rose-50 rounded-3xl border border-rose-100 text-rose-600 text-sm">
                <p class="font-semibold">Impossible de charger les exercices.</p>
                <p class="text-xs mt-1">Vérifie la connexion au serveur.</p>
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
                    <p class="font-bold text-slate-800 text-xs">Fiche d'exercice (PDF)</p>
                    <p class="text-xs text-slate-500">Télécharge la fiche imprimable.</p>
                </div>
                <a href="${pdfUrl}" target="_blank" download class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition">
                    📄 Télécharger le sujet
                </a>
            </div>
        `;
    }

    document.getElementById("contenu-exercice").innerHTML = `
        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div>
                <span class="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
                    ${exo.cours_titre || 'Chapitre'}
                </span>
                <h2 class="text-xl font-bold text-slate-900 mt-3">${exo.titre}</h2>
            </div>
            
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-slate-800 text-sm font-medium leading-relaxed">
                ${exo.enonce}
            </div>

            ${pdfHtml}

            <!-- Solution -->
            <div class="pt-4 border-t border-slate-100">
                <button onclick="document.getElementById('solution-exo').classList.toggle('hidden')" class="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition shadow-sm">
                    💡 Voir la réponse / correction
                </button>
                <div id="solution-exo" class="hidden mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-medium leading-relaxed">
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