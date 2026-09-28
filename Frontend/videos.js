// Récupération du niveau sélectionné dans localStorage (ex: '6e')
const niveauSelectionne = (localStorage.getItem('niveauSelectionne') || '6e').toLowerCase();

document.addEventListener("DOMContentLoaded", () => {
    // Mise à jour du titre du niveau dans le header de la page
    const elTitreNiveau = document.getElementById("niveau-titre");
    if (elTitreNiveau) {
        elTitreNiveau.textContent = niveauSelectionne.toUpperCase();
    }

    chargerVideos();
});

/**
 * Nettoie et transforme n'importe quelle URL YouTube en URL intégrable /embed/
 */
function corrigerUrlYoutube(urlOuId) {
    if (!urlOuId) return '';
    
    // Si c'est un lien watch?v=...
    if (urlOuId.includes('watch?v=')) {
        const videoId = urlOuId.split('watch?v=')[1].split('&')[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }

    // Si c'est déjà un lien /embed/
    if (urlOuId.includes('/embed/')) {
        return urlOuId;
    }

    // Si c'est juste l'ID YouTube pur
    return `https://www.youtube.com/embed/${urlOuId}`;
}

/**
 * Récupère les vidéos depuis l'API Express
 */
async function chargerVideos() {
    const grille = document.getElementById("videos-grid");
    if (!grille) return;

    // Message de chargement
    grille.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 text-sm">
            Chargement des vidéos en cours...
        </div>
    `;

    try {
        const response = await fetch(`http://localhost:3000/api/videos/${niveauSelectionne}`);
        if (!response.ok) throw new Error(`Erreur HTTP : ${response.status}`);

        const videos = await response.json();

        if (videos.length === 0) {
            grille.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div class="text-3xl mb-2">🎬</div>
                    <p class="text-slate-600 font-bold">Aucune vidéo disponible</p>
                    <p class="text-slate-400 text-xs mt-1">Aucune leçon vidéo n'a encore été ajoutée pour la classe de ${niveauSelectionne.toUpperCase()}.</p>
                </div>
            `;
            return;
        }

        // Génération des cartes de vidéos
        grille.innerHTML = videos.map(video => {
            const urlEmbed = corrigerUrlYoutube(video.youtube_id);

            return `
                <div class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                    <div>
                        <!-- Lecteur Vidéo Responsive -->
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
        console.error("Erreur serveur :", error);
        grille.innerHTML = `
            <div class="col-span-full text-center py-12 bg-rose-50 rounded-3xl border border-rose-100 text-rose-600 text-sm">
                 Impossible de connecter au serveur local. Vérifie si node.js est lancé sur le port 3000.
            </div>
        `;
    }
}