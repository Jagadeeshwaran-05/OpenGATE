// Detect active paper from path
const paper = window.location.pathname.includes("/explorer/cs") ? "cs" : "da";

const storageKey = `dsai-gate-progress-v1-${paper}`;
const notesKey = `dsai-gate-notes-v1-${paper}`;
const themeKey = "dsai-gate-theme";
const customMapNodesKey = `dsai-gate-custom-map-nodes-v1-${paper}`;

const subjects = JSON.parse(document.querySelector("#syllabus-data").textContent);
const slides = subjects.flatMap((subject) =>
  subject.topics.map((topic, index) => ({
    id: `${subject.id}:${index}`,
    topic,
    subject,
  })),
);

// DOM elements
const topicInputs = [...document.querySelectorAll("[data-topic]")];
const subjectCards = [...document.querySelectorAll("[data-subject-card]")];
const subjectButtons = [...document.querySelectorAll("[data-subject]")];
const chips = [...document.querySelectorAll("[data-filter]")];
const searchInput = document.querySelector("#search-input");
const emptyState = document.querySelector("#empty-state");
const sidebar = document.querySelector("#sidebar");
const menuToggle = document.querySelector("#menu-toggle");
const menuClose = document.querySelector("#menu-close");
const themeToggle = document.querySelector("#theme-toggle");
const fullscreenToggle = document.querySelector("#fullscreen-toggle");
const openMemoryMapBtn = document.querySelector("#open-memory-map");
const presentAllBtn = document.querySelector("#present-all");
const startPresentBtn = document.querySelector("[data-present-start]");

// Presentation elements
const presentation = document.querySelector("#presentation");
const presentationClose = document.querySelector("#presentation-close");
const focusTab = document.querySelector("#focus-tab");
const overallMapTab = document.querySelector("#overall-map-tab");
const studySlide = document.querySelector("#study-slide");
const overallMapPanel = document.querySelector("#overall-map-panel");
const slideCounter = document.querySelector("#slide-counter");
const slideSubject = document.querySelector("#slide-subject");
const slideTitle = document.querySelector("#slide-title");
const slideDescription = document.querySelector("#slide-description");
const slideLinks = document.querySelector("#slide-links");
const resourceMap = document.querySelector("#resource-map");
const slidePrevious = document.querySelector("#slide-previous");
const slideNext = document.querySelector("#slide-next");

// Notes elements
const slideNotesToggle = document.querySelector("#slide-notes-toggle");
const notesPanel = document.querySelector("#notes-panel");
const notesClose = document.querySelector("#notes-close");
const notesTitle = document.querySelector("#notes-title");
const notesInput = document.querySelector("#notes-input");
const notesStatus = document.querySelector("#notes-status");
const notesExportBtn = document.querySelector("#notes-export");

// Tutor elements
const slideTutorToggle = document.querySelector("#slide-tutor-toggle");
const mainTutorToggle = document.querySelector("#main-tutor-toggle");
const tutorPanel = document.querySelector("#tutor-panel");
const tutorClose = document.querySelector("#tutor-close");
const tutorFullscreen = document.querySelector("#tutor-fullscreen");
const tutorTopicTitle = document.querySelector("#tutor-topic-title");
const tutorChatHistory = document.querySelector("#tutor-chat-history");
const tutorChatForm = document.querySelector("#tutor-chat-form");
const tutorChatInput = document.querySelector("#tutor-chat-input");
const tutorStatus = document.querySelector("#tutor-status");

const tutorHistories = {};



// Map elements
const overallMapContainer = document.querySelector("#overall-map");
const mapAddNodeBtn = document.querySelector("#map-add-node");
const mapNodeForm = document.querySelector("#map-node-form");
const mapNodeCancel = document.querySelector("#map-node-cancel");
const mapNodeParent = document.querySelector("#map-node-parent");
const mapNodeTitle = document.querySelector("#map-node-title");
const mapNodeUrl = document.querySelector("#map-node-url");
const mapSaveStatus = document.querySelector("#map-save-status");
const mapResetBtn = document.querySelector("#map-reset");
const mapZoomInBtn = document.querySelector("#map-zoom-in");
const mapZoomOutBtn = document.querySelector("#map-zoom-out");

let currentFilter = "all";
let currentSlide = 0;
let currentPresentationView = "focus";
let progress = {};
let notes = {};
let customMapNodes = [];
let noteSaveTimer;
let selectedCustomNodeId = null;

// Map state variables for Zooming/Panning
let mapZoom = paper === "cs" ? 0.72 : 0.85;
let mapPanX = paper === "cs" ? 20 : 50;
let mapPanY = 40;
let isPanning = false;
let startX, startY;
let draggedNode = null;
let nodeDragOffset = { x: 0, y: 0 };
let mapNodes = []; // holds node positions

// HSL Map branch colors read dynamically from parsed subjects
const mapColors = {};
subjects.forEach(sub => {
  mapColors[sub.id] = sub.accent;
});

// ----------------------------------------------------
// STATE STORAGE & BACKEND SYNC
// ----------------------------------------------------

async function loadAppState() {
  // Try loading from LocalStorage first
  try {
    progress = JSON.parse(localStorage.getItem(storageKey)) || {};
    notes = JSON.parse(localStorage.getItem(notesKey)) || {};
    customMapNodes = JSON.parse(localStorage.getItem(customMapNodesKey)) || [];
  } catch (e) {
    progress = {};
    notes = {};
    customMapNodes = [];
  }

  // Update UI with local state immediately
  syncInputs();
  updateProgress();

  // Load state from backend database for true persistence
  try {
    const res = await fetch(`/api/state?paper=${paper}`);
    if (res.ok) {
      const dbState = await res.json();
      
      // Merge backend state with local state
      progress = { ...progress, ...dbState.progress };
      notes = { ...notes, ...dbState.notes };
      customMapNodes = dbState.custom_nodes || [];

      // Save merged to local storage
      localStorage.setItem(storageKey, JSON.stringify(progress));
      localStorage.setItem(notesKey, JSON.stringify(notes));
      localStorage.setItem(customMapNodesKey, JSON.stringify(customMapNodes));

      // Refresh UI
      syncInputs();
      updateProgress();
    }
  } catch (e) {
    console.error("Backend state sync failed. Falling back on local storage.", e);
  }
}

async function saveTopicProgress(topicId, completed) {
  progress[topicId] = completed;
  localStorage.setItem(storageKey, JSON.stringify(progress));
  updateProgress();

  try {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: `${paper}:${topicId}`, completed }),
    });
  } catch (e) {
    console.warn("Could not sync progress to backend", e);
  }
}

async function saveTopicNotes(topicId, content) {
  notes[topicId] = content;
  localStorage.setItem(notesKey, JSON.stringify(notes));

  try {
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: `${paper}:${topicId}`, content }),
    });
  } catch (e) {
    console.warn("Could not sync notes to backend", e);
  }
}

async function addCustomNode(id, parent, title, url) {
  const node = { id, parent, title, url };
  customMapNodes.push(node);
  localStorage.setItem(customMapNodesKey, JSON.stringify(customMapNodes));

  try {
    await fetch("/api/custom-nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: `${paper}:${id}`,
        parent: parent === "root" ? "root" : `${paper}:${parent}`,
        title,
        url
      }),
    });
  } catch (e) {
    console.warn("Could not sync custom node to backend", e);
  }
  renderRadialMap();
  populateParentDropdown();
}

async function deleteCustomNode(nodeId) {
  customMapNodes = customMapNodes.filter(n => n.id !== nodeId);
  localStorage.setItem(customMapNodesKey, JSON.stringify(customMapNodes));

  try {
    await fetch(`/api/custom-nodes/${paper}:${nodeId}`, {
      method: "DELETE"
    });
  } catch (e) {
    console.warn("Could not sync delete custom node to backend", e);
  }
  selectedCustomNodeId = null;
  renderRadialMap();
  populateParentDropdown();
}

// ----------------------------------------------------
// UI TRIGGERS AND HANDLERS
// ----------------------------------------------------

function syncInputs() {
  topicInputs.forEach((input) => {
    input.checked = Boolean(progress[input.dataset.topic]);
  });
}

function updateProgress() {
  let totalReviewed = 0;
  const subjectProgressCounts = {};

  // Initialize counts
  subjects.forEach(s => {
    subjectProgressCounts[s.id] = 0;
  });

  // Count progress
  topicInputs.forEach((input) => {
    if (input.checked) {
      totalReviewed++;
      const [subjectId] = input.dataset.topic.split(":");
      subjectProgressCounts[subjectId] = (subjectProgressCounts[subjectId] || 0) + 1;
    }
  });

  // Update subject cards progress UI
  subjects.forEach((subject) => {
    const count = subjectProgressCounts[subject.id] || 0;
    const total = subject.topics.length;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

    // Sidebar navigation text
    const sidebarProgressEl = document.querySelector(`[data-progress="${subject.id}"]`);
    if (sidebarProgressEl) {
      sidebarProgressEl.textContent = `${count}/${total}`;
    }

    // Main grid card metrics
    const cardProgressEl = document.querySelector(`[data-card-progress="${subject.id}"]`);
    if (cardProgressEl) {
      cardProgressEl.textContent = `${percentage}%`;
    }

    const cardBarEl = document.querySelector(`[data-card-bar="${subject.id}"]`);
    if (cardBarEl) {
      cardBarEl.style.width = `${percentage}%`;
    }
  });

  // Update overall progress bar
  const totalTopics = topicInputs.length;
  const overallPercent = totalTopics > 0 ? Math.round((totalReviewed / totalTopics) * 100) : 0;

  document.querySelector("#overall-percent").textContent = `${overallPercent}%`;
  document.querySelector("#overall-bar").style.width = `${overallPercent}%`;
  document.querySelector("#completed-count").textContent = totalReviewed;

  applyFilter();
}

// Filtering
function applyFilter() {
  const query = searchInput.value.toLowerCase().trim();
  let anyVisible = false;

  subjectCards.forEach((card) => {
    let cardHasVisibleTopics = false;

    const rows = [...card.querySelectorAll("[data-topic-row]")];
    rows.forEach((row) => {
      const checkbox = row.querySelector("input[type='checkbox']");
      const isChecked = checkbox.checked;
      const topicText = row.dataset.topicText;

      // Filter state
      let matchesFilter = true;
      if (currentFilter === "open") {
        matchesFilter = !isChecked;
      } else if (currentFilter === "complete") {
        matchesFilter = isChecked;
      }

      // Filter text query
      const matchesQuery = topicText.includes(query);

      if (matchesFilter && matchesQuery) {
        row.hidden = false;
        cardHasVisibleTopics = true;
        anyVisible = true;
      } else {
        row.hidden = true;
      }
    });

    card.hidden = !cardHasVisibleTopics;
  });

  emptyState.hidden = anyVisible;
}

// ----------------------------------------------------
// DRAG, PAN & ZOOM INTERACTIVE SVG MIND MAP
// ----------------------------------------------------

function populateParentDropdown() {
  mapNodeParent.innerHTML = "";
  
  // Root node
  const rootOpt = document.createElement("option");
  rootOpt.value = "root";
  rootOpt.textContent = `GATE ${paper.toUpperCase()} (Root)`;
  mapNodeParent.appendChild(rootOpt);

  // Subject branches
  subjects.forEach(sub => {
    const opt = document.createElement("option");
    opt.value = sub.id;
    opt.textContent = sub.title;
    mapNodeParent.appendChild(opt);
  });

  // User custom nodes
  customMapNodes.forEach(node => {
    const opt = document.createElement("option");
    opt.value = node.id;
    opt.textContent = `[User] ${node.title}`;
    mapNodeParent.appendChild(opt);
  });
}

function computeNodePositions() {
  const rootX = 750;
  const rootY = 320;
  mapNodes = [];

  // 1. Add root node
  mapNodes.push({
    id: "root",
    label: `GATE ${paper.toUpperCase()}`,
    type: "root",
    x: rootX,
    y: rootY,
    color: paper === "cs" ? "#3b82f6" : "#8b5cf6",
    url: ""
  });

  // 2. Add subject nodes radially
  const subjectRadius = paper === "cs" ? 280 : 260;
  subjects.forEach((sub, index) => {
    const angle = (index * 2 * Math.PI) / subjects.length - Math.PI/2;
    const x = rootX + subjectRadius * Math.cos(angle);
    const y = rootY + subjectRadius * Math.sin(angle);
    const color = mapColors[sub.id] || "#635bff";

    mapNodes.push({
      id: sub.id,
      label: sub.short,
      type: "subject",
      parent: "root",
      x,
      y,
      color,
      url: sub.guide
    });

    // Add topics radially around the subject node
    const topicRadius = paper === "cs" ? 85 : 110;
    sub.topics.forEach((topic, tIndex) => {
      const spread = paper === "cs" ? 0.22 : 0.16;
      const tAngle = angle + ((tIndex - (sub.topics.length - 1) / 2) * spread);
      const tx = x + topicRadius * Math.cos(tAngle);
      const ty = y + topicRadius * Math.sin(tAngle);

      mapNodes.push({
        id: `${sub.id}:${tIndex}`,
        label: topic.length > 20 ? topic.substring(0, 18) + "..." : topic,
        fullLabel: topic,
        type: "topic",
        parent: sub.id,
        x: tx,
        y: ty,
        color: "#fff",
        textColor: color,
        borderColor: color,
        url: ""
      });
    });
  });

  // 3. Add custom nodes
  customMapNodes.forEach((node, index) => {
    const parentNode = mapNodes.find(n => n.id === node.parent);
    const px = parentNode ? parentNode.x : rootX;
    const py = parentNode ? parentNode.y : rootY;
    
    const angle = (index * 0.8) % (2 * Math.PI);
    const x = px + 110 * Math.cos(angle);
    const y = py + 110 * Math.sin(angle);

    mapNodes.push({
      id: node.id,
      label: node.title,
      type: "custom",
      parent: node.parent,
      x,
      y,
      color: "#f8fafc",
      textColor: paper === "cs" ? "#2563eb" : "#818cf8",
      borderColor: paper === "cs" ? "#3b82f6" : "#818cf8",
      url: node.url
    });
  });
}

function renderRadialMap() {
  computeNodePositions();

  // Draw SVG
  let html = `<svg viewBox="0 0 1500 700" class="radial-memory-map ${isPanning ? 'interacting' : ''}" id="radial-map-svg">`;
  html += `<g transform="translate(${mapPanX}, ${mapPanY}) scale(${mapZoom})">`;

  // Draw Edges
  html += `<g class="radial-edges">`;
  mapNodes.forEach(node => {
    if (node.parent) {
      const parentNode = mapNodes.find(n => n.id === node.parent);
      if (parentNode) {
        const isRootEdge = parentNode.id === "root";
        const strokeColor = isRootEdge ? "var(--line)" : "color-mix(in srgb, var(--line) 40%, transparent)";
        const strokeClass = isRootEdge ? "root-edge" : "topic-edge";
        html += `<line x1="${parentNode.x}" y1="${parentNode.y}" x2="${node.x}" y2="${node.y}" stroke="${strokeColor}" class="${strokeClass}" />`;
      }
    }
  });
  html += `</g>`;

  // Draw Nodes
  html += `<g class="radial-nodes">`;
  mapNodes.forEach(node => {
    const rectWidth = node.type === "root" ? 115 : node.type === "subject" ? 95 : 125;
    const rectHeight = node.type === "root" ? 44 : node.type === "subject" ? 38 : 32;
    const rx = node.x - rectWidth / 2;
    const ry = node.y - rectHeight / 2;

    let fill = node.color;
    let stroke = node.borderColor || "var(--line)";
    let textFill = node.textColor || "var(--text)";

    if (node.type === "root" || node.type === "subject") {
      fill = node.color;
      textFill = "#ffffff";
      stroke = "transparent";
    }

    let nodeClass = `radial-node ${node.type}-node`;
    if (node.id === selectedCustomNodeId) {
      nodeClass += " selected";
    }
    if (node.type === "custom") {
      nodeClass += " custom-node";
    }

    html += `<g class="${nodeClass}" data-id="${node.id}" transform="translate(0,0)">`;
    html += `<rect x="${rx}" y="${ry}" width="${rectWidth}" height="${rectHeight}" fill="${fill}" stroke="${stroke}" />`;
    html += `<text x="${node.x}" y="${node.y + 4}" fill="${textFill}" text-anchor="middle">${node.label}</text>`;
    html += `</g>`;
  });
  html += `</g>`;

  html += `</g></svg>`;

  overallMapContainer.innerHTML = html;
  setupMapInteractions();
}

function setupMapInteractions() {
  const svgEl = document.querySelector("#radial-map-svg");
  if (!svgEl) return;

  svgEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = 1.05;
    if (e.deltaY < 0) {
      mapZoom = Math.min(mapZoom * zoomFactor, 2.5);
    } else {
      mapZoom = Math.max(mapZoom / zoomFactor, 0.3);
    }
    renderRadialMap();
  });

  svgEl.addEventListener("mousedown", (e) => {
    const nodeG = e.target.closest(".radial-node");
    if (nodeG) {
      const nodeId = nodeG.dataset.id;
      const nodeObj = mapNodes.find(n => n.id === nodeId);
      
      if (nodeObj.type === "custom") {
        selectedCustomNodeId = nodeId;
        mapSaveStatus.textContent = `Selected custom node "${nodeObj.label}". Press Delete key to remove it.`;
        renderRadialMap();
      } else if (nodeObj.type === "topic") {
        const slideIdx = slides.findIndex(s => s.id === nodeId);
        if (slideIdx !== -1) {
          openPresentation(slideIdx);
        }
        return;
      }

      draggedNode = nodeObj;
      isPanning = false;

      const rect = svgEl.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - mapPanX) / mapZoom;
      const clickY = (e.clientY - rect.top - mapPanY) / mapZoom;

      nodeDragOffset.x = draggedNode.x - clickX;
      nodeDragOffset.y = draggedNode.y - clickY;
    } else {
      isPanning = true;
      startX = e.clientX - mapPanX;
      startY = e.clientY - mapPanY;
      svgEl.classList.add("interacting");
    }
  });

  svgEl.addEventListener("mousemove", (e) => {
    if (draggedNode) {
      const rect = svgEl.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - mapPanX) / mapZoom;
      const mouseY = (e.clientY - rect.top - mapPanY) / mapZoom;
      
      draggedNode.x = mouseX + nodeDragOffset.x;
      draggedNode.y = mouseY + nodeDragOffset.y;
      renderRadialMap();
    } else if (isPanning) {
      mapPanX = e.clientX - startX;
      mapPanY = e.clientY - startY;
      
      const groupEl = svgEl.querySelector("g");
      if (groupEl) {
        groupEl.setAttribute("transform", `translate(${mapPanX}, ${mapPanY}) scale(${mapZoom})`);
      }
    }
  });

  window.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      svgEl.classList.remove("interacting");
      renderRadialMap();
    }
    draggedNode = null;
  });

  // Touch Support
  svgEl.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const nodeG = document.elementFromPoint(touch.clientX, touch.clientY)?.closest(".radial-node");
      
      if (nodeG) {
        const nodeId = nodeG.dataset.id;
        const nodeObj = mapNodes.find(n => n.id === nodeId);
        if (nodeObj.type === "topic") {
          const slideIdx = slides.findIndex(s => s.id === nodeId);
          if (slideIdx !== -1) openPresentation(slideIdx);
          return;
        }
        draggedNode = nodeObj;
        const rect = svgEl.getBoundingClientRect();
        const clickX = (touch.clientX - rect.left - mapPanX) / mapZoom;
        const clickY = (touch.clientY - rect.top - mapPanY) / mapZoom;
        nodeDragOffset.x = draggedNode.x - clickX;
        nodeDragOffset.y = draggedNode.y - clickY;
      } else {
        isPanning = true;
        startX = touch.clientX - mapPanX;
        startY = touch.clientY - mapPanY;
      }
    }
  });

  svgEl.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (draggedNode) {
        const rect = svgEl.getBoundingClientRect();
        const mouseX = (touch.clientX - rect.left - mapPanX) / mapZoom;
        const mouseY = (touch.clientY - rect.top - mapPanY) / mapZoom;
        draggedNode.x = mouseX + nodeDragOffset.x;
        draggedNode.y = mouseY + nodeDragOffset.y;
        renderRadialMap();
      } else if (isPanning) {
        mapPanX = touch.clientX - startX;
        mapPanY = touch.clientY - startY;
        const groupEl = svgEl.querySelector("g");
        if (groupEl) {
          groupEl.setAttribute("transform", `translate(${mapPanX}, ${mapPanY}) scale(${mapZoom})`);
        }
      }
    }
  });

  svgEl.addEventListener("touchend", () => {
    isPanning = false;
    draggedNode = null;
    renderRadialMap();
  });
}

// Map Controls
mapResetBtn.addEventListener("click", () => {
  mapZoom = paper === "cs" ? 0.72 : 0.85;
  mapPanX = paper === "cs" ? 20 : 50;
  mapPanY = 40;
  renderRadialMap();
});

mapZoomInBtn.addEventListener("click", () => {
  mapZoom = Math.min(mapZoom * 1.2, 2.5);
  renderRadialMap();
});

mapZoomOutBtn.addEventListener("click", () => {
  mapZoom = Math.max(mapZoom / 1.2, 0.3);
  renderRadialMap();
});

// Custom Nodes Form
mapAddNodeBtn.addEventListener("click", () => {
  mapNodeForm.hidden = false;
  populateParentDropdown();
});

mapNodeCancel.addEventListener("click", () => {
  mapNodeForm.hidden = true;
});

mapNodeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const parent = mapNodeParent.value;
  const title = mapNodeTitle.value.trim();
  const url = mapNodeUrl.value.trim();
  
  if (title) {
    const id = `custom_node_${Date.now()}`;
    addCustomNode(id, parent, title, url);
    mapNodeTitle.value = "";
    mapNodeUrl.value = "";
    mapNodeForm.hidden = true;
    mapSaveStatus.textContent = "Saved to study guide and cloud sync completed.";
    setTimeout(() => {
      mapSaveStatus.textContent = "Saved locally. Select a custom node to add sub-nodes or press Delete to remove it.";
    }, 4000);
  }
});

// Delete custom node key bindings
window.addEventListener("keydown", (e) => {
  if (e.key === "Delete" || e.key === "Backspace") {
    if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      if (selectedCustomNodeId) {
        deleteCustomNode(selectedCustomNodeId);
        mapSaveStatus.textContent = "Custom node removed.";
        setTimeout(() => {
          mapSaveStatus.textContent = "Saved locally. Select a custom node to add sub-nodes or press Delete to remove it.";
        }, 3000);
      }
    }
  }
});

// ----------------------------------------------------
// PRESENTATION / SLIDE FOCUS DECK
// ----------------------------------------------------

function openPresentation(index = 0) {
  currentSlide = index;
  document.body.classList.add("presentation-open");
  presentation.hidden = false;
  
  currentPresentationView = "focus";
  focusTab.classList.add("active");
  overallMapTab.classList.remove("active");
  studySlide.hidden = false;
  overallMapPanel.hidden = true;

  renderSlide();
}

function closePresentation() {
  document.body.classList.remove("presentation-open");
  presentation.hidden = true;
  notesPanel.hidden = true;
}

function renderSlide() {
  const slide = slides[currentSlide];
  if (!slide) return;

  slideCounter.textContent = `Slide ${currentSlide + 1} of ${slides.length}`;
  slideSubject.textContent = slide.subject.title;
  slideSubject.style.color = slide.subject.accent;
  slideTitle.textContent = slide.topic;

  // Description
  slideDescription.textContent = `Comprehensive preparation topics index for ${slide.topic} under the primary study block of ${slide.subject.title}.`;

  // Links
  let linksHtml = "";
  if (slide.subject.guide) {
    linksHtml += `<a href="${slide.subject.guide}" target="_blank" rel="noreferrer">Study Guide ↗</a>`;
  }
  if (slide.subject.notebook) {
    linksHtml += `<a href="${slide.subject.notebook}" target="_blank" rel="noreferrer">Notebook ↗</a>`;
  }
  slideLinks.innerHTML = linksHtml;

  // Simple Mind Map node visualization
  let snippetHtml = `
    <div class="concept-branch">
      <div class="concept-node current" style="--map-color: ${slide.subject.accent}20; --map-text-color: ${slide.subject.accent};">
        ${slide.topic}
      </div>
    </div>
  `;
  resourceMap.innerHTML = snippetHtml;

  slidePrevious.disabled = currentSlide === 0;
  slideNext.disabled = currentSlide === slides.length - 1;

  // Load private study notes
  const topicId = slide.id;
  notesTitle.textContent = slide.topic;
  notesInput.value = notes[topicId] || "";
  notesStatus.textContent = "Saved locally & cloud";

  // Refresh tutor heading and render chat
  tutorTopicTitle.textContent = slide.topic;
  if (!tutorPanel.hidden) {
    renderTutorChat();
  }
}

function nextSlide() {
  if (currentSlide < slides.length - 1) {
    currentSlide++;
    renderSlide();
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    currentSlide--;
    renderSlide();
  }
}

// ----------------------------------------------------
// PRIVATE STUDY NOTES
// ----------------------------------------------------

notesInput.addEventListener("input", () => {
  notesStatus.textContent = "Saving...";
  clearTimeout(noteSaveTimer);
  
  const slide = slides[currentSlide];
  if (slide) {
    noteSaveTimer = setTimeout(() => {
      saveTopicNotes(slide.id, notesInput.value);
      notesStatus.textContent = "Saved locally & cloud";
    }, 500);
  }
});

notesExportBtn.addEventListener("click", () => {
  let text = `OpenGATE ${paper.toUpperCase()} STUDY NOTES\n`;
  text += "========================================\n\n";

  let exportedAny = false;
  slides.forEach(slide => {
    const noteContent = notes[slide.id];
    if (noteContent && noteContent.trim()) {
      exportedAny = true;
      text += `Subject: ${slide.subject.title}\n`;
      text += `Topic: ${slide.topic}\n`;
      text += `Notes:\n${noteContent}\n`;
      text += "----------------------------------------\n\n";
    }
  });

  if (!exportedAny) {
    text += "No notes recorded yet! Write some notes in Focus Mode.";
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `GATE_${paper.toUpperCase()}_Study_Notes.txt`;
  link.click();
  URL.revokeObjectURL(url);
});

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
  if (!presentation.hidden) {
    if (e.key === "ArrowRight") {
      nextSlide();
    } else if (e.key === "ArrowLeft") {
      prevSlide();
    } else if (e.key === "Escape") {
      closePresentation();
    } else if (e.key === "N" && e.shiftKey) {
      notesPanel.hidden = !notesPanel.hidden;
    } else if (e.key === "F" && e.shiftKey) {
      toggleFullscreen();
    }
  }

  // Focus search box with '/'
  if (e.key === "/" && document.activeElement !== searchInput && document.activeElement.tagName !== "TEXTAREA") {
    e.preventDefault();
    searchInput.focus();
  }
});

// Fullscreen
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.warn(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

// ----------------------------------------------------
// THEME SWITCHER
// ----------------------------------------------------

function initTheme() {
  const storedTheme = localStorage.getItem(themeKey);
  const isDark = storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (isDark) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem(themeKey, isDark ? "dark" : "light");
});

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadAppState();
});

// Search
searchInput.addEventListener("input", applyFilter);

// Subject buttons select
subjectButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    subjectButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const targetId = btn.dataset.subject;
    const card = document.getElementById(targetId);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
    }
  });
});

// Scroll to curriculum btn
document.querySelector("[data-scroll-to='curriculum']").addEventListener("click", () => {
  document.querySelector("#curriculum").scrollIntoView({ behavior: "smooth" });
});

// Mobile Nav
menuToggle.addEventListener("click", () => sidebar.classList.add("open"));
menuClose.addEventListener("click", () => sidebar.classList.remove("open"));

// Checkbox change listener
topicInputs.forEach((input) => {
  input.addEventListener("change", (e) => {
    const topicId = e.target.dataset.topic;
    const completed = e.target.checked;
    saveTopicProgress(topicId, completed);
  });
});

// Filter Chips
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    applyFilter();
  });
});

// Study triggers
document.querySelectorAll("[data-open-topic]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const topicId = btn.dataset.openTopic;
    const slideIdx = slides.findIndex(s => s.id === topicId);
    if (slideIdx !== -1) {
      openPresentation(slideIdx);
    }
  });
});

document.querySelectorAll("[data-present-subject]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const subjectId = btn.dataset.presentSubject;
    const slideIdx = slides.findIndex(s => s.subject.id === subjectId);
    if (slideIdx !== -1) {
      openPresentation(slideIdx);
    }
  });
});

presentAllBtn.addEventListener("click", () => openPresentation(0));
startPresentBtn.addEventListener("click", () => openPresentation(0));
presentationClose.addEventListener("click", closePresentation);

slidePrevious.addEventListener("click", prevSlide);
slideNext.addEventListener("click", nextSlide);

// Presentation tabs (Focus vs Memory Map)
focusTab.addEventListener("click", () => {
  currentPresentationView = "focus";
  focusTab.classList.add("active");
  overallMapTab.classList.remove("active");
  studySlide.hidden = false;
  overallMapPanel.hidden = true;
});

overallMapTab.addEventListener("click", () => {
  currentPresentationView = "map";
  overallMapTab.classList.add("active");
  focusTab.classList.remove("active");
  studySlide.hidden = true;
  overallMapPanel.hidden = false;
  renderRadialMap();
  populateParentDropdown();
});

openMemoryMapBtn.addEventListener("click", () => {
  openPresentation(0);
  currentPresentationView = "map";
  overallMapTab.classList.add("active");
  focusTab.classList.remove("active");
  studySlide.hidden = true;
  overallMapPanel.hidden = false;
  renderRadialMap();
  populateParentDropdown();
});

fullscreenToggle.addEventListener("click", toggleFullscreen);
document.querySelector("#presentation-fullscreen").addEventListener("click", toggleFullscreen);

slideNotesToggle.addEventListener("click", () => {
  notesPanel.hidden = !notesPanel.hidden;
  if (!notesPanel.hidden) {
    tutorPanel.hidden = true;
  }
});
notesClose.addEventListener("click", () => {
  notesPanel.hidden = true;
});

// Tutor panel toggling
slideTutorToggle.addEventListener("click", () => {
  tutorPanel.hidden = !tutorPanel.hidden;
  if (!tutorPanel.hidden) {
    notesPanel.hidden = true;
    renderTutorChat();
  }
});

mainTutorToggle.addEventListener("click", () => {
  tutorPanel.hidden = !tutorPanel.hidden;
  if (!tutorPanel.hidden) {
    notesPanel.hidden = true;
    renderTutorChat();
  }
});

// --- SVG Icon Constants for Fullscreen Toggle ---
// Lucide-style SVG representing expand corners (for entering fullscreen mode)
const tutorFullscreenSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`;
// Lucide-style SVG representing shrink/minimize corners (for exiting fullscreen mode)
const tutorMinimizeSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path></svg>`;

tutorClose.addEventListener("click", () => {
  tutorPanel.hidden = true;
  tutorPanel.classList.remove("fullscreen");
  if (tutorFullscreen) {
    tutorFullscreen.innerHTML = tutorFullscreenSVG;
    tutorFullscreen.title = "Toggle Fullscreen";
  }
});

if (tutorFullscreen) {
  tutorFullscreen.addEventListener("click", () => {
    tutorPanel.classList.toggle("fullscreen");
    const isFullscreen = tutorPanel.classList.contains("fullscreen");
    tutorFullscreen.innerHTML = isFullscreen ? tutorMinimizeSVG : tutorFullscreenSVG;
    tutorFullscreen.title = isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen";
  });
}


// Tutor Chat Rendering and Management
function renderTutorChat() {
  let topicId;
  let topicTitleText;
  
  const isPresentationOpen = document.body.classList.contains("presentation-open");
  if (isPresentationOpen) {
    const slide = slides[currentSlide];
    if (!slide) return;
    topicId = slide.id;
    topicTitleText = slide.topic;
  } else {
    topicId = `general:${paper}`;
    topicTitleText = `GATE ${paper.toUpperCase()} Tutor`;
  }
  
  tutorTopicTitle.textContent = topicTitleText;
  
  // Default welcome message
  const defaultWelcome = {
    role: "assistant",
    content: isPresentationOpen 
      ? `Hello! I am your AI Tutor. Ask me any conceptual questions, requests to solve math problems, or coding queries about the active topic (**${topicTitleText}**). I will retrieve context from the GATE syllabus guides and textbooks to help you!`
      : `Hello! I am your AI Tutor for the **GATE ${paper.toUpperCase()}** syllabus explorer. Ask me any general questions about the syllabus, exam pattern, preparation timeline, cutoffs, or specific topics. I will query the databases and textbooks to help you!`
  };
  
  if (!tutorHistories[topicId]) {
    tutorHistories[topicId] = [defaultWelcome];
  }
  
  tutorChatHistory.innerHTML = "";
  
  tutorHistories[topicId].forEach(msg => {
    const bubble = document.createElement("div");
    bubble.className = `tutor-message ${msg.role}`;
    
    if (msg.role === "user") {
      bubble.textContent = msg.content;
    } else {
      // Parse markdown to HTML
      if (window.marked && typeof marked.parse === "function") {
        bubble.innerHTML = marked.parse(msg.content);
      } else {
        bubble.textContent = msg.content;
      }
    }
    
    tutorChatHistory.appendChild(bubble);
  });
  
  // Render LaTeX math formulas
  if (window.renderMathInElement) {
    renderMathInElement(tutorChatHistory, {
      delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "$", right: "$", display: false}
      ],
      throwOnError: false
    });
  }
  
  // Highlight code blocks
  if (window.hljs) {
    tutorChatHistory.querySelectorAll("pre code").forEach(block => {
      hljs.highlightElement(block);
    });
  }
  
  // Scroll to bottom
  tutorChatHistory.scrollTop = tutorChatHistory.scrollHeight;
}

// Chat submission handler
tutorChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const isPresentationOpen = document.body.classList.contains("presentation-open");
  let topicId;
  let subjectId = null;
  
  if (isPresentationOpen) {
    const slide = slides[currentSlide];
    if (!slide) return;
    topicId = slide.id;
    subjectId = slide.subject.id;
  } else {
    topicId = `general:${paper}`;
  }
  
  const questionText = tutorChatInput.value.trim();
  if (!questionText) return;
  
  tutorChatInput.value = "";
  
  // Add user message to history
  tutorHistories[topicId].push({
    role: "user",
    content: questionText
  });
  
  renderTutorChat();
  
  // Set UI loading states
  tutorStatus.textContent = "Generating...";
  tutorChatInput.disabled = true;
  document.querySelector("#tutor-send-btn").disabled = true;
  
  // Render loading bubble
  const loaderBubble = document.createElement("div");
  loaderBubble.className = "tutor-message assistant loading";
  loaderBubble.innerHTML = `
    <span class="tutor-loader-dot"></span>
    <span class="tutor-loader-dot"></span>
    <span class="tutor-loader-dot"></span>
  `;
  tutorChatHistory.appendChild(loaderBubble);
  tutorChatHistory.scrollTop = tutorChatHistory.scrollHeight;
  
  try {
    // Send history before the active user message
    const historyToSend = tutorHistories[topicId].slice(0, -1);
    
    const res = await fetch("/api/tutor/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: questionText,
        paper: paper,
        subject_id: subjectId,
        topic_id: topicId,
        chat_history: historyToSend
      })
    });
    
    // Remove loader
    loaderBubble.remove();
    
    if (res.ok) {
      const data = await res.json();
      tutorHistories[topicId].push({
        role: "assistant",
        content: data.response
      });
      tutorStatus.textContent = "Ready";
    } else {
      const errData = await res.json();
      tutorHistories[topicId].push({
        role: "assistant",
        content: `Error: ${errData.detail || "Unable to retrieve response from AI Tutor."}`
      });
      tutorStatus.textContent = "Error";
    }
  } catch (err) {
    loaderBubble.remove();
    tutorHistories[topicId].push({
      role: "assistant",
      content: `Failed to connect to backend server: ${err.message}`
    });
    tutorStatus.textContent = "Failed";
  } finally {
    tutorChatInput.disabled = false;
    document.querySelector("#tutor-send-btn").disabled = false;
    renderTutorChat();
    tutorChatInput.focus();
  }
});

// Intercept keyboard events in the chat input area:
// - Enter (without Shift): Prevents default newline insertion and submits the prompt immediately.
// - Shift + Enter: Allows standard multiline newline entry.
if (tutorChatInput) {
  tutorChatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Stop a physical newline from being typed
      tutorChatForm.requestSubmit(); // Trigger standard form validation and submit event
    }
  });
}


