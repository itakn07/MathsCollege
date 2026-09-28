// Récupération du niveau sélectionné dans localStorage (ex: '6e')
const niveauSelectionne = (localStorage.getItem('niveauSelectionne') || '6e').toLowerCase();
let domaineActuel = 'algebre';

document.addEventListener("DOMContentLoaded", () => {
    // Affichage du nom du niveau dans l'en-tête
    const elTitreNiveau = document.getElementById("niveau-titre");
    if (elTitreNiveau) {
        elTitreNiveau.textContent = niveauSelectionne.toUpperCase();
    }

    // Chargement par défaut sur le domaine Algèbre
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
    
    // Si l'URL contient watch?v=
    if (urlOuId.includes('watch?v=')) {
        const videoId = urlOuId.split('watch?v=')[1].split('&')[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }

    // Si c'est déjà un lien /embed/
    if (urlOuId.includes('/embed/')) {
        return urlOuId;
    }

    // Si c'est juste un ID brut (ex: Lop-LKZXQSA)
    return `https://www.youtube.com/embed/${urlOuId}`;
}

/**
 * Récupère et affiche la liste des vidéos depuis l'API backend
 */
async function chargerVideos() {
    const grille = document.getElementById("videos-grid");
    if (!grille) return;

    // Indicateur de chargement
    grille.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 text-sm">
            Chargement des vidéos en cours...
        </div>
    `;

    try {
        const response = await fetch(`http://localhost:3000/api/videos/${niveauSelectionne}/${domaineActuel}`);
        if (!response.ok) throw new Error(`Erreur HTTP : ${response.status}`);

        const videos = await response.json();

        // Si aucune vidéo n'est enregistrée pour ce niveau et ce domaine
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

        // Génération dynamique du code HTML des cartes vidéos
        grille.innerHTML = videos.map(video => {
            const urlEmbed = corrigerUrlYoutube(video.youtube_id);

            return `
                <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                    <div>
                        <!-- Lecteur Iframe YouTube -->
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
                 Impossible de contacter le serveur local. Assure-toi que Node.js est bien lancé sur le port 3000.
            </div>
        `;
    }
}