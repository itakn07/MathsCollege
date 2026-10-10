// admin_ecole.js - Gestionnaire dynamique du Dashboard Admin École

// Vérification de la session et des droits d'accès au chargement
const userStored = localStorage.getItem('user');
const currentUser = userStored ? JSON.parse(userStored) : null;

// Sécurité : Vérification du rôle admin_ecole ou sudo_admin
if (!currentUser || (currentUser.role !== 'admin_ecole' && currentUser.role !== 'sudo_admin')) {
  window.location.href = 'login.html';
}

// Objet global des données réelles issues de MySQL
let schoolData = {
  classes: [],
  teachers: []
};

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  initialiserHeaderEcole();
  chargerDonneesEcole();
  setupEventListeners();
});

/**
 * 0. INITIALISATION DE L'EN-TÊTE AVEC LE NOM DE L'ÉCOLE
 */
function initialiserHeaderEcole() {
  const schoolNameEl = document.getElementById('header-school-name');
  if (schoolNameEl) {
    // Récupère le nom depuis l'objet ecole stocké ou une valeur par défaut
    const nomEcole = currentUser.ecole?.nom || currentUser.ecole_nom || "Mon Établissement";
    schoolNameEl.textContent = nomEcole;
  }
}

/**
 * 1. CHARGEMENT DES DONNÉES RÉELLES DEPUIS LE SERVEUR / MYSQL
 */
async function chargerDonneesEcole() {
  const ecoleId = currentUser.ecole?.id || currentUser.ecole_id || 1;

  try {
    const response = await fetch(`/api/admin-ecole/dashboard/${ecoleId}`);
    if (response.ok) {
      const data = await response.json();
      schoolData.classes = data.classes || [];
      schoolData.teachers = data.teachers || [];
    } else {
      console.warn("Impossible de récupérer les données du serveur pour cette école.");
    }
  } catch (err) {
    console.error("Erreur de connexion lors de la récupération des données :", err);
  } finally {
    renderDashboard();
    remplirOptionsClassesModal();
  }
}

/**
 * 2. RENDU ET MISE À JOUR DE L'INTERFACE (DOM)
 */
function renderDashboard() {
  updateStats();
  renderClasses();
  renderTeachers();
}

// Mise à jour des cartes des Chiffres Clés
function updateStats() {
  const totalStudents = schoolData.classes.reduce((acc, c) => acc + (c.students ? c.students.length : (c.effectif || 0)), 0);
  
  const elStudents = document.getElementById("stat-total-students");
  const elTeachers = document.getElementById("stat-total-teachers");
  const elClasses = document.getElementById("stat-total-classes");

  if (elStudents) elStudents.textContent = totalStudents;
  if (elTeachers) elTeachers.textContent = schoolData.teachers.length;
  if (elClasses) elClasses.textContent = schoolData.classes.length;
}

// Rendu de la liste des Classes & Effectifs
function renderClasses() {
  const container = document.getElementById("classes-list");
  if (!container) return;

  container.innerHTML = "";

  if (schoolData.classes.length === 0) {
    container.innerHTML = `<p class="py-4 text-sm text-slate-400 italic">Aucune classe répertoriée dans la base de données.</p>`;
    return;
  }

  schoolData.classes.forEach(cls => {
    const studentCount = cls.students ? cls.students.length : (cls.effectif || 0);
    const className = cls.name || cls.nom_classe || "Classe sans nom";

    const div = document.createElement("div");
    div.className = "py-3.5 flex justify-between items-center border-b border-slate-100 last:border-none";
    div.innerHTML = `
      <div>
        <span class="font-bold text-slate-800">${className}</span>
        <span class="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg ml-3">${studentCount} élève(s)</span>
      </div>
      <button class="btn-view-students text-xs font-bold text-indigo-600 hover:text-indigo-800 transition" data-id="${cls.id}">
        Voir les élèves →
      </button>
    `;
    container.appendChild(div);
  });
}

// Rendu du tableau des Professeurs
function renderTeachers() {
  const tbody = document.getElementById("teachers-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (schoolData.teachers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-sm text-slate-400 italic">Aucun professeur de mathématiques inscrit.</td></tr>`;
    return;
  }

  schoolData.teachers.forEach(teacher => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50/50 transition-colors";
    tr.innerHTML = `
      <td class="py-3.5 px-4 font-semibold text-slate-800">${teacher.name || teacher.username}</td>
      <td class="py-3.5 px-4 text-slate-600">${teacher.email}</td>
      <td class="py-3.5 px-4"><span class="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium">${teacher.classes || "Aucune"}</span></td>
      <td class="py-3.5 px-4 text-right">
        <button class="btn-delete-teacher text-xs font-bold text-rose-500 hover:text-rose-700 transition" data-id="${teacher.id}">
          Retirer
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Remplir dynamiquement les sous-groupes/classes dans la modale d'ajout de prof
 */
function remplirOptionsClassesModal() {
  const selectClasses = document.getElementById("teacher-classes");
  if (!selectClasses) return;

  selectClasses.innerHTML = "";
  schoolData.classes.forEach(c => {
    const className = c.name || c.nom_classe;
    selectClasses.innerHTML += `<option value="${c.id}">${className}</option>`;
  });
}

/**
 * 3. GESTION DES ÉVÉNEMENTS & MODALES
 */
function setupEventListeners() {
  const modalStudents = document.getElementById("modal-students");
  const modalAddTeacher = document.getElementById("modal-add-teacher");
  const modalAddClass = document.getElementById("modal-add-class");

  // Déconnexion
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    });
  }

  // --- GESTION MODALE CLASSE ---
  const btnOpenAddClass = document.getElementById("btn-open-add-class");
  if (btnOpenAddClass && modalAddClass) {
    btnOpenAddClass.addEventListener("click", () => modalAddClass.classList.remove("hidden"));
  }
  const btnCloseClass = document.getElementById("btn-close-class-modal");
  if (btnCloseClass && modalAddClass) {
    btnCloseClass.addEventListener("click", () => modalAddClass.classList.add("hidden"));
  }
  const btnCancelClass = document.getElementById("btn-cancel-class");
  if (btnCancelClass && modalAddClass) {
    btnCancelClass.addEventListener("click", () => modalAddClass.classList.add("hidden"));
  }

  // Soumission du formulaire d'ajout d'une classe
  const formAddClass = document.getElementById("form-add-class");
  if (formAddClass) {
    formAddClass.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nomClasse = document.getElementById("class-name-input").value.trim();
      const niveau = document.getElementById("class-level-input").value;
      const ecoleId = currentUser.ecole?.id || currentUser.ecole_id || 1;

      try {
        const response = await fetch('/api/admin-ecole/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ecole_id: ecoleId, nom_classe: nomClasse, niveau: niveau })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          formAddClass.reset();
          modalAddClass.classList.add("hidden");
          await chargerDonneesEcole();
        } else {
          alert("Erreur : " + (data.message || "Impossible d'ajouter la classe."));
        }
      } catch (err) {
        console.error("Erreur réseau :", err);
      }
    });
  }

  // Cliquer sur "Voir les élèves" d'une classe
  const classesList = document.getElementById("classes-list");
  if (classesList) {
    classesList.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-view-students")) {
        const classId = parseInt(e.target.getAttribute("data-id"));
        openStudentsModal(classId);
      }
    });
  }

  // Fermer la modale Élèves
  const btnCloseStudents = document.getElementById("btn-close-students-modal");
  if (btnCloseStudents && modalStudents) {
    btnCloseStudents.addEventListener("click", () => modalStudents.classList.add("hidden"));
  }

  // Supprimer un Professeur
  const tbodyTeachers = document.getElementById("teachers-table-body");
  if (tbodyTeachers) {
    tbodyTeachers.addEventListener("click", async (e) => {
      if (e.target.classList.contains("btn-delete-teacher")) {
        const teacherId = parseInt(e.target.getAttribute("data-id"));
        if (confirm("Voulez-vous vraiment retirer ce professeur ?")) {
          await supprimerProfesseurBDD(teacherId);
        }
      }
    });
  }

  // Ouverture et fermeture de la modale d'ajout de Professeur
  const btnOpenAddTeacher = document.getElementById("btn-open-add-teacher");
  if (btnOpenAddTeacher && modalAddTeacher) {
    btnOpenAddTeacher.addEventListener("click", () => modalAddTeacher.classList.remove("hidden"));
  }
  const btnCloseTeacher = document.getElementById("btn-close-teacher-modal");
  if (btnCloseTeacher && modalAddTeacher) {
    btnCloseTeacher.addEventListener("click", () => modalAddTeacher.classList.add("hidden"));
  }
  const btnCancelTeacher = document.getElementById("btn-cancel-teacher");
  if (btnCancelTeacher && modalAddTeacher) {
    btnCancelTeacher.addEventListener("click", () => modalAddTeacher.classList.add("hidden"));
  }

  // Soumission du formulaire d'ajout d'un Professeur
  const formAddTeacher = document.getElementById("form-add-teacher");
  if (formAddTeacher) {
    formAddTeacher.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const username = document.getElementById("teacher-name").value.trim();
      const email = document.getElementById("teacher-email").value.trim();
      const password = document.getElementById("teacher-password").value;
      
      const selectClasses = document.getElementById("teacher-classes");
      let classIds = [];
      if (selectClasses) {
        classIds = Array.from(selectClasses.selectedOptions).map(opt => parseInt(opt.value));
      }

      const ecoleId = currentUser.ecole?.id || currentUser.ecole_id || 1;

      try {
        const response = await fetch('/api/admin-ecole/add-teacher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            email: email,
            password: password,
            ecole_id: ecoleId,
            class_ids: classIds
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          alert(`✅ Professeur créé avec succès !\n\nEmail : ${email}`);
          formAddTeacher.reset();
          modalAddTeacher.classList.add("hidden");
          await chargerDonneesEcole();
        } else {
          alert("Erreur : " + (data.error || data.message || "Impossible d'ajouter le professeur."));
        }
      } catch (err) {
        console.error("Erreur serveur lors de l'ajout :", err);
        alert("Une erreur est survenue lors de la communication avec le serveur.");
      }
    });
  }
}

/**
 * 4. AFFICHAGE DES ÉLÈVES D'UNE CLASSE SÉLECTIONNÉE
 */
// Affichage enrichi des élèves d'une classe avec leur niveau de progression
function openStudentsModal(classId) {
  const modalStudents = document.getElementById("modal-students");
  const selectedClass = schoolData.classes.find(c => c.id === classId);
  
  if (!selectedClass || !modalStudents) return;

  const titleEl = document.getElementById("modal-class-title");
  if (titleEl) {
    titleEl.textContent = `Élèves de la classe : ${selectedClass.name || selectedClass.nom_classe || 'Classe'}`;
  }

  const listContainer = document.getElementById("modal-students-list");
  if (listContainer) {
    listContainer.innerHTML = "";

    const students = selectedClass.students || [];
    if (students.length === 0) {
      listContainer.innerHTML = `<li class="py-3 text-slate-400 italic">Aucun élève inscrit dans cette classe pour le moment.</li>`;
    } else {
      students.forEach(student => {
        // Extraction sécurisée du nom
        let studentName = "Élève";
        let progression = "0%";

        if (typeof student === 'string') {
          studentName = student;
          progression = "Actif";
        } else if (typeof student === 'object' && student !== null) {
          studentName = student.username || student.name || student.nom || "Élève";
          progression = student.progression || "0%";
        }

        const li = document.createElement("li");
        li.className = "py-3 text-slate-700 text-sm border-b border-slate-50 last:border-none flex justify-between items-center";
        li.innerHTML = `
          <div class="flex items-center gap-2">
            <span>🎓</span> 
            <span class="font-bold text-slate-800">${studentName}</span>
          </div>
          <span class="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
            Progression : ${progression}
          </span>
        `;
        listContainer.appendChild(li);
      });
    }
  }

  modalStudents.classList.remove("hidden");
}
/**
 * 5. SUPPRESSION D'UN PROFESSEUR DANS LA BDD
 */
async function supprimerProfesseurBDD(teacherId) {
  try {
    const response = await fetch(`/api/admin-ecole/teacher/${teacherId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await chargerDonneesEcole();
    } else {
      schoolData.teachers = schoolData.teachers.filter(t => t.id !== teacherId);
      renderDashboard();
    }
  } catch (err) {
    console.error("Erreur de suppression :", err);
  }
}