document.addEventListener('DOMContentLoaded', () => {
    // 1. Récupération de l'utilisateur connecté
    const userRaw = localStorage.getItem('user');
    if (!userRaw) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userRaw);

    // 2. Pré-remplissage des informations
    document.getElementById('profile-username').textContent = user.username || 'Utilisateur';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('input-username').value = user.username || '';
    document.getElementById('input-email').value = user.email || '';

    // Initiale pour l'avatar
    const initial = user.username ? user.username.charAt(0).toUpperCase() : 'U';
    document.getElementById('user-avatar').textContent = initial;

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
    if (ecoleBadge && user.ecole) {
        ecoleBadge.textContent = user.ecole.nom || 'MathsCollege';
    }

    // Gestion du niveau d'étude (si c'est un élève)
    if (user.role === 'eleve' || user.niveau) {
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
    }
});

// 3. Mise à jour des informations du profil
async function updateProfile(event) {
    event.preventDefault();

    const user = JSON.parse(localStorage.getItem('user'));
    const username = document.getElementById('input-username').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const selectNiveau = document.getElementById('select-niveau');
    const niveau = selectNiveau ? selectNiveau.value : null;

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

function chargerProgressionDepuisStorage() {
    // 1. Récupérer les cours lus depuis le localStorage (même clé que dans cours.js)
    const progRaw = localStorage.getItem('mathscollege_progression');
    const prog = progRaw ? JSON.parse(progRaw) : {};

    // 2. Afficher la section si c'est un élève
    const containerProgression = document.getElementById('container-progression');
    if (containerProgression) containerProgression.classList.remove('hidden');

    // 3. Charger la liste des cours (si disponible en localStorage ou via l'API des cours)
    // Sinon, parcourir les IDs ou faire un fetch simple de la liste des cours
    fetch('/api/cours')
        .then(res => res.json())
        .then(coursList => {
            let totalAlgebre = 0, lusAlgebre = 0;
            let totalGeometrie = 0, lusGeometrie = 0;

            coursList.forEach(c => {
                const estLu = prog[c.id] === true;
                const matiere = (c.matiere || '').toLowerCase();

                if (matiere.includes('alg') || c.categorie === 'algebre') {
                    totalAlgebre++;
                    if (estLu) lusAlgebre++;
                } else if (matiere.includes('géo') || c.categorie === 'geometrie') {
                    totalGeometrie++;
                    if (estLu) lusGeometrie++;
                }
            });

            // Calculs des pourcentages
            const pctAlgebre = totalAlgebre > 0 ? Math.round((lusAlgebre / totalAlgebre) * 100) : 0;
            const pctGeometrie = totalGeometrie > 0 ? Math.round((lusGeometrie / totalGeometrie) * 100) : 0;

            // Mise à jour de l'affichage DOM
            document.getElementById('percent-algebre').textContent = `${pctAlgebre}%`;
            document.getElementById('bar-algebre').style.width = `${pctAlgebre}%`;
            document.getElementById('text-algebre').textContent = `${lusAlgebre} sur ${totalAlgebre} chapitres lus`;

            document.getElementById('percent-geometrie').textContent = `${pctGeometrie}%`;
            document.getElementById('bar-geometrie').style.width = `${pctGeometrie}%`;
            document.getElementById('text-geometrie').textContent = `${lusGeometrie} sur ${totalGeometrie} chapitres lus`;
        })
        .catch(err => console.error("Erreur chargement liste des cours :", err));
}

// Appeler au chargement du DOM si l'utilisateur est un élève
document.addEventListener('DOMContentLoaded', () => {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return;
    const user = JSON.parse(userRaw);

    if (user.role === 'eleve') {
        chargerProgressionDepuisStorage();
    }
});