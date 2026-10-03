// Données de démonstration (Simulant une réponse API / BDD)
let schoolData = {
  classes: [
    {
      id: 1,
      name: "6ème A",
      teacher: "M. Jean Dupont",
      students: ["Mamba Kevin", "Badinga Sophie", "Loubaki Marc", "Nkouka Christian"]
    },
    {
      id: 2,
      name: "5ème B",
      teacher: "Mme Claire Martin",
      students: ["Mavoungou David", "Tchibinda Rita", "Okemba Jean"]
    },
    {
      id: 3,
      name: "3ème C",
      teacher: "M. Paul Dubois",
      students: ["Ngassaki Brice", "Kimbembé Sarah", "Mabiala Daniel", "Massamba Éric"]
    }
  ],
  teachers: [
    { id: 101, name: "Jean Dupont", email: "j.dupont@ecole.cg", classes: "6ème A" },
    { id: 102, name: "Claire Martin", email: "c.martin@ecole.cg", classes: "5ème B" },
    { id: 103, name: "Paul Dubois", email: "p.dubois@ecole.cg", classes: "3ème C" }
  ]
};

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  renderDashboard();
  setupEventListeners();
});

// Affichage global des éléments
function renderDashboard() {
  updateStats();
  renderClasses();
  renderTeachers();
}

// 1. Mise à jour des Chiffres Clés
function updateStats() {
  const totalStudents = schoolData.classes.reduce((acc, c) => acc + c.students.length, 0);
  document.getElementById("stat-total-students").textContent = totalStudents;
  document.getElementById("stat-total-teachers").textContent = schoolData.teachers.length;
  document.getElementById("stat-total-classes").textContent = schoolData.classes.length;
}

// 2. Rendu des Classes
function renderClasses() {
  const container = document.getElementById("classes-list");
  container.innerHTML = "";

  schoolData.classes.forEach(cls => {
    const div = document.createElement("div");
    div.className = "py-3 flex justify-between items-center";
    div.innerHTML = `
      <div>
        <span class="font-bold text-slate-800">${cls.name}</span>
        <span class="text-sm text-slate-500 ml-3">(${cls.students.length} élèves)</span>
        <span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded ml-3">Prof : ${cls.teacher}</span>
      </div>
      <button class="btn-view-students text-sm text-indigo-600 hover:underline font-medium" data-id="${cls.id}">
        Voir la liste des élèves →
      </button>
    `;
    container.appendChild(div);
  });
}

// 3. Rendu de la liste des Professeurs
function renderTeachers() {
  const tbody = document.getElementById("teachers-table-body");
  tbody.innerHTML = "";

  schoolData.teachers.forEach(teacher => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="py-3 px-3 font-semibold text-slate-800">${teacher.name}</td>
      <td class="py-3 px-3">${teacher.email}</td>
      <td class="py-3 px-3">${teacher.classes}</td>
      <td class="py-3 px-3 text-right">
        <button class="btn-delete-teacher text-xs text-rose-500 hover:underline" data-id="${teacher.id}">
          Retirer
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Gestion des Modales et Événements
function setupEventListeners() {
  const modalStudents = document.getElementById("modal-students");
  const modalAddTeacher = document.getElementById("modal-add-teacher");

  // Ouvrir la modale Élèves
  document.getElementById("classes-list").addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-view-students")) {
      const classId = parseInt(e.target.getAttribute("data-id"));
      openStudentsModal(classId);
    }
  });

  // Fermer la modale Élèves
  document.getElementById("btn-close-students-modal").addEventListener("click", () => {
    modalStudents.classList.add("hidden");
  });

  // Supprimer un Professeur
  document.getElementById("teachers-table-body").addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-delete-teacher")) {
      const teacherId = parseInt(e.target.getAttribute("data-id"));
      schoolData.teachers = schoolData.teachers.filter(t => t.id !== teacherId);
      renderDashboard();
    }
  });

  // Ouvrir / Fermer modale Ajout Prof
  document.getElementById("btn-open-add-teacher").addEventListener("click", () => {
    modalAddTeacher.classList.remove("hidden");
  });

  document.getElementById("btn-close-teacher-modal").addEventListener("click", () => {
    modalAddTeacher.classList.add("hidden");
  });

  document.getElementById("btn-cancel-teacher").addEventListener("click", () => {
    modalAddTeacher.classList.add("hidden");
  });

  // Formulaire d'ajout d'un Professeur
  document.getElementById("form-add-teacher").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("teacher-name").value;
    const email = document.getElementById("teacher-email").value;
    const classes = document.getElementById("teacher-classes").value;

    const newTeacher = {
      id: Date.now(),
      name: name,
      email: email,
      classes: classes
    };

    schoolData.teachers.push(newTeacher);
    renderDashboard();

    // Reset et fermeture
    e.target.reset();
    modalAddTeacher.classList.add("hidden");
  });
}

// Affichage spécifique des élèves d'une classe
function openStudentsModal(classId) {
  const selectedClass = schoolData.classes.find(c => c.id === classId);
  if (!selectedClass) return;

  document.getElementById("modal-class-title").textContent = `Élèves de ${selectedClass.name}`;
  const listContainer = document.getElementById("modal-students-list");
  listContainer.innerHTML = "";

  if (selectedClass.students.length === 0) {
    listContainer.innerHTML = `<li class="py-2 text-slate-400 italic">Aucun élève inscrit.</li>`;
  } else {
    selectedClass.students.forEach(studentName => {
      const li = document.createElement("li");
      li.className = "py-2 text-slate-700 font-medium";
      li.textContent = studentName;
      listContainer.appendChild(li);
    });
  }

  document.getElementById("modal-students").classList.remove("hidden");
}