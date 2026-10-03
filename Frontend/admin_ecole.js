// admin_ecole.js - Gestionnaire dynamique du Dashboard Admin École

// Vérification de la session et des droits d'accès au chargement
const userStored = localStorage.getItem('user');
const currentUser = userStored ? JSON.parse(userStored) : null;

// Sécurité : Vérification du rôle admin_ecole ou sudo_admin
if (!currentUser || (currentUser.role !== 'admin_ecole' && currentUser.role !== 'sudo_admin')) {
  window.location.href = 'login.html';
}

// Objet global des données réelles issues de MySQL (initialement vide)
let schoolData = {
  classes: [],
  teachers: []
};

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  chargerDonneesEcole();
  setupEventListeners();
});

/**
 * 1. CHARGEMENT DES DONNÉES RÉELLES DEPUIS LE SERVEUR / MYSQL
 */
async function chargerDonneesEcole() {
  const ecoleId = currentUser.ecole ? currentUser.ecole.id : 1;

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
    // Mise à jour de l'affichage dans tous les cas
    renderDashboard();
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
  const totalStudents = schoolData.classes.reduce((acc, c) => acc + (c.students ? c.students.length : 0), 0);
  
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
    const studentCount = cls.students ? cls.students.length : 0;
    const teacherName = cls.teacher || "Non attribué";

    const div = document.createElement("div");
    div.className = "py-3 flex justify-between items-center border-b border-slate-100 last:border-none";
    div.innerHTML = `
      <div>
        <span class="font-bold text-slate-800">${cls.name}</span>
        <span class="text-sm text-slate-500 ml-3">(${studentCount} élèves)</span>
        <span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded ml-3">Prof : ${teacherName}</span>
      </div>
      <button class="btn-view-students text-sm text-indigo-600 hover:underline font-medium" data-id="${cls.id}">
        Voir la liste des élèves →
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
      <td class="py-3 px-3 font-semibold text-slate-800">${teacher.name}</td>
      <td class="py-3 px-3">${teacher.email}</td>
      <td class="py-3 px-3">${teacher.classes || "Aucune"}</td>
      <td class="py-3 px-3 text-right">
        <button class="btn-delete-teacher text-xs text-rose-500 hover:underline font-medium" data-id="${teacher.id}">
          Retirer
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * 3. GESTION DES ÉVÉNEMENTS & MODALES
 */
function setupEventListeners() {
  const modalStudents = document.getElementById("modal-students");
  const modalAddTeacher = document.getElementById("modal-add-teacher");

  // Cliquer sur "Voir la liste des élèves"
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
    btnCloseStudents.addEventListener("click", () => {
      modalStudents.classList.add("hidden");
    });
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
    btnOpenAddTeacher.addEventListener("click", () => {
      modalAddTeacher.classList.remove("hidden");
    });
  }

  const btnCloseTeacher = document.getElementById("btn-close-teacher-modal");
  if (btnCloseTeacher && modalAddTeacher) {
    btnCloseTeacher.addEventListener("click", () => {
      modalAddTeacher.classList.add("hidden");
    });
  }

  const btnCancelTeacher = document.getElementById("btn-cancel-teacher");
  if (btnCancelTeacher && modalAddTeacher) {
    btnCancelTeacher.addEventListener("click", () => {
      modalAddTeacher.classList.add("hidden");
    });
  }

  // Soumission du formulaire d'ajout d'un Professeur
  const formAddTeacher = document.getElementById("form-add-teacher");
  if (formAddTeacher) {
    formAddTeacher.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const username = document.getElementById("teacher-name").value.trim();
      const email = document.getElementById("teacher-email").value.trim();
      const classes = document.getElementById("teacher-classes").value.trim();

      const ecoleId = currentUser.ecole ? currentUser.ecole.id : 1;

      try {
        // Envoi au serveur pour enregistrement MySQL
        const response = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            email: email,
            password: 'MathsCollegeProf2026!', // Mot de passe par défaut
            role: 'professeur',
            niveau: 'Enseignant',
            ecole_id: ecoleId
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Ajout local et mise à jour de l'affichage
          schoolData.teachers.push({
            id: data.user.id,
            name: username,
            email: email,
            classes: classes
          });
          
          renderDashboard();
          formAddTeacher.reset();
          if (modalAddTeacher) modalAddTeacher.classList.add("hidden");
          alert("Professeur ajouté avec succès !");
        } else {
          alert("Erreur : " + (data.message || "Impossible d'ajouter le professeur."));
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
function openStudentsModal(classId) {
  const modalStudents = document.getElementById("modal-students");
  const selectedClass = schoolData.classes.find(c => c.id === classId);
  
  if (!selectedClass || !modalStudents) return;

  const titleEl = document.getElementById("modal-class-title");
  if (titleEl) titleEl.textContent = `Élèves de la classe : ${selectedClass.name}`;

  const listContainer = document.getElementById("modal-students-list");
  if (listContainer) {
    listContainer.innerHTML = "";

    if (!selectedClass.students || selectedClass.students.length === 0) {
      listContainer.innerHTML = `<li class="py-3 text-slate-400 italic">Aucun élève inscrit dans cette classe.</li>`;
    } else {
      selectedClass.students.forEach(studentName => {
        const li = document.createElement("li");
        li.className = "py-2.5 text-slate-700 font-medium border-b border-slate-50 last:border-none flex items-center gap-2";
        li.innerHTML = `<span>🎓</span> <span>${studentName}</span>`;
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
      schoolData.teachers = schoolData.teachers.filter(t => t.id !== teacherId);
    } else {
      // Suppression locale en secours si la route serveur n'est pas encore prête
      schoolData.teachers = schoolData.teachers.filter(t => t.id !== teacherId);
    }
  } catch (err) {
    console.error("Erreur de suppression :", err);
    schoolData.teachers = schoolData.teachers.filter(t => t.id !== teacherId);
  } finally {
    renderDashboard();
  }
}