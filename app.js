const STORAGE_KEY = "escalatedCases_v1";

function loadCases() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCases(cases) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

function addBusinessDays(startDate, businessDaysToAdd) {
  const date = new Date(startDate);
  let added = 0;
  while (added < businessDaysToAdd) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return date;
}

function businessDaysBetween(startDateStr, endDate = new Date()) {
  const start = new Date(startDateStr);
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    current.setDate(current.getDate() + 1);
  }
  return Math.max(count - 1, 0);
}

function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeStatusInfo(dateEscalated) {
  const days = businessDaysBetween(dateEscalated);
  let bucketClass = "age-green";
  let badgeClass = "badge-green";
  let label = `${days} business day${days === 1 ? "" : "s"} (OK)`;

  if (days >= 5 && days <= 7) {
    bucketClass = "age-yellow";
    badgeClass = "badge-yellow";
    label = `${days} business day${days === 1 ? "" : "s"} (warning)`;
  } else if (days > 7) {
    bucketClass = "age-red";
    badgeClass = "badge-red";
    label = `${days} business day${days === 1 ? "" : "s"} (overdue)`;
  }

  return { days, bucketClass, badgeClass, label };
}

function renderCases(filter = "open") {
  const tbody = document.getElementById("case-table-body");
  if (!tbody) return;

  const cases = loadCases();
  const today = new Date();

  let filtered = cases;
  if (filter === "open") {
    filtered = cases.filter((c) => c.status === "open");
  } else if (filter === "returned") {
    filtered = cases.filter((c) => c.status === "returned");
  }

  filtered.sort((a, b) => {
    const aDue = new Date(a.dueDate);
    const bDue = new Date(b.dueDate);
    return aDue - bDue;
  });

  tbody.innerHTML = "";

  filtered.forEach((item) => {
    const dueDate = new Date(item.dueDate);
    const statusInfo = computeStatusInfo(item.dateEscalated);

    const tr = document.createElement("tr");
    tr.classList.add("case-row");
    if (item.status === "open") {
      tr.classList.add(statusInfo.bucketClass);
    }

    const orgCell = document.createElement("td");
    orgCell.textContent = item.orgNumber;
    tr.appendChild(orgCell);

    const deptCell = document.createElement("td");
    deptCell.textContent = item.department;
    tr.appendChild(deptCell);

    const escalatedCell = document.createElement("td");
    escalatedCell.textContent = item.dateEscalated;
    tr.appendChild(escalatedCell);

    const dueCell = document.createElement("td");
    dueCell.textContent = formatDate(dueDate);
    tr.appendChild(dueCell);

    const daysCell = document.createElement("td");
    if (item.status === "open") {
      const badge = document.createElement("span");
      badge.className = `badge ${statusInfo.badgeClass}`;
      badge.textContent = statusInfo.label;
      daysCell.appendChild(badge);
    } else {
      daysCell.textContent = `${statusInfo.days} business day${
        statusInfo.days === 1 ? "" : "s"
      }`;
    }
    tr.appendChild(daysCell);

    const statusCell = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className = "status-pill";
    statusPill.textContent = item.status === "open" ? "Open" : "Returned";
    statusCell.appendChild(statusPill);
    tr.appendChild(statusCell);

    const actionsCell = document.createElement("td");
    const markBtn = document.createElement("button");
    markBtn.type = "button";
    markBtn.className = "btn secondary";
    markBtn.style.marginRight = "4px";
    if (item.status === "open") {
      markBtn.textContent = "Mark as returned";
      markBtn.addEventListener("click", () => {
        updateCaseStatus(item.id, "returned");
      });
    } else {
      markBtn.textContent = "Reopen";
      markBtn.addEventListener("click", () => {
        updateCaseStatus(item.id, "open");
      });
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn ghost";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      deleteCase(item.id);
    });

    actionsCell.appendChild(markBtn);
    actionsCell.appendChild(deleteBtn);
    tr.appendChild(actionsCell);

    tbody.appendChild(tr);
  });
}

function updateCaseStatus(id, newStatus) {
  const cases = loadCases();
  const updated = cases.map((c) =>
    c.id === id ? { ...c, status: newStatus } : c
  );
  saveCases(updated);
  const activeFilter = document.querySelector(".filter-btn.active")?.dataset
    .filter;
  renderCases(activeFilter || "open");
}

function deleteCase(id) {
  const cases = loadCases();
  const filtered = cases.filter((c) => c.id !== id);
  saveCases(filtered);
  const activeFilter = document.querySelector(".filter-btn.active")?.dataset
    .filter;
  renderCases(activeFilter || "open");
}

function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const orgNumber = form.orgNumber.value.trim();
  const department = form.department.value;
  const dateEscalated = form.dateEscalated.value;
  const description = form.description.value.trim();

  if (!orgNumber || !department || !dateEscalated) {
    return;
  }

  const dueDate = addBusinessDays(dateEscalated, 7);

  const newCase = {
    id: Date.now().toString(),
    orgNumber,
    department,
    dateEscalated,
    description,
    dueDate: formatDate(dueDate),
    status: "open",
  };

  const cases = loadCases();
  cases.push(newCase);
  saveCases(cases);

  form.reset();
  const today = new Date();
  form.dateEscalated.value = formatDate(today);

  renderCases("open");
  setActiveFilterButton("open");
}

function setActiveFilterButton(filter) {
  document
    .querySelectorAll(".filter-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const target = document.querySelector(
    `.filter-btn[data-filter="${filter}"]`
  );
  if (target) target.classList.add("active");
}

function initFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter || "open";
      setActiveFilterButton(filter);
      renderCases(filter);
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  fetch("/.auth/me")
    .then((res) => res.json())
    .then(({ clientPrincipal }) => {
      if (clientPrincipal) {
        const nameEl = document.getElementById("user-name");
        if (nameEl) nameEl.textContent = clientPrincipal.userDetails;
      }
    });

  const form = document.getElementById("case-form");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
    const today = new Date();
    const dateInput = document.getElementById("dateEscalated");
    if (dateInput) {
      dateInput.value = formatDate(today);
    }
  }

  initFilters();
  renderCases("open");
});
