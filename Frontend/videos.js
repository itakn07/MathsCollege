// Récupération sécurisée de l'utilisateur et de son école au chargement du script
const userStored = localStorage.getItem('user');
const currentUser = userStored ? JSON.parse(userStored) : null;
const ecoleId = currentUser?.ecole_id || currentUser?.ecole?.id || 1;

// Récupération du niveau sélectionné dans localStorage (ex: '6e')
const niveauSelectionne = (localStorage.getItem('niveauSelectionne') || '6e').toLowerCase();
let domaineActuel = 'algebre';

// Récupération de la couleur personnalisée de l'école (si définie)
const couleurEcole = currentUser?.ecole_couleur || currentUser?.ecole?.couleur || currentUser?.couleur_primaire;

// Unique écouteur global au chargement du DOM
document.addEventListener("DOMContentLoaded", () => {
    // 1. Personnalisation du nom, du logo et des éléments dans le header et le footer
    if (currentUser) {
        const nomEcole = currentUser.ecole_nom || currentUser.ecole?.nom || currentUser.nom_ecole || (typeof currentUser.ecole === 'string' ? currentUser.ecole : null);
        const logoEcole = currentUser.ecole?.logo || currentUser.logo || currentUser.ecole_logo;
        
        if (nomEcole && nomEcole !== "1" && nomEcole !== "MathsCollege") {
            // Header : Texte du nom de l'école
            const headerTitleEl = document.getElementById('header-title');
            if (headerTitleEl) {
                headerTitleEl.textContent = nomEcole;
                headerTitleEl.className = "text-lg font-extrabold text-slate-900";
            }

            // Header : Logo de l'école
            const headerLogoEl = document.getElementById('header-logo');
            if (headerLogoEl && logoEcole) {
                headerLogoEl.src = logoEcole;
            }

            // Footer : Texte du nom de l'école
            const footerTitleEl = document.getElementById('footer-title');
            if (footerTitleEl) {
                footerTitleEl.textContent = nomEcole;
                footerTitleEl.className = "text-xl font-extrabold text-slate-900";
            }

            // Footer : Logo de l'école
            const footerLogoEl = document.getElementById('footer-logo');
            if (footerLogoEl && logoEcole) {
                footerLogoEl.src = logoEcole;
            }
        }
    }

    // 2. Affichage du nom du niveau dans l'en-tête de la page
    const elTitreNiveau = document.getElementById("niveau-titre");
    if (elTitreNiveau) {
        elTitreNiveau.textContent = niveauSelectionne.toUpperCase();
    }

    // 3. Chargement initial des vidéos sur le domaine Algèbre
    filtrerDomaine('algebre');
});

/**
 * Change le domaine sélectionné (algebre ou geometrie) et recharge les vidéos
 * Applique dynamiquement la couleur de l'école sur le bouton actif
 */
function filtrerDomaine(domaine) {
    domaineActuel = domaine;

    // Gestion du style actif des boutons d'onglets
    const btnAlg = document.getElementById('btn-algebre');
    const btnGeo = document.getElementById('btn-geometrie');

    if (btnAlg && btnGeo) {
        if (domaine === 'algebre') {
            btnAlg.className = "px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition";
            btnGeo.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition";
            
            if (couleurEcole) {
                btnAlg.style.backgroundColor = couleurEcole;
                btnGeo.style.backgroundColor = '';
            } else {
                btnAlg.classList.add('bg-brand-500');
            }
        } else {
            btnGeo.className = "px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition";
            btnAlg.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition";
            
            if (couleurEcole) {
                btnGeo.style.backgroundColor = couleurEcole;
                btnAlg.style.backgroundColor = '';
            } else {
                btnGeo.classList.add('bg-brand-500');
            }
        }
    }

    chargerVideos();
}

/**
 * Nettoie et transforme tout format d'URL/ID YouTube en URL /embed/ valide
 */
function corrigerUrlYoutube(urlOuId) {
    if (!urlOuId) return '';
    
    if (urlOuId.includes('watch?v=')) {
        const videoId = urlOuId.split('watch?v=')[1].split('&')[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }

    if (urlOuId.includes('/embed/')) {
        return urlOuId;
    }

    return `https://www.youtube.com/embed/${urlOuId}`;
}

/**
 * Récupère et affiche la liste des vidéos depuis l'API backend en filtrant par école et domaine
 */
async function chargerVideos() {
    const grille = document.getElementById("videos-grid");
    if (!grille) return;

    grille.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 text-sm">
            Chargement des vidéos en cours...
        </div>
    `;

    try {
        let url = `/api/videos/${niveauSelectionne}?ecole_id=${ecoleId}`;
        if (domaineActuel) {
            url += `&domaine=${domaineActuel}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erreur HTTP : ${response.status}`);

        const videos = await response.json();

        if (videos.length === 0) {
            grille.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div class="text-3xl mb-2">🎬</div>
                    <p class="text-slate-600 font-bold">Aucune vidéo en ${domaineActuel}</p>
                    <p class="text-slate-400 text-xs mt-1">Aucune explication vidéo n'a encore été ajoutée pour ce domaine en ${niveauSelectionne.toUpperCase()}.</p>
                </div>
            `;
            return;
        }

        grille.innerHTML = videos.map(video => {
            const urlEmbed = corrigerUrlYoutube(video.youtube_id);

            return `
                <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                    <div>
                        <div class="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 mb-4 shadow-inner">
                            <iframe 
                                class="w-full h-full" 
                                src="${urlEmbed}" 
                                title="${video.titre}"
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen>
                            </iframe>
                        </div>
                        <h3 class="font-bold text-slate-900 text-base px-1 mb-1">${video.titre}</h3>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Erreur de chargement :", error);
        grille.innerHTML = `
            <div class="col-span-full text-center py-12 bg-rose-50 rounded-3xl border border-rose-100 text-rose-600 text-sm">
                 Impossible de charger les vidéos. Vérifie la connexion au serveur.
            </div>
        `;
    }
}