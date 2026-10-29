let currentNiveauId = null;

const levelsContainer = document.getElementById("levels-container");
const dashboard = document.getElementById("dashboard");
const levelsPage = document.getElementById("levels-page");
const contentPage = document.getElementById("content-page") || document.getElementById("content");

function chargerClassesSignup() {
    const niveauEl = document.getElementById('signup-level') || document.getElementById('signup-niveau') || document.getElementById('classe-select');
    if (!niveauEl) return;

    fetch('/api/classes')
        .then(res => res.json())
        .then(classes => {
            niveauEl.innerHTML = '<option value="">-- Sélectionne ta classe --</option>';
            classes.forEach(cls => {
                const option = document.createElement("option");
                option.value = cls.nom || cls.id;
                option.textContent = cls.nom;
                niveauEl.appendChild(option);
            });
        })
        .catch(err => {
            niveauEl.innerHTML = `
                <option value="">-- Sélectionne ta classe --</option>
                <option value="6ème">6ème</option>
                <option value="5ème">5ème</option>
                <option value="4ème">4ème</option>
                <option value="3ème">3ème</option>
            `;
        });
}

async function gererInscriptionSurPage(event) {
    event.preventDefault(); // Empêche le rechargement de la page
    console.log("➡️ La fonction d'inscription a bien été déclenchée !");

    const usernameEl = document.getElementById('signup-name') || document.getElementById('signup-user');
    const emailEl = document.getElementById('signup-email');
    const passwordEl = document.getElementById('signup-pass');
    const roleEl = document.getElementById('signup-role');
    // Correction ici : on cherche tous les ID possibles pour la classe
    const niveauEl = document.getElementById('signup-level') || document.getElementById('signup-niveau') || document.getElementById('classe-select');
    const ecoleEl = document.getElementById('signup-ecole');

    const username = usernameEl ? usernameEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';
    const password = passwordEl ? passwordEl.value.trim() : '';
    const role = roleEl ? roleEl.value : 'eleve';
    const niveau = niveauEl ? niveauEl.value : '';
    const ecole_id = ecoleEl ? ecoleEl.value : '';

    if (!username || !email || !password || !ecole_id) { 
        alert("Remplis tous les champs obligatoires !"); 
        return; 
    }
    if (role === 'eleve' && !niveau) { 
        alert("Veuillez sélectionner votre classe !"); 
        return; 
    }

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, role, niveau, ecole_id })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (role === 'eleve') {
                // 1. Affiche la modale d'information de compte en attente
                afficherModalValidation(
                    "Inscription réussie ! 🎒",
                    "Votre compte élève a bien été créé. Il sera actif une fois validé par l'administrateur de votre école."
                );
                
                // 2. Vide proprement le formulaire
                event.target.reset();
            } else {
                localStorage.setItem('user', JSON.stringify(data.user));
                if (data.user.role === 'professeur') window.location.href = "profs.html";
                else if (data.user.role === 'admin_ecole') window.location.href = "admin_ecole.html";
                else if (data.user.role === 'sudo_admin') window.location.href = "super_admin.html";
                else window.location.href = "index.html";
            }
        } else { 
            alert("Erreur : " + (data.message || "Impossible de créer le compte.")); 
        }
    } catch (e) { 
        console.error(e);
        alert("Le serveur ne répond pas."); 
    }
}

async function login() {
    const emailEl = document.getElementById('login-email');
    const passwordEl = document.getElementById('login-pass');
    const roleEl = document.getElementById('login-role');

    const email = emailEl ? emailEl.value.trim() : '';
    const password = passwordEl ? passwordEl.value.trim() : '';
    const role = roleEl ? roleEl.value : 'eleve';

    if (!email || !password) {
        alert("Veuillez saisir votre email et votre mot de passe.");
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = data.redirectUrl || "index.html";

        } else {
            // Affiche la modale si le compte est en attente (statut bloqué)
            afficherModalValidation(
                "Connexion suspendue ⚠️",
                data.message || "Erreur lors de la connexion."
            );
        }
    } catch (e) {
        console.error("Erreur connexion :", e);
        alert("Erreur serveur lors de la connexion.");
    }
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('user_progression');
    localStorage.removeItem('niveauSelectionne');
    window.location.href = "index.html";
}

function deconnexion() { logout(); }

function showContent(blockId, title) {
    const db = document.getElementById("dashboard");
    const cp = document.getElementById("content-page") || document.getElementById("content");

    if (db) { db.classList.add("hidden"); db.style.display = ""; }
    if (cp) { cp.classList.remove("hidden"); cp.style.display = ""; }
    
    const pageTitle = document.getElementById("content-title");
    if (pageTitle) pageTitle.textContent = title;

    document.querySelectorAll(".content-block").forEach(b => { b.classList.add("hidden"); b.style.display = ""; });

    if (blockId === "calculateur" || blockId === "calculateur-block") {
        document.getElementById("calculateur-block")?.classList.remove("hidden");
        return;
    }
    
    const container = document.getElementById(blockId) || document.getElementById(blockId + "-block");
    if (!container) return;
    
    container.classList.remove("hidden");
    container.innerHTML = "<h3 class='text-slate-500 font-semibold p-4'>Chargement...</h3>";

    const niveauActuel = localStorage.getItem('niveauSelectionne') || '6e';

    fetch(`/api/${blockId}/${niveauActuel}`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = `<h3 class="text-lg font-bold text-slate-800 mb-4">${title}</h3>`;
            if (!data || data.length === 0) {
                container.innerHTML += `<p class="text-slate-500 text-sm">Aucun contenu disponible pour ce niveau.</p>`;
                return;
            }

            data.forEach(item => {
                if (blockId === "cours") {
                    let renduFinal = (item.contenu.includes("<div") || item.contenu.includes("<h")) ? item.contenu : (typeof marked !== 'undefined' ? marked.parse(item.contenu) : item.contenu);
                    container.innerHTML += `
                        <div class="card bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-4">
                            <h4 class="font-bold text-slate-900 text-base mb-2">${item.titre}</h4>
                            <div class="course-body text-slate-700 text-sm leading-relaxed">${renduFinal}</div>
                        </div>`;
                } else if (blockId === "videos") {
                    let rawData = (item.youtube_id || item.url || "").trim();
                    let finalUrl = rawData.includes('http') ? (rawData.includes('watch?v=') ? rawData.replace('watch?v=', 'embed/') : rawData) : `https://www.youtube.com/embed/${rawData}`;
                    container.innerHTML += `
                        <div class="card bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6">
                            <h4 class="font-bold text-slate-900 mb-3">${item.titre}</h4>
                            <div class="video-wrapper relative pb-[56.25%] h-0 overflow-hidden rounded-xl bg-black">
                                <iframe class="absolute top-0 left-0 w-full h-full border-0" src="${finalUrl}" allowfullscreen></iframe>
                            </div>
                        </div>`;
                } else {
                    container.innerHTML += `
                        <div class="card bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-4">
                            <h4 class="font-bold text-slate-900 mb-2">${item.titre}</h4>
                            <div>${item.contenu || ""}</div>
                        </div>`;
                }
            });

            if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([container]);
        })
        .catch(e => { container.innerHTML = "<p class='text-rose-500 font-semibold p-4'>Erreur de chargement.</p>"; });
}

function afficherVueContent(type) {
    let titre = "Contenu";
    if (type === 'cours') titre = "Les Cours";
    if (type === 'videos') titre = "Les Vidéos";
    if (type === 'exercices') titre = "Les Exercices";
    if (type === 'calculateur') titre = "Mon Calculateur";
    showContent(type, titre);
}

document.addEventListener('DOMContentLoaded', () => {
    chargerClassesSignup();

    const userStocke = localStorage.getItem('user');
    const reponseIA = document.getElementById('reponseIA');

    if (userStocke) {
        const userData = JSON.parse(userStocke);
        document.getElementById('guest-zone')?.classList.add('hidden');
        document.getElementById('user-zone')?.classList.remove('hidden');
        document.getElementById('banner-guest')?.classList.add('hidden');
        document.getElementById('banner-user')?.classList.remove('hidden');

        const nom = userData.username || userData.nom || "Utilisateur";
        const classe = userData.niveau || userData.classe || "6e";

        if (document.getElementById('user-badge')) document.getElementById('user-badge').textContent = `Profil : ${userData.role || 'Élève'}`;
        if (document.getElementById('user-display-name')) document.getElementById('user-display-name').textContent = nom;
        if (document.getElementById('user-display-class')) document.getElementById('user-display-class').textContent = classe;

        if (userData.role === 'eleve' && classe) {
            const niveauEleveClean = classe.toLowerCase().replace('ème', 'e').replace('eme', 'e').trim();
            localStorage.setItem('niveauSelectionne', niveauEleveClean);
        }

        if (reponseIA) {
            reponseIA.innerHTML = `
                <div class="bot-msg bg-brand-50/80 p-3 rounded-2xl border-l-4 border-brand-500 text-sm text-slate-700">
                    <strong>Sylvie :</strong> Bonjour <strong>${nom}</strong> ! Prêt(e) à travailler ?
                </div>`;
        }
    } else {
        document.getElementById('guest-zone')?.classList.remove('hidden');
        document.getElementById('user-zone')?.classList.add('hidden');
        document.getElementById('banner-guest')?.classList.remove('hidden');
        document.getElementById('banner-user')?.classList.add('hidden');
    }

    if (levelsContainer) {
        fetch("/niveaux")
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    levelsContainer.innerHTML = ""; 

                    const user = JSON.parse(localStorage.getItem('user') || 'null');
                    const niveauEleve = user && user.niveau ? user.niveau.toLowerCase() : '';

                    data.forEach(niveau => {
                        const nomNiveauClean = niveau.nom.toLowerCase().replace('ème', 'e').replace('eme', 'e');
                        const eleveClean = niveauEleve.replace('ème', 'e').replace('eme', 'e');

                        if (user && user.role === 'eleve' && niveauEleve && !eleveClean.includes(nomNiveauClean)) {
                            return; 
                        }

                        const card = document.createElement("div");
                        card.className = "level-card bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between";
                        card.innerHTML = `
                            <h3 class="font-bold text-slate-900 text-lg mb-4">${niveau.nom}</h3>
                            <button class="action-btn bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2 px-4 rounded-xl text-sm transition w-full" onclick="selectionnerNiveau('${niveau.nom}')">Entrer</button>
                        `;
                        levelsContainer.appendChild(card);
                    });
                }
            })
            .catch(err => console.error("Mode local"));
    }
});

function selectionnerNiveau(niveau) {
    localStorage.setItem('niveauSelectionne', niveau);
    if (document.getElementById('current-niveau-display')) {
        document.getElementById('current-niveau-display').textContent = niveau;
    }
    document.getElementById('levels-page')?.classList.add('hidden');
    document.getElementById('dashboard')?.classList.remove('hidden');
}

function revenirAccueil() {
    document.getElementById('dashboard')?.classList.add('hidden');
    document.getElementById('content-page')?.classList.add('hidden');
    document.getElementById('levels-page')?.classList.remove('hidden');
}

function revenirDashboard() {
    document.getElementById('content-page')?.classList.add('hidden');
    document.getElementById('dashboard')?.classList.remove('hidden');
}

function afficherModalValidation(titre, texte) {
    const modal = document.getElementById('modal-validation');
    if (modal) {
        if (titre) document.getElementById('modal-titre').textContent = titre;
        if (texte) document.getElementById('modal-texte').textContent = texte;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function fermerModalValidation() {
    const modal = document.getElementById('modal-validation');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

async function envoyerQuestionIA() {
    const inputEl = document.getElementById('input-question-ia') || document.getElementById('question-ia');
    const reponseIA = document.getElementById('reponseIA');
    
    if (!inputEl) return;
    const question = inputEl.value.trim();
    if (!question) return;

    if (reponseIA) {
        reponseIA.innerHTML += `
            <div class="user-msg bg-slate-100 p-3 rounded-2xl text-sm text-slate-700 my-2 text-right">
                <strong>Toi :</strong> ${question}
            </div>`;
    }
    inputEl.value = '';

    try {
        const response = await fetch('/api/ia/demander', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await response.json();

        if (reponseIA) {
            reponseIA.innerHTML += `
                <div class="bot-msg bg-brand-50/80 p-3 rounded-2xl border-l-4 border-brand-500 text-sm text-slate-700 my-2">
                    <strong>Sylvie :</strong> ${data.reponse || "Je n'ai pas de réponse pour le moment."}
                </div>`;
            reponseIA.scrollTop = reponseIA.scrollHeight;
        }
    } catch (e) {
        console.error(e);
        if (reponseIA) {
            reponseIA.innerHTML += `
                <div class="bot-msg bg-rose-50 p-3 rounded-2xl text-sm text-rose-700 my-2">
                    <strong>Sylvie :</strong> Oups, une erreur est survenue.
                </div>`;
        }
    }
}