// Les variables globales et la navigation
let currentNiveauId = null;

const levelsContainer = document.getElementById("levels-container");
const dashboard = document.getElementById("dashboard");
const levelsPage = document.getElementById("levels-page");
const contentPage = document.getElementById("content");

// Fonctions pour l'ouverture/fermeture des Modals
function ouvrirModalLogin() { document.getElementById('login-modal').style.display = 'flex'; }
function fermerModalLogin() { document.getElementById('login-modal').style.display = 'none'; }
function ouvrirModalSignup() { document.getElementById('signup-modal').style.display = 'flex'; }
function fermerModalSignup() { document.getElementById('signup-modal').style.display = 'none'; }

// Navigation Niveaux (le Dashboard)
window.entrerDansNiveau = function(id, nom) {
    currentNiveauId = id;
    document.querySelector(".welcome").style.display = "none";
    levelsPage.style.display = "none";
    dashboard.style.display = "block";
    const titleElement = dashboard.querySelector(".title");
    if (titleElement) titleElement.textContent = "Niveau : " + nom;
};

// SIGNUP / LOGIN

async function signup() {
    const username = document.getElementById('signup-user').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-pass').value;
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
            localStorage.setItem('user', JSON.stringify({username, niveau}));
            fermerModalSignup();
            location.reload(); 
        } else { alert("Erreur : " + data.message); }
    } catch (e) { alert("Le serveur ne répond pas."); }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

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

function logout() {
    localStorage.removeItem('user');
    location.reload();
}

function mettreAJourInterface(data) {
    const btnLogin = document.querySelector('.login');
    if (btnLogin) btnLogin.innerText = data.username;
    
    const btnNav = document.querySelector('.nav-btn');
    if (btnNav) {
        btnNav.innerText = "Log out";
        btnNav.style.background = "#f44336"; 
        btnNav.onclick = logout;
    }
    const welcomeH2 = document.querySelector('.welcome h2');
    if (welcomeH2) welcomeH2.innerText = "Ravi de te revoir, " + data.username + " !";
}

//  Chargement au démarrage

window.onload = function() {
    const userStocke = localStorage.getItem('user');
    if (userStocke) {
        mettreAJourInterface(JSON.parse(userStocke));
    }

    fetch("http://localhost:3000/niveaux")
        .then(res => res.json())
        .then(data => {
            if (levelsContainer) {
                levelsContainer.innerHTML = ""; 
                data.forEach(niveau => {
                    const card = document.createElement("div");
                    card.className = "level-card";
                    card.innerHTML = `
                        <h3>${niveau.nom}</h3>
                        <button class="action-btn" onclick="entrerDansNiveau(${niveau.id}, '${niveau.nom}')">Entrer</button>
                    `;
                    levelsContainer.appendChild(card);
                });
            }
        })
        .catch(err => console.error("Serveur Backend éteint."));
};

// AFFICHEr COURS / VIDEOS 

function showContent(blockId, title) {
    dashboard.style.display = "none";
    contentPage.style.display = "block";
    document.getElementById("content-title").textContent = title;

    document.querySelectorAll(".content-block").forEach(b => b.style.display = "none");
    const container = document.getElementById(blockId);
    if (!container) return;
    container.style.display = "block";
    container.innerHTML = "<h3>Chargement...</h3>";

    fetch(`http://localhost:3000/api/${blockId}/${currentNiveauId}`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = `<h3>${title}</h3>`;
            data.forEach(item => {
                // --- DANS TA FONCTION SHOWCONTENT ---
if (blockId === "cours") {
    let renduFinal = "";

    // Si le contenu contient déjà des balises HTML (comme ton cours sur les Entiers)
    if (item.contenu.includes("<div") || item.contenu.includes("<h")) {
        renduFinal = item.contenu;
    } else {
        // Sinon, on transforme le Markdown (###, **) en HTML propre
        renduFinal = marked.parse(item.contenu);
    }

    container.innerHTML += `
        <div class="card recherche-item">
            <h4>${item.titre}</h4>
            <div class="course-body">
                ${renduFinal}
            </div>
        </div>`;
} 
// <-- L'ACCOLADE QUI MANQUAIT EST ICI !
else if (blockId === "videos") {
    let rawData = item.youtube_id.trim();
    // ... la suite de ton code vidéo ...
    let finalUrl = "";

    
    if (rawData.includes('http')) {
       
        if (rawData.includes('watch?v=')) {
            finalUrl = rawData.replace('watch?v=', 'embed/');
        } else {
            finalUrl = rawData;
        }
    } 
  
    else {
        finalUrl = `https://www.youtube.com/embed/${rawData}`;
    }

    container.innerHTML += `
        <div class="card recherche-item" style="margin-bottom: 25px; background: #fff; padding: 15px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h4 style="color: #333; margin-bottom: 10px;">${item.titre}</h4>
            <div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
                <iframe 
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
                    src="${finalUrl}" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>
            <p style="margin-top: 10px; font-size: 0.8em;">
                <a href="${finalUrl.replace('embed/', 'watch?v=')}" target="_blank" style="color: #3498db;">Voir directement sur YouTube</a>
            </p>
        </div>`;
}
 //  MATHJAX POuR LES COURs && window.MathJax.typesetPromise)
          if (window.MathJax)  {
               window.MathJax.typesetPromise([container]);
       }

           });
        }).catch(e => container.innerHTML = "Erreur de chargement.");
}

function resoudre() {
    const input = document.getElementById('equation-input').value.replace(/\s/g, '').replace(/,/g, '.');
    const display = document.getElementById('resultat-solveur');

    // 1. CAS DES CALCULS SIMPLES (Arithmétique + Racines + Puissances)
if (!input.includes('x') && !input.includes('=') && !input.includes('>') && !input.includes('<')) {
    try {
        let calcul = input.toLowerCase()
            .replace(/racine\(/g, 'Math.sqrt(') 
            .replace(/sqrt\(/g, 'Math.sqrt(')  
            .replace(/\^/g, '*')              
            .replace(/x/g, '*')                
            .replace(/:/g, '/');               
        const res = eval(calcul);
        
        
        display.innerHTML = `
            <div style="background: #f0f7ff; padding: 15px; border-radius: 10px; border: 1px solid #007bff; color: #004085;">
                <small>Calcul effectué :</small><br>
                <span style="font-size: 22px; font-weight: bold;">${res}</span>
            </div>`;
        return;
    } catch (e) {
        display.innerHTML = "<span style='color:red;'>Erreur : format invalide (ex: racine(16) + 2)</span>";
        return;
    }
}

    //  CAS DES ÉQUATIONS / INÉQUATIONS
    let type = input.includes('>') || input.includes('<') ? "inequation" : "equation";
    let symbole = input.match(/[=<>]/) ? input.match(/[=<>]/)[0] : "=";

    // le SECOND DEGRÉ 
    const quadraticMatch = input.match(/([+-]?\d*)x\^2([+-]?\d*)x([+-]?\d*)([=<>])0/);
    if (quadraticMatch) {
        let a = parseFloat(quadraticMatch[1] === "" || quadraticMatch[1] === "+" ? 1 : quadraticMatch[1] === "-" ? -1 : quadraticMatch[1]);
        let b = parseFloat(quadraticMatch[2] === "" || quadraticMatch[2] === "+" ? 1 : quadraticMatch[2] === "-" ? -1 : quadraticMatch[2]);
        let c = parseFloat(quadraticMatch[3] || 0);

        const delta = (b * b) - (4 * a * c);
        let html = `<div style="text-align:left; border-left:4px solid #007bff; padding-left:10px;">`;
        html += `<p><b>Forme :</b> ${a}x² + ${b}x + ${c} ${symbole} 0</p>`;
        html += `<p><b>Δ =</b> ${delta}</p>`;

        if (delta > 0) {
            const x1 = ((-b - Math.sqrt(delta)) / (2 * a)).toFixed(2);
            const x2 = ((-b + Math.sqrt(delta)) / (2 * a)).toFixed(2);
            html += `<p>Racines : <b>x₁ = ${x1}</b>, <b>x₂ = ${x2}</b></p>`;
        } else if (delta === 0) {
            html += `<p>Racine unique : <b>${(-b/(2*a)).toFixed(2)}</b></p>`;
        } else {
            html += `<p>Pas de racines réelles.</p>`;
        }
        display.innerHTML = html +`</div>` ;

    // le PREMIER DEGRÉ 
    } else {
        const linearMatch = input.match(/([+-]?\d*)x([+-]?\d*)([=<>])0/);
        if (linearMatch) {
            let a = parseFloat(linearMatch[1] === "" || linearMatch[1] === "+" ? 1 : linearMatch[1] === "-" ? -1 : linearMatch[1]);
            let b = parseFloat(linearMatch[2] || 0);
            let res = (-b / a).toFixed(2);
            display.innerHTML = `Solution : <b>x ${symbole} ${res}</b>`;
        } else {
            display.innerHTML = "Format : 2x+4=0 ou 1x^2-5x+6=0";
        }
    }
}
function effacerSolveur() {
    document.getElementById('equation-input').value = "";
    document.getElementById('resultat-solveur').innerText = "";
}

//  ECOUTEURS D'EVENEMENTS 

document.getElementById("btn-cours")?.addEventListener("click", () => showContent("cours", "Cours"));
document.getElementById("btn-videos")?.addEventListener("click", () => showContent("videos", "Vidéos"));
document.getElementById("back-dashboard")?.addEventListener("click", () => {
    contentPage.style.display = "none";
    dashboard.style.display = "block";
});

async function envoyerQuestionIA() {
    const input = document.getElementById('monInputIA');
    const reponseZone = document.getElementById('reponseIA');
    const question = input.value.trim();

    if (!question) return;

    // 1. Afficher le message utilisateur
    reponseZone.innerHTML += `<div class="user-msg" style="background: #5b6cff; color: white; padding: 10px; border-radius: 10px; margin-bottom: 10px; align-self: flex-end; text-align: right;">${question}</div>`;
    input.value = "";
    
    // 2. Création de la bulle de Rita qui attend
    const loadingId = "rita-load-" + Date.now();
    reponseZone.innerHTML += `<div id="${loadingId}" class="bot-msg" style="background: #f1f2f6; padding: 10px; border-radius: 10px; margin-bottom: 10px;"><em>Sylvie réfléchit...</em></div>`;
    
    reponseZone.scrollTop = reponseZone.scrollHeight;

    try {
        // 3. route serveur : /ask-ai
        const response = await fetch('http://localhost:3000/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: question }) // On envoie 'prompt' comme attendu par ton serveur
        });

        const data = await response.json();

        // 4. 'answer' reçu du serveur
        const ritaBubble = document.getElementById(loadingId);
        if (data.answer) {

            // marked.parse() transforme les ### en titres et les ** en gras
const htmlContent = marked.parse(data.answer);
ritaBubble.innerHTML = `<strong>Sylvie :</strong> ${htmlContent}`;

             //  MATHJAX POUR SYLvie
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([ritaBubble]);
            }

        } else {
            ritaBubble.innerHTML = "Désolée, je n'ai pas pu obtenir de réponse.";
        }

    } catch (error) {
        console.error("Erreur Rita:", error);
        document.getElementById(loadingId).innerHTML = "⚠️ Connexion perdue avec le serveur.";
    }

    reponseZone.scrollTop = reponseZone.scrollHeight;
}

// Reconnaitre l'élève connecté

document.addEventListener('DOMContentLoaded', () => {
    const userStocke = localStorage.getItem('user');
    
    if (userStocke) {
        const userData = JSON.parse(userStocke);
        
        //  On met à jour l'interface (tes boutons, ton texte de bienvenue)
        mettreAJourInterface(userData);
        
        
        const reponseIA = document.getElementById('reponseIA');
        if (reponseIA) {
            reponseIA.innerHTML = `
                <div class="bot-msg" style="background:#f1f2f6; padding:10px; border-radius:10px; margin-bottom:10px; border-left: 4px solid #5b6cff;">
                    <strong>Sylvie :</strong> Bonjour <strong>${userData.username}</strong> !  Je suis prête à t'aider. Que veux-tu réviser ?
                </div>`;
        }
    }
});

//Rita génère les exercices

function declencherEntrainement() {
    // récupère le nom de l'utilisateur
    const user = JSON.parse(localStorage.getItem('user'));
    const prenom = user ? user.username : "l'ami";

    // défiler la page vers Rita pour que le jury voie l'action
    document.getElementById('reponseIA').scrollIntoView({ behavior: 'smooth' });

    //  réponse immédiatement
    const reponseZone = document.getElementById('reponseIA');
    reponseZone.innerHTML += `
        <div class="bot-msg" style="background:#fff3cd; border-left:5px solid #5b6cff; padding:10px; border-radius:10px; margin-top:10px;">
            <strong>Sylvie:</strong> C'est parti ${prenom} ! Je te prépare une série d'exercices . 
            Dis-moi sur quoi veux-tu t'exercer !
        </div>`;
    
    reponseZone.scrollTop = reponseZone.scrollHeight;
}


