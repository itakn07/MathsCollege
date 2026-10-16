// Récupération sécurisée de l'utilisateur et de son école
const userStored = localStorage.getItem('user');
const currentUser = userStored ? JSON.parse(userStored) : null;
const ecoleId = currentUser?.ecole_id || currentUser?.ecole?.id || 1;


document.addEventListener("DOMContentLoaded", () => {
    // 1. Récupération de l'utilisateur connecté depuis le localStorage
    const userStored = localStorage.getItem('user');
    const currentUser = userStored ? JSON.parse(userStored) : null;
    
    if (currentUser) {
        // Récupération du nom de l'école (selon la structure de ton objet user)
        const nomEcole = currentUser.ecole?.nom || currentUser.ecole_nom || (typeof currentUser.ecole === 'string' ? currentUser.ecole : null);
        
        if (nomEcole && nomEcole !== "1") {
            // Mise à jour du titre dans le header
            const headerTitleEl = document.getElementById('header-title');
            if (headerTitleEl) headerTitleEl.textContent = nomEcole;

            // Mise à jour du nom de l'école dans le footer
            const footerSchoolEl = document.getElementById('footer-school-name');
            if (footerSchoolEl) footerSchoolEl.textContent = nomEcole;
        }
    }

    // 2. Affichage du niveau et chargement des vidéos
    const elTitreNiveau = document.getElementById("niveau-titre");
    if (elTitreNiveau) {
        elTitreNiveau.textContent = niveauSelectionne.toUpperCase();
    }

    chargerVideos();
});

// Récupération du niveau sélectionné dans localStorage (ex: '6e')
const niveauSelectionne = (localStorage.getItem('niveauSelectionne') || '6e').toLowerCase();
let domaineActuel = 'algebre';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Personnaliser le nom du site dans le header selon l'école connectée
    const headerTitleEl = document.querySelector('header h1');
    if (headerTitleEl && currentUser) {
        const nomEcole = currentUser.ecole_nom || currentUser.ecole?.nom || currentUser.ecole || "MathsCollege";
        // Si l'utilisateur appartient à une école spécifique, on affiche son nom
        if (nomEcole && nomEcole !== "1") {
            headerTitleEl.textContent = nomEcole;
        }
    }

    // 2. Affichage du nom du niveau dans l'en-tête
    const elTitreNiveau = document.getElementById("niveau-titre");
    if (elTitreNiveau) {
        elTitreNiveau.textContent = niveauSelectionne.toUpperCase();
    }

    // 3. Chargement par défaut sur le domaine Algèbre
    filtrerDomaine('algebre');
});

/**
 * Change le domaine sélectionné (algebre ou geometrie) et recharge les vidéos
 */
function filtrerDomaine(domaine) {
    domaineActuel = domaine;

    // Gestion du style actif des boutons d'onglets
    const btnAlg = document.getElementById('btn-algebre');
    const btnGeo = document.getElementById('btn-geometrie');

    if (btnAlg && btnGeo) {
        if (domaine === 'algebre') {
            btnAlg.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white shadow-sm transition";
            btnGeo.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition";
        } else {
            btnGeo.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white shadow-sm transition";
            btnAlg.className = "px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition";
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
        // Construction de l'URL unique avec le niveau dans l'URL, et le domaine/école en paramètres GET
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