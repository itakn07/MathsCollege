// Récupération du niveau sélectionné sur la page d'accueil (ex: '6e', '5e', '4e', '3e')
const niveauChoisi = localStorage.getItem('niveauSelectionne') || '6e';

let domaineActuel = "algebre";
let listeCoursCharges = [];

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
    // Mise à jour du libellé du niveau dans le header
    const badgeHeader = document.getElementById('badge-niveau-header');
    if (badgeHeader) {
        badgeHeader.innerText = `Classe de ${niveauChoisi.toUpperCase()}`;
    }
});

// 1. Action lors du clic sur l'une des cartes du domaine (Algèbre ou Géométrie)
async function selectionnerDomaine(domaine) {
    domaineActuel = domaine;

    // Bascule de l'affichage
    document.getElementById("vue-domaine").classList.add("hidden");
    document.getElementById("vue-lecteur-cours").classList.add("hidden");
    document.getElementById("vue-liste-cours").classList.remove("hidden");

    // Mise à jour du titre
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
        // Requête API vers le backend MySQL
        const response = await fetch(`http://localhost:3000/api/cours/${niveauChoisi}/${domaineActuel}`);
        
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

        // Génération des cartes de chaque chapitre
        conteneur.innerHTML = listeCoursCharges.map((chapitre) => `
            <div onclick="lireLecon(${chapitre.id})" class="bg-white p-5 rounded-2xl border border-slate-200 hover:border-brand-500 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group">
                <div>
                    <span class="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg">
                        Chapitre ${chapitre.chapitre_num}
                    </span>
                    <h3 class="text-lg font-bold text-slate-900 mt-3 group-hover:text-brand-600 transition">
                        ${chapitre.titre}
                    </h3>
                    <p class="text-sm text-slate-500 mt-1 line-clamp-2">
                        ${chapitre.description || ''}
                    </p>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-brand-600">
                    <span>Consulter la leçon</span>
                    <span>→</span>
                </div>
            </div>
        `).join("");

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

// 2. Action pour ouvrir la leçon d'un chapitre
function lireLecon(idCours) {
    const chapitre = listeCoursCharges.find(c => c.id === idCours);
    if (!chapitre) return;

    document.getElementById("vue-liste-cours").classList.add("hidden");
    document.getElementById("vue-lecteur-cours").classList.remove("hidden");

    // Injection du contenu HTML du cours
   let htmlContenu = chapitre.contenu_html;

// Vérifie si un fichier PDF est associé à ce cours
if (chapitre.pdf_path) {
    htmlContenu += `
        <div class="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div>
                <p class="font-bold text-slate-800 text-sm">Fiche de cours (PDF)</p>
                <p class="text-xs text-slate-500">Télécharge le résumé imprimable de cette leçon.</p>
            </div>
            <a href="http://localhost:3000${chapitre.pdf_path}" target="_blank" download class="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-xl shadow-sm transition">
                📥 Télécharger le PDF
            </a>
        </div>
    `;
}

document.getElementById("contenu-cours").innerHTML = htmlContenu;

    // Déclenchement du rendu MathJax pour afficher correctement les formules mathématiques
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}

// 3. Navigation de retour vers le choix du domaine
function retourAuxDomaines() {
    document.getElementById("vue-liste-cours").classList.add("hidden");
    document.getElementById("vue-lecteur-cours").classList.add("hidden");
    document.getElementById("vue-domaine").classList.remove("hidden");
}

// 4. Navigation de retour vers la liste des chapitres
function retourALaListe() {
    document.getElementById("vue-lecteur-cours").classList.add("hidden");
    document.getElementById("vue-liste-cours").classList.remove("hidden");
}