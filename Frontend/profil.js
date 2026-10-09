document.addEventListener('DOMContentLoaded', () => {
    // 1. Récupération de l'utilisateur connecté
    const userRaw = localStorage.getItem('user');
    if (!userRaw) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userRaw);

    // 2. Pré-remplissage des informations
    const usernameEl = document.getElementById('profile-username');
    const emailEl = document.getElementById('profile-email');
    const inputUsername = document.getElementById('input-username');
    const inputEmail = document.getElementById('input-email');

    if (usernameEl) usernameEl.textContent = user.username || user.nom || 'Utilisateur';
    if (emailEl) emailEl.textContent = user.email || '';
    if (inputUsername) inputUsername.value = user.username || user.nom || '';
    if (inputEmail) inputEmail.value = user.email || '';

    // Initiale pour l'avatar
    const initial = (user.username || user.nom || 'U').charAt(0).toUpperCase();
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) avatarEl.textContent = initial;

    // Badges (Rôle et École)
    const roleBadge = document.getElementById('badge-role');
    if (roleBadge) {
        let roleTexte = user.role;
        if (user.role === 'super_admin') roleTexte = 'Sudo Admin';
        else if (user.role === 'admin_ecole') roleTexte = 'Admin École';
        else if (user.role === 'professeur') roleTexte = 'Enseignant';
        else if (user.role === 'eleve') roleTexte = 'Élève';
        
        roleBadge.textContent = roleTexte;
    }

    const ecoleBadge = document.getElementById('badge-ecole');
    if (ecoleBadge) {
        ecoleBadge.textContent = user.ecole ? (user.ecole.nom || 'MathsCollege') : 'MathsCollege';
    }

    // Gestion du niveau d'étude (si c'est un élève)
    const role = (user.role || '').toLowerCase();
    if (role === 'eleve' || role === 'élève' || user.niveau) {
        const containerNiveau = document.getElementById('container-niveau');
        const badgeNiveau = document.getElementById('badge-niveau');
        const selectNiveau = document.getElementById('select-niveau');

        if (containerNiveau) containerNiveau.classList.remove('hidden');
        if (badgeNiveau) {
            badgeNiveau.classList.remove('hidden');
            badgeNiveau.textContent = user.niveau ? user.niveau.toUpperCase() : 'Non défini';
        }
        if (selectNiveau && user.niveau) {
            selectNiveau.value = user.niveau;
        }

        // Lancement du calcul de la progression de lecture
        chargerProgressionDepuisStorage(user);
    }

    // Attachement des événements de formulaires s'ils existent
    const formProfile = document.getElementById('formUpdateProfile') || document.getElementById('form-profile');
    if (formProfile) formProfile.addEventListener('submit', updateProfile);

    const formPassword = document.getElementById('formUpdatePassword');
    if (formPassword) formPassword.addEventListener('submit', updatePassword);
});

// 3. Mise à jour des informations du profil
async function updateProfile(event) {
    event.preventDefault();

    const user = JSON.parse(localStorage.getItem('user'));
    const inputUsername = document.getElementById('input-username');
    const inputEmail = document.getElementById('input-email');
    const selectNiveau = document.getElementById('select-niveau');

    const username = inputUsername ? inputUsername.value.trim() : user.username;
    const email = inputEmail ? inputEmail.value.trim() : user.email;
    const niveau = selectNiveau ? selectNiveau.value : user.niveau;

    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                username: username,
                email: email,
                niveau: niveau
            })
        });

        const data = await response.json();

        if (data.success) {
            // Mettre à jour le localStorage
            user.username = username;
            user.email = email;
            if (niveau) user.niveau = niveau;
            
            localStorage.setItem('user', JSON.stringify(user));

            alert('Profil mis à jour avec succès !');
            window.location.reload();
        } else {
            alert(data.message || 'Erreur lors de la mise à jour du profil.');
        }
    } catch (err) {
        console.error(err);
        alert('Erreur réseau ou serveur lors de la mise à jour.');
    }
}

// 4. Changement de mot de passe
async function updatePassword(event) {
    event.preventDefault();

    const user = JSON.parse(localStorage.getItem('user'));
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;

    if (!oldPassword || !newPassword) {
        alert('Veuillez remplir les deux champs de mot de passe.');
        return;
    }

    try {
        const response = await fetch('/api/user/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                oldPassword: oldPassword,
                newPassword: newPassword
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('Mot de passe modifié avec succès !');
            document.getElementById('formUpdatePassword').reset();
        } else {
            alert(data.message || 'Ancien mot de passe incorrect.');
        }
    } catch (err) {
        console.error(err);
        alert('Erreur réseau lors du changement de mot de passe.');
    }
}

// 5. Calcul et affichage de la progression de lecture
async function chargerProgressionDepuisStorage(userData) {
    const user = userData || JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const progRaw = localStorage.getItem('mathscollege_progression');
    const prog = progRaw ? JSON.parse(progRaw) : {};

    console.log("📌 Progression dans localStorage :", prog);

    const containerProgression = document.getElementById('container-progression');
    if (containerProgression) containerProgression.classList.remove('hidden');

    // Nettoyage et normalisation du niveau (ex: "6ÈME A" -> "6eme")
    let rawNiveau = user.niveau || '3eme';
    let niveauUser = rawNiveau.split(' ')[0]
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace('ème', 'eme')
        .replace('è', 'e');

    if (/^\d+$/.test(niveauUser)) {
        niveauUser += 'eme';
    }

    const ecoleId = user.ecole_id || (user.ecole ? user.ecole.id : 1);

    try {
        console.log(`📡 Requête API pour niveau: "${niveauUser}", ecole_id: ${ecoleId}`);

        const resAlgebre = await fetch(`/api/cours/${niveauUser}/algebre?ecole_id=${ecoleId}`);
        const coursAlgebre = resAlgebre.ok ? await resAlgebre.json() : [];

        const resGeometrie = await fetch(`/api/cours/${niveauUser}/geometrie?ecole_id=${ecoleId}`);
        const coursGeometrie = resGeometrie.ok ? await resGeometrie.json() : [];

        console.log("📚 Cours Algèbre reçus du serveur :", coursAlgebre);
        console.log("📐 Cours Géométrie reçus du serveur :", coursGeometrie);

        // Calcul Algèbre
        const totalAlgebre = Array.isArray(coursAlgebre) ? coursAlgebre.length : 0;
        let lusAlgebre = 0;
        if (totalAlgebre > 0) {
            coursAlgebre.forEach(c => {
                const idCours = c.id || c.cours_id;
                if (prog[idCours] === true || prog[String(idCours)] === true) {
                    lusAlgebre++;
                }
            });
        }
        const pctAlgebre = totalAlgebre > 0 ? Math.round((lusAlgebre / totalAlgebre) * 100) : 0;

        // Calcul Géométrie
        const totalGeometrie = Array.isArray(coursGeometrie) ? coursGeometrie.length : 0;
        let lusGeometrie = 0;
        if (totalGeometrie > 0) {
            coursGeometrie.forEach(c => {
                const idCours = c.id || c.cours_id;
                if (prog[idCours] === true || prog[String(idCours)] === true) {
                    lusGeometrie++;
                }
            });
        }
        const pctGeometrie = totalGeometrie > 0 ? Math.round((lusGeometrie / totalGeometrie) * 100) : 0;

        // Affichage dans le DOM
        const elPercentAlg = document.getElementById('percent-algebre');
        const elBarAlg = document.getElementById('bar-algebre');
        const elTextAlg = document.getElementById('text-algebre');

        const elPercentGeo = document.getElementById('percent-geometrie');
        const elBarGeo = document.getElementById('bar-geometrie');
        const elTextGeo = document.getElementById('text-geometrie');

        if (elPercentAlg) elPercentAlg.textContent = `${pctAlgebre}%`;
        if (elBarAlg) elBarAlg.style.width = `${pctAlgebre}%`;
        if (elTextAlg) elTextAlg.textContent = `${lusAlgebre} sur ${totalAlgebre} chapitres lus`;

        if (elPercentGeo) elPercentGeo.textContent = `${pctGeometrie}%`;
        if (elBarGeo) elBarGeo.style.width = `${pctGeometrie}%`;
        if (elTextGeo) elTextGeo.textContent = `${lusGeometrie} sur ${totalGeometrie} chapitres lus`;

    } catch (err) {
        console.error("❌ Erreur lors du chargement de la progression :", err);
    }
}