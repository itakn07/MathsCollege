document.addEventListener('DOMContentLoaded', () => {
    // 1. Récupération des données utilisateur dans le localStorage
    const userData = localStorage.getItem('user');

    if (!userData) {
        // Redirection vers la page de connexion si aucune session n'est trouvée
        window.location.href = 'login.html';
        return;
    }

    try {
        const user = JSON.parse(userData);

        // 2. Application du thème de l'école si présent dans la session
        if (user && user.ecole) {
            
            // Appliquer la couleur primaire personnalisée (Variable CSS)
            if (user.ecole.couleur) {
                document.documentElement.style.setProperty('--brand-primary', user.ecole.couleur);
            }

            // Mettre à jour le logo de l'établissement (si l'élément HTML existe)
            const schoolLogo = document.getElementById('school-logo');
            if (schoolLogo && user.ecole.logo) {
                schoolLogo.src = user.ecole.logo;
                schoolLogo.alt = `Logo ${user.ecole.nom || 'École'}`;
            }

            // Mettre à jour le nom de l'établissement (si l'élément HTML existe)
            const schoolName = document.getElementById('school-name');
            if (schoolName && user.ecole.nom) {
                schoolName.textContent = user.ecole.nom;
            }
        }

        // 3. Optionnel : Afficher le nom d'utilisateur connecté dans l'en-tête
        const usernameEl = document.getElementById('user-display-name');
        if (usernameEl && user.username) {
            usernameEl.textContent = user.username;
        }

    } catch (err) {
        console.error("Erreur lors du chargement du thème de l'école :", err);
    }
});

//footer dynamique
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));

    const addressText = document.getElementById('footer-address-text');
    const emailText = document.getElementById('footer-email-text');
    const emailLink = document.getElementById('footer-email-link');
    const phoneText = document.getElementById('footer-phone-text');
    const phoneLink = document.getElementById('footer-phone-link');

    if (user && user.ecole) {
        if (user.ecole.adresse && addressText) {
            addressText.textContent = user.ecole.adresse;
        }
        if (user.ecole.email_contact && emailText && emailLink) {
            emailText.textContent = user.ecole.email_contact;
            emailLink.href = `mailto:${user.ecole.email_contact}`;
        }
        if (user.ecole.telephone && phoneText && phoneLink) {
            phoneText.textContent = user.ecole.telephone;
            phoneLink.href = `tel:${user.ecole.telephone.replace(/\s+/g, '')}`;
        }
    }
});


// profil.html

document.addEventListener('DOMContentLoaded', () => {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return;

    const user = JSON.parse(userRaw);
    const ecole = user.ecole;

    if (!ecole) return;

    // 1. Détermination de la couleur de l'école (avec couleur par défaut si non définie)
    const primaryColor = ecole.couleur_primaire || ecole.couleur || '#0284c7';

    // 2. Application de la couleur aux textes (Nom dans Header, Footer, Titres, etc.)
    const textBrandElements = document.querySelectorAll('.text-brand-500, .text-brand-600, .text-brand-700');
    textBrandElements.forEach(el => {
        el.style.color = primaryColor;
    });

    // Colorer spécifiquement le nom dans le header et le footer
    const headerSchoolName = document.getElementById('header-school-name');
    const footerSchoolName = document.getElementById('footer-school-name');
    if (headerSchoolName) headerSchoolName.style.color = primaryColor;
    if (footerSchoolName) footerSchoolName.style.color = primaryColor;

    // 3. Application de la couleur aux fonds (Boutons, Badges, Avatars, etc.)
    const bgBrandElements = document.querySelectorAll('.bg-brand-500, .bg-brand-600, #user-avatar');
    bgBrandElements.forEach(el => {
        el.style.backgroundColor = primaryColor;
    });

    // 4. Injection du NOM de l'établissement (Header & Footer)
    const ecoleNom = ecole.nom || 'MathsCollege';
    if (headerSchoolName) headerSchoolName.textContent = ecoleNom;
    if (footerSchoolName) footerSchoolName.textContent = ecoleNom;

    // 5. Injection du LOGO de l'établissement (Header & Footer)
    const logoSrc = ecole.logo_url || ecole.logo || 'uploads/logo_default.png';
    const headerLogo = document.getElementById('header-logo');
    const footerLogo = document.getElementById('footer-logo');
    
    if (headerLogo) {
        headerLogo.src = logoSrc;
        headerLogo.style.width = 'auto';
    }
    if (footerLogo) {
        footerLogo.src = logoSrc;
        footerLogo.style.width = 'auto';
    }

    // 6. Injection des COORDONNÉES dans le Footer (Adresse, Email, Téléphone)
    const addressText = document.getElementById('footer-address-text');
    const emailText = document.getElementById('footer-email-text');
    const emailLink = document.getElementById('footer-email-link');
    const phoneText = document.getElementById('footer-phone-text');
    const phoneLink = document.getElementById('footer-phone-link');

    if (ecole.adresse && addressText) {
        addressText.textContent = ecole.adresse;
    } else if (ecole.ville && addressText) {
        const quartier = ecole.quartier ? `${ecole.quartier}, ` : '';
        addressText.textContent = `${quartier}${ecole.ville}, République du Congo`;
    }
    
    const ecoleEmail = ecole.email_contact || ecole.email;
    if (ecoleEmail) {
        if (emailText) emailText.textContent = ecoleEmail;
        if (emailLink) emailLink.href = `mailto:${ecoleEmail}`;
    }

    if (ecole.telephone) {
        if (phoneText) phoneText.textContent = ecole.telephone;
        if (phoneLink) phoneLink.href = `tel:${ecole.telephone.toString().replace(/\s+/g, '')}`;
    }
});