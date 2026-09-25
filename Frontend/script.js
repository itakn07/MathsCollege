// Les variables globales et la navigation
let currentNiveauId = null;

const levelsContainer = document.getElementById("levels-container");
const dashboard = document.getElementById("dashboard");
const levelsPage = document.getElementById("levels-page");
const contentPage = document.getElementById("content") || document.getElementById("content-page");

// Fonctions pour l'ouverture/fermeture des Modals (Compatible Tailwind)
function ouvrirModalLogin() { 
    const modal = document.getElementById('login-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function fermerModalLogin() { 
    const modal = document.getElementById('login-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}
function ouvrirModalSignup() { 
    const modal = document.getElementById('signup-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function fermerModalSignup() { 
    const modal = document.getElementById('signup-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// Navigation Niveaux (le Dashboard)
window.entrerDansNiveau = function(id, nom) {
    currentNiveauId = id;
    const welcome = document.querySelector(".welcome");
    if (welcome) welcome.style.display = "none";
    if (levelsPage) levelsPage.style.display = "none";
    if (dashboard) dashboard.style.display = "block";
    
    const titleElement = dashboard ? dashboard.querySelector(".title") : null;
    if (titleElement) titleElement.textContent = "Niveau : " + nom;
};

// SIGNUP / LOGIN

async function signup() {
    const username = document.getElementById('signup-user').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-pass').value.trim();
    const niveau = document.getElementById('signup-niveau').value;

    if (!username || !email || !password) { alert("Remplis tous les champs !"); return; }

    try {
        const response = await fetch('http://localhost:3000/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, niveau })
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('user', JSON.stringify({ username, niveau }));
            fermerModalSignup();
            location.reload(); 
        } else { alert("Erreur : " + data.message); }
    } catch (e) { alert("Le serveur ne répond pas."); }
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value.trim();

    if (!email || !password) { alert("Veuillez saisir votre email et votre mot de passe."); return; }

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data));
            fermerModalLogin();
            location.reload();
        } else { alert(data.message); }
    } catch (e) { alert("Erreur serveur."); }
}

// Déconnexion complète
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('user_progression');
    location.reload();
}
// Alias si appelé via deconnexion()
function deconnexion() {
    logout();
}

function mettreAJourInterface(data) {
    const btnLogin = document.querySelector('.login');
    if (btnLogin) btnLogin.innerText = data.username;
    
    const btnNav = document.getElementById('btn-signup-main') || document.querySelector('.nav-btn');
    if (btnNav) {
        btnNav.innerText = "Log out";
        btnNav.style.backgroundColor = "#ef4444"; 
        btnNav.onclick = logout;
    }
    const welcomeH2 = document.querySelector('.welcome h2');
    if (welcomeH2) welcomeH2.innerText = "Ravi de te revoir, " + data.username + " !";
}

// AFFICHER COURS / VIDEOS / EXERCICES / CALCULATEUR

function showContent(blockId, title) {
    if (dashboard) dashboard.style.display = "none";
    if (contentPage) {
        contentPage.style.display = "block";
        contentPage.classList.remove("hidden");
    }
    
    const pageTitle = document.getElementById("content-title");
    if (pageTitle) pageTitle.textContent = title;

    // Cacher tous les blocs de contenu
    document.querySelectorAll(".content-block").forEach(b => {
        b.style.display = "none";
        b.classList.add("hidden");
    });

    // Si le bloc cliqué est le calculateur
    if (blockId === "calculateur" || blockId === "calculateur-block") {
        const calcBlock = document.getElementById("calculateur-block");
        if (calcBlock) {
            calcBlock.style.display = "block";
            calcBlock.classList.remove("hidden");
        }
        return;
    }
    
    const container = document.getElementById(blockId) || document.getElementById(blockId + "-list");
    if (!container) return;
    
    container.style.display = "block";
    container.classList.remove("hidden");
    container.innerHTML = "<h3 class='text-slate-500 font-semibold p-4'>Chargement...</h3>";

    fetch(`http://localhost:3000/api/${blockId}/${currentNiveauId}`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = `<h3 class="text-lg font-bold text-slate-800 mb-4">${title}</h3>`;
            
            data.forEach(item => {
                if (blockId === "cours") {
                    let renduFinal = "";
                    if (item.contenu.includes("<div") || item.contenu.includes("<h")) {
                        renduFinal = item.contenu;
                    } else {
                        renduFinal = marked.parse(item.contenu);
                    }

                    container.innerHTML += `
                        <div class="card recherche-item bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-4">
                            <h4 class="font-bold text-slate-900 text-base mb-2">${item.titre}</h4>
                            <div class="course-body text-slate-700 text-sm leading-relaxed">
                                ${renduFinal}
                            </div>
                        </div>`;
                } 
                else if (blockId === "videos") {
                    let rawData = item.youtube_id.trim();
                    let finalUrl = "";

                    if (rawData.includes('http')) {
                        if (rawData.includes('watch?v=')) {
                            finalUrl = rawData.replace('watch?v=', 'embed/');
                        } else {
                            finalUrl = rawData;
                        }
                    } else {
                        finalUrl = `https://www.youtube.com/embed/${rawData}`;
                    }

                    container.innerHTML += `
                        <div class="card recherche-item bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6">
                            <h4 class="font-bold text-slate-900 mb-3">${item.titre}</h4>
                            <div class="video-wrapper relative pb-[56.25%] h-0 overflow-hidden rounded-xl bg-black">
                                <iframe 
                                    class="absolute top-0 left-0 w-full h-full border-0"
                                    src="${finalUrl}" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen>
                                </iframe>
                            </div>
                            <p class="mt-3 text-xs text-slate-500">
                                <a href="${finalUrl.replace('embed/', 'watch?v=')}" target="_blank" class="text-brand-500 hover:underline">Voir directement sur YouTube</a>
                            </p>
                        </div>`;
                } else {
                    // Pour les exercices ou autres contenus
                    container.innerHTML += `
                        <div class="card recherche-item bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-4">
                            <h4 class="font-bold text-slate-900 mb-2">${item.titre}</h4>
                            <div>${item.contenu || ""}</div>
                        </div>`;
                }
            });

            // MATHJAX POUR RENDRE LES FORMULES MATHEMATIQUES
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([container]);
            }
        })
        .catch(e => {
            console.error(e);
            container.innerHTML = "<p class='text-rose-500 font-semibold p-4'>Erreur de chargement des données.</p>";
        });
}

// Fonction wrapper pour compatibilité HTML
function afficherVueContent(type) {
    let titre = "Contenu";
    if (type === 'cours') titre = "Les Cours";
    if (type === 'videos') titre = "Les Vidéos";
    if (type === 'exercices') titre = "Les Exercices";
    if (type === 'calculateur') titre = "Mon Calculateur";
    
    showContent(type, titre);
}

// SOLVEUR D'EXERCICES

function resoudre() {
    const input = document.getElementById('equation-input').value.replace(/\s/g, '').replace(/,/g, '.');
    const display = document.getElementById('resultat-solveur');

    if (!input) {
        display.innerHTML = "<span class='text-rose-500'>Veuillez entrer un calcul ou une équation.</span>";
        return;
    }

    // 1. CAS DES CALCULS SIMPLES (Arithmétique + Racines + Puissances)
    if (!input.includes('x') && !input.includes('=') && !input.includes('>') && !input.includes('<')) {
        try {
            let calcul = input.toLowerCase()
                .replace(/racine\(/g, 'Math.sqrt(') 
                .replace(/sqrt\(/g, 'Math.sqrt(')  
                .replace(/\^/g, '**')              
                .replace(/:/g, '/');               
            
            const res = eval(calcul);
            
            display.innerHTML = `
                <div class="bg-brand-50 border border-brand-100 p-4 rounded-xl text-slate-800 mt-2">
                    <small class="text-xs text-slate-500">Résultat du calcul :</small><br>
                    <span class="text-2xl font-bold text-brand-500">${res}</span>
                </div>`;
            return;
        } catch (e) {
            display.innerHTML = "<span class='text-rose-500'>Erreur : format invalide (ex: racine(16) + 2^3)</span>";
            return;
        }
    }

    // 2. CAS DES ÉQUATIONS / INÉQUATIONS
    let symbole = input.match(/[=<>]/) ? input.match(/[=<>]/)[0] : "=";

    // LE SECOND DEGRÉ
    const quadraticMatch = input.match(/([+-]?\d*)x\^2([+-]?\d*)x([+-]?\d*)([=<>])0/);
    if (quadraticMatch) {
        let a = parseFloat(quadraticMatch[1] === "" || quadraticMatch[1] === "+" ? 1 : quadraticMatch[1] === "-" ? -1 : quadraticMatch[1]);
        let b = parseFloat(quadraticMatch[2] === "" || quadraticMatch[2] === "+" ? 1 : quadraticMatch[2] === "-" ? -1 : quadraticMatch[2]);
        let c = parseFloat(quadraticMatch[3] || 0);

        const delta = (b * b) - (4 * a * c);
        let html = `<div class="bg-slate-50 border-l-4 border-brand-500 p-4 rounded-r-xl text-left space-y-1 text-sm mt-2">`;
        html += `<p><b>Forme :</b> ${a}x² + ${b}x + ${c} ${symbole} 0</p>`;
        html += `<p><b>Δ =</b> ${delta}</p>`;

        if (delta > 0) {
            const x1 = ((-b - Math.sqrt(delta)) / (2 * a)).toFixed(2);
            const x2 = ((-b + Math.sqrt(delta)) / (2 * a)).toFixed(2);
            html += `<p>Racines : <b>x₁ = ${x1}</b>, <b>x₂ = ${x2}</b></p>`;
        } else if (delta === 0) {
            html += `<p>Racine unique : <b>x = ${(-b/(2*a)).toFixed(2)}</b></p>`;
        } else {
            html += `<p>Pas de racines réelles dans ℝ.</p>`;
        }
        display.innerHTML = html + `</div>`;

    // LE PREMIER DEGRÉ
    } else {
        const linearMatch = input.match(/([+-]?\d*)x([+-]?\d*)([=<>])0/);
        if (linearMatch) {
            let a = parseFloat(linearMatch[1] === "" || linearMatch[1] === "+" ? 1 : linearMatch[1] === "-" ? -1 : linearMatch[1]);
            let b = parseFloat(linearMatch[2] || 0);
            let res = (-b / a).toFixed(2);
            display.innerHTML = `<div class="mt-2 font-medium text-slate-800">Solution : <b class="text-brand-500">x ${symbole} ${res}</b></div>`;
        } else {
            display.innerHTML = "<span class='text-amber-600 text-xs'>Format attendu : 2x+4=0 ou 1x^2-5x+6=0</span>";
        }
    }
}

function effacerSolveur() {
    document.getElementById('equation-input').value = "";
    document.getElementById('resultat-solveur').innerHTML = "";
}

// COACH SYLVIE IA

async function envoyerQuestionIA() {
    const input = document.getElementById('monInputIA');
    const reponseZone = document.getElementById('reponseIA');
    const question = input.value.trim();

    if (!question) return;

    // 1. Afficher le message utilisateur
    reponseZone.innerHTML += `
        <div class="user-msg bg-brand-500 text-white p-3 rounded-2xl mb-3 max-w-[85%] ml-auto text-right text-sm">
            ${question}
        </div>`;
    input.value = "";
    
    // 2. Création de la bulle d'attente
    const loadingId = "load-" + Date.now();
    reponseZone.innerHTML += `
        <div id="${loadingId}" class="bot-msg bg-slate-100 text-slate-600 p-3 rounded-2xl mb-3 max-w-[85%] text-sm">
            <em>Sylvie réfléchit...</em>
        </div>`;
    
    reponseZone.scrollTop = reponseZone.scrollHeight;

    try {
        const response = await fetch('http://localhost:3000/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: question })
        });

        const data = await response.json();

        const botBubble = document.getElementById(loadingId);
        if (data.answer) {
            const htmlContent = marked.parse(data.answer);
            botBubble.innerHTML = `<strong class="text-brand-500">Sylvie :</strong> ${htmlContent}`;

            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([botBubble]);
            }
        } else {
            botBubble.innerHTML = "Désolée, je n'ai pas pu obtenir de réponse.";
        }

    } catch (error) {
        console.error("Erreur IA:", error);
        const errBubble = document.getElementById(loadingId);
        if (errBubble) errBubble.innerHTML = "⚠️ Connexion perdue avec le serveur.";
    }

    reponseZone.scrollTop = reponseZone.scrollHeight;
}

function declencherEntrainement() {
    const user = JSON.parse(localStorage.getItem('user'));
    const prenom = (user && user.username) ? user.username : "l'ami";

    const aiContainer = document.getElementById('ai-chat-container') || document.getElementById('reponseIA');
    if (aiContainer) aiContainer.scrollIntoView({ behavior: 'smooth' });

    const reponseZone = document.getElementById('reponseIA');
    if (reponseZone) {
        reponseZone.innerHTML += `
            <div class="bot-msg bg-amber-50 border-l-4 border-brand-500 text-slate-800 p-3 rounded-xl mt-3 text-sm">
                <strong>Sylvie :</strong> C'est parti ${prenom} ! Je te prépare une série d'exercices. 
                Dis-moi sur quel chapitre tu veux t'exercer !
            </div>`;
        reponseZone.scrollTop = reponseZone.scrollHeight;
    }
}

// INITIALISATION ET GESTION DE LA SESSION AU CHARGEMENT DE LA PAGE

document.addEventListener('DOMContentLoaded', () => {
    const userStocke = localStorage.getItem('user');
    const reponseIA = document.getElementById('reponseIA');

    if (userStocke) {
        // --- CAS 1 : UTILISATEUR CONNECTÉ ---
        const userData = JSON.parse(userStocke);
        mettreAJourInterface(userData);
        
        // Bannières & Profils
        document.getElementById('guest-zone')?.classList.add('hidden');
        document.getElementById('user-zone')?.classList.remove('hidden');
        document.getElementById('banner-guest')?.classList.add('hidden');
        document.getElementById('banner-user')?.classList.remove('hidden');

        const nom = userData.username || userData.nom || "Élève";
        const classe = userData.niveau || userData.classe || "6ème";

        if (document.getElementById('user-badge')) document.getElementById('user-badge').textContent = `Classe : ${classe}`;
        if (document.getElementById('user-display-name')) document.getElementById('user-display-name').textContent = nom;
        if (document.getElementById('user-display-class')) document.getElementById('user-display-class').textContent = classe;

        // Message de bienvenue du Coach Sylvie pour l'élève connecté
        if (reponseIA) {
            reponseIA.innerHTML = `
                <div class="bot-msg bg-brand-50/80 p-3 rounded-2xl border-l-4 border-brand-500 text-sm text-slate-700">
                    <strong>Sylvie :</strong> Bonjour <strong>${nom}</strong> ! Je suis prête à t'aider. Que veux-tu réviser ?
                </div>`;
        }
    } else {
        // --- CAS 2 : INVITÉ (NON CONNECTÉ) ---
        document.getElementById('guest-zone')?.classList.remove('hidden');
        document.getElementById('user-zone')?.classList.add('hidden');
        document.getElementById('banner-guest')?.classList.remove('hidden');
        document.getElementById('banner-user')?.classList.add('hidden');

        // Message de bienvenue générique pour l'invité (sans prénom)
        if (reponseIA) {
            reponseIA.innerHTML = `
                <div class="bot-msg bg-brand-50/80 p-3 rounded-2xl border-l-4 border-brand-500 text-sm text-slate-700">
                    <strong>Sylvie :</strong> Bonjour ! Je suis ta coach de maths. Pose-moi tes questions sur les cours ou un exercice !
                </div>`;
        }
    }

    // 2. Écouteurs d'événements des boutons du Dashboard
    document.getElementById("btn-cours")?.addEventListener("click", () => showContent("cours", "Cours"));
    document.getElementById("btn-videos")?.addEventListener("click", () => showContent("videos", "Vidéos"));
   

    // 3. Écouteur Touche Entrée pour l'IA
    document.getElementById('monInputIA')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') envoyerQuestionIA();
    });

    // 4. Chargement des niveaux depuis le Backend
    if (levelsContainer) {
        fetch("http://localhost:3000/niveaux")
            .then(res => res.json())
            .then(data => {
                levelsContainer.innerHTML = ""; 
                data.forEach(niveau => {
                    const card = document.createElement("div");
                    card.className = "level-card bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between";
                    card.innerHTML = `
                        <h3 class="font-bold text-slate-900 text-lg mb-4">${niveau.nom}</h3>
                        <button class="action-btn bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2 px-4 rounded-xl text-sm transition w-full" onclick="entrerDansNiveau(${niveau.id}, '${niveau.nom}')">Entrer</button>
                    `;
                    levelsContainer.appendChild(card);
                });
            })
            .catch(err => console.error("Serveur Backend éteint ou inaccessible."));
    }
});

// NAVIGATION ET SECTIONS

let currentNiveau = null;

function selectionnerNiveau(niveau) {
  currentNiveau = niveau;
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

function enregistrerProgression(titreChapitre, leconsTerminees, totalLecons) {
  const pourcentage = Math.round((leconsTerminees / totalLecons) * 100);
  const progression = {
    chapitre: titreChapitre,
    termes: leconsTerminees,
    total: totalLecons,
    pourcentage: pourcentage
  };
  localStorage.setItem('user_progression', JSON.stringify(progression));
}

function reprendreLecture() {
  afficherVueContent('cours');
}

function scrollToSolveur() {
  const box = document.getElementById('solveur-box') || document.getElementById('calculateur-block');
  box?.scrollIntoView({ behavior: 'smooth' });
}