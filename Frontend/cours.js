// Récupération et nettoyage du niveau pour correspondre exactement à la BD ("6e", "5e", etc.)
const niveauBrut = localStorage.getItem('niveauSelectionne') || '6e';
const niveauChoisi = niveauBrut.toLowerCase().replace('ème', 'e').replace('E', 'e');
let domaineActuel = "algebre";
let listeCoursCharges = [];
let coursActuelId = null;

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
    // Mise à jour du libellé du niveau dans le header
    const badgeHeader = document.getElementById('badge-niveau-header');
    if (badgeHeader) {
        badgeHeader.innerText = `Classe de ${niveauChoisi.toUpperCase()}`;
    }

    // Afficher le marqueur du dernier cours consulté
    verifierDernierCoursConsulte();
});

// -------------------------------------------------------------
// GESTION DU MARQUEUR "REPRENDRE LA LECTURE"
// -------------------------------------------------------------
function sauvegarderDernierCours(chapitre) {
    const infosDernierCours = {
        id: chapitre.id,
        titre: chapitre.titre,
        domaine: domaineActuel,
        niveau: niveauChoisi
    };
    localStorage.setItem('mathscollege_dernier_cours', JSON.stringify(infosDernierCours));
}

function verifierDernierCoursConsulte() {
    const bloc = document.getElementById('bloc-reprendre-lecture');
    const dernier = JSON.parse(localStorage.getItem('mathscollege_dernier_cours'));

    if (!dernier || !bloc) return;

    // On vérifie que le cours enregistré correspond au niveau actuellement sélectionné
    if (dernier.niveau === niveauChoisi) {
        document.getElementById('reprendre-titre-cours').innerText = dernier.titre;
        document.getElementById('reprendre-domaine-cours').innerText = `${dernier.domaine === 'algebre' ? 'Algèbre' : 'Géométrie'} • Classe de ${niveauChoisi.toUpperCase()}`;
        
        // Configuration du bouton de reprise
        const btn = document.getElementById('btn-reprendre-lecture');
        btn.onclick = () => reprendreLectureDirecte(dernier);

        bloc.classList.remove('hidden');
    } else {
        bloc.classList.add('hidden');
    }
}

async function reprendreLectureDirecte(dernierCours) {
    domaineActuel = dernierCours.domaine;
    
    // On charge la liste du domaine en arrière-plan
    try {
        const response = await fetch(`/api/cours/${niveauChoisi}/${domaineActuel}`);
        if (response.ok) {
            listeCoursCharges = await response.json();
            // On ouvre directement la leçon
            lireLecon(dernierCours.id);
        }
    } catch (e) {
        console.error("Erreur de reprise de lecture :", e);
    }
}

// -------------------------------------------------------------
// GESTION DU STORAGE DE PROGRESSION
// -------------------------------------------------------------
function getProgressionStorage() {
    return JSON.parse(localStorage.getItem('mathscollege_progression')) || {};
}

function estCoursLu(idCours) {
    const prog = getProgressionStorage();
    return prog[idCours] === true;
}

function basculerEtatLecture(idCours) {
    const prog = getProgressionStorage();
    prog[idCours] = !prog[idCours];
    localStorage.setItem('mathscollege_progression', JSON.stringify(prog));

    renderBoutonLecture(idCours);
    actualiserAffichageListeEtProgression();
}

function actualiserAffichageListeEtProgression() {
    if (listeCoursCharges.length === 0) return;

    let totalLus = 0;
    listeCoursCharges.forEach(chapitre => {
        if (estCoursLu(chapitre.id)) {
            totalLus++;
        }
    });

    const total = listeCoursCharges.length;
    const pct = total > 0 ? Math.round((totalLus / total) * 100) : 0;

    const elPct = document.getElementById('progression-pourcentage');
    const elBarre = document.getElementById('progression-barre');
    const elLus = document.getElementById('chapitres-lus-count');
    const elTotaux = document.getElementById('chapitres-totaux-count');

    if (elPct) elPct.innerText = `${pct}%`;
    if (elBarre) elBarre.style.width = `${pct}%`;
    if (elLus) elLus.innerText = totalLus;
    if (elTotaux) elTotaux.innerText = total;

    renderCartesChapitres();
}

// -------------------------------------------------------------
// AFFICHAGE DES CHAPITRES
// -------------------------------------------------------------
async function selectionnerDomaine(domaine) {
    domaineActuel = domaine;

    document.getElementById("vue-domaine").classList.add("hidden");
    document.getElementById("vue-lecteur-cours").classList.add("hidden");
    document.getElementById("vue-liste-cours").classList.remove("hidden");

    const nomDomaine = domaine === "algebre" ? "Algèbre (Activités Numériques)" : "Géométrie (Activités Géométriques)";
    document.getElementById("titre-domaine").innerText = `${nomDomaine} - ${niveauChoisi.toUpperCase()}`;

    const conteneur = document.getElementById("conteneur-chapitres");
    conteneur.innerHTML = `
        <div class="col-span-2 text-center py-12">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mb-2"></div>
            <p class="text-slate-500 text-sm">Chargement des cours depuis la base de données...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/cours/${niveauChoisi}/${domaineActuel}`);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        listeCoursCharges = await response.json();

        if (listeCoursCharges.length === 0) {
            conteneur.innerHTML = `
                <div class="col-span-2 text-center py-12 bg-white rounded-3xl border border-slate-100">
                    <p class="text-slate-500 font-medium">Aucun cours d'${domaineActuel} n'est disponible pour la classe de ${niveauChoisi.toUpperCase()} pour le moment.</p>
                </div>
            `;
            return;
        }

        actualiserAffichageListeEtProgression();

    } catch (error) {
        console.error("Erreur lors de la récupération des cours :", error);
        conteneur.innerHTML = `
            <div class="col-span-2 text-center py-12 bg-red-50 rounded-3xl border border-red-100 text-red-600">
                <p class="font-semibold">Impossible de charger les cours.</p>
                <p class="text-xs mt-1">Vérifie que ton serveur Node.js est bien lancé sur le port 3000.</p>
            </div>
        `;
    }
}

function renderCartesChapitres() {
    const conteneur = document.getElementById("conteneur-chapitres");

    conteneur.innerHTML = listeCoursCharges.map((chapitre, index) => {
        const lu = estCoursLu(chapitre.id);
        const badgeStatut = lu 
            ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md">✓ Lu</span>`
            : `<span class="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-md">Non lu</span>`;

        return `
            <div onclick="lireLecon(${chapitre.id})" class="bg-white p-5 rounded-2xl border ${lu ? 'border-emerald-300' : 'border-slate-200'} hover:border-brand-500 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group">
                <div>
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg">
                            Chapitre ${index + 1}
                        </span>
                        ${badgeStatut}
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 mt-3 group-hover:text-brand-600 transition">
                        ${chapitre.titre}
                    </h3>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-600">
                    <span>Consulter la leçon</span>
                    <span>→</span>
                </div>
            </div>
        `;
    }).join("");
}

// -------------------------------------------------------------
// LECTURE D'UN COURS
// -------------------------------------------------------------
function lireLecon(idCours) {
    coursActuelId = idCours;
    const chapitre = listeCoursCharges.find(c => c.id === idCours);
    if (!chapitre) return;

    // SAUVEGARDE DU MARQUEUR DE LECTURE (Dernier cours consulté)
    sauvegarderDernierCours(chapitre);

    document.getElementById("vue-domaine").classList.add("hidden");
    document.getElementById("vue-liste-cours").classList.add("hidden");
    document.getElementById("vue-lecteur-cours").classList.remove("hidden");

    renderBoutonLecture(idCours);

    let htmlContenu = chapitre.contenu || "<p class='text-slate-500'>Contenu indisponible.</p>";

    if (chapitre.pdf_path) {
        const cheminPropre = chapitre.pdf_path.startsWith('/') ? chapitre.pdf_path : '/' + chapitre.pdf_path;
        const pdfUrl = `${cheminPropre}`;

        htmlContenu += `
            <div class="mt-8 p-5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
                <div>
                    <p class="font-bold text-slate-800 text-sm">Fiche de cours (PDF)</p>
                    <p class="text-xs text-slate-500">Télécharge le résumé imprimable de cette leçon.</p>
                </div>
                <a href="${pdfUrl}" target="_blank" download class="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-2">
                    📄 Télécharger le PDF
                </a>
            </div>
        `;
    }

    document.getElementById("contenu-cours").innerHTML = htmlContenu;

    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}

function renderBoutonLecture(idCours) {
    const zone = document.getElementById('zone-action-lecture');
    if (!zone) return;

    const lu = estCoursLu(idCours);

    if (lu) {
        zone.innerHTML = `
            <button onclick="basculerEtatLecture(${idCours})" class="px-3.5 py-1.5 bg-emerald-100 hover:bg-red-50 hover:text-red-600 text-emerald-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-emerald-200">
                <span>✓ Terminé</span>
                <span class="text-[10px] font-normal opacity-75">(Cliquer pour annuler)</span>
            </button>
        `;
    } else {
        zone.innerHTML = `
            <button onclick="basculerEtatLecture(${idCours})" class="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5">
                <span>Marquer comme lu</span>
            </button>
        `;
    }
}

// -------------------------------------------------------------
// NAVIGATION
// -------------------------------------------------------------
function retourAuxDomaines() {
    document.getElementById("vue-liste-cours").classList.add("hidden");
    document.getElementById("vue-lecteur-cours").classList.add("hidden");
    document.getElementById("vue-domaine").classList.remove("hidden");
    
    // Mettre à jour la bannière si un cours vient d'être ouvert
    verifierDernierCoursConsulte();
}

function retourALaListe() {
    document.getElementById("vue-lecteur-cours").classList.add("hidden");
    document.getElementById("vue-liste-cours").classList.remove("hidden");
}