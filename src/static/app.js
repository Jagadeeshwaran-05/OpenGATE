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
const tutorModeToggle = document.querySelector("#tutor-mode-toggle");
const tutorChatContainer = document.querySelector("#tutor-chat-container");
const tutorTestContainer = document.querySelector("#tutor-test-container");

let testModeActive = false;
let activeTest = null; 

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
  // Reset test mode
  testModeActive = false;
  activeTest = null;
  if (tutorModeToggle) {
    tutorModeToggle.style.display = "none";
    tutorModeToggle.classList.remove("active");
    tutorModeToggle.style.background = "";
    tutorModeToggle.style.color = "";
  }
  if (tutorChatContainer) tutorChatContainer.hidden = false;
  if (tutorTestContainer) tutorTestContainer.hidden = true;
});

if (tutorFullscreen) {
  tutorFullscreen.addEventListener("click", () => {
    tutorPanel.classList.toggle("fullscreen");
    const isFullscreen = tutorPanel.classList.contains("fullscreen");
    tutorFullscreen.innerHTML = isFullscreen ? tutorMinimizeSVG : tutorFullscreenSVG;
    tutorFullscreen.title = isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen";
    
    // Toggle the Mock Test Mode button display based on fullscreen status
    if (tutorModeToggle) {
      tutorModeToggle.style.display = isFullscreen ? "inline-flex" : "none";
      if (!isFullscreen && testModeActive) {
        // Automatically switch back to chat mode when leaving fullscreen
        testModeActive = false;
        activeTest = null;
        if (tutorChatContainer) tutorChatContainer.hidden = false;
        if (tutorTestContainer) tutorTestContainer.hidden = true;
        tutorModeToggle.classList.remove("active");
        tutorModeToggle.style.background = "";
        tutorModeToggle.style.color = "";
      }
    }
  });
}

if (tutorModeToggle) {
  tutorModeToggle.addEventListener("click", () => {
    testModeActive = !testModeActive;
    if (testModeActive) {
      tutorModeToggle.classList.add("active");
      tutorModeToggle.style.background = "var(--accent)";
      tutorModeToggle.style.color = "#ffffff";
      if (tutorChatContainer) tutorChatContainer.hidden = true;
      if (tutorTestContainer) tutorTestContainer.hidden = false;
      renderTestArea();
    } else {
      tutorModeToggle.classList.remove("active");
      tutorModeToggle.style.background = "";
      tutorModeToggle.style.color = "";
      if (tutorChatContainer) tutorChatContainer.hidden = false;
      if (tutorTestContainer) tutorTestContainer.hidden = true;
    }
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


// ====================================================
// MOCK TEST RUNNER & RENDERERS
// ====================================================

function renderTestArea() {
  if (!tutorTestContainer) return;
  
  if (!activeTest) {
    // Render Setup screen
    renderTestSetup();
  } else if (activeTest.scoreReport) {
    // Render Results/Scorecard screen
    renderTestScorecard();
  } else {
    // Render active question screen
    renderActiveQuestion();
  }
}

function renderTestSetup() {
  // Generate subject list checkboxes if any subjects are loaded
  const subjectListHtml = subjects.map(sub => {
    // Format name cleanly from ID
    const title = sub.id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `
      <label class="tutor-test-checkbox-label" id="lbl-sub-${sub.id}">
        <input type="checkbox" name="test-subject-cb" value="${sub.id}">
        <span>${sub.short}</span>
      </label>
    `;
  }).join('');

  tutorTestContainer.innerHTML = `
    <div style="max-width: 650px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 20px; padding: 20px;">
      <div style="text-align: center;">
        <h2 style="margin: 0 0 10px 0; color: var(--accent);">GATE AI Mock Test Simulator</h2>
        <p style="font-size: 13px; opacity: 0.8; line-height: 1.6;">
          Test your preparation with a structured 20-question mock test. 
          10 questions are extracted from previous year question papers or study material via RAG, 
          and 10 questions are formulated dynamically by the AI to match the GATE exam syllabus.
        </p>
      </div>

      <div class="tutor-test-card" style="margin: 0;">
        <h4 style="margin: 0 0 12px 0;">Configure Test Scope</h4>
        
        <div style="display: flex; gap: 20px; margin-bottom: 16px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="test-scope-radio" value="general" checked>
            <span>General (Mix of all subjects)</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="test-scope-radio" value="subject">
            <span>Subject-Specific</span>
          </label>
        </div>

        <div id="test-subject-selection-container" style="display: none; border-top: 1px solid var(--line); padding-top: 16px;">
          <h5 style="margin: 0 0 8px 0; opacity: 0.9;">Select Subjects:</h5>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px;">
            ${subjectListHtml}
          </div>
        </div>
      </div>

      <button class="button primary" id="start-test-btn" style="min-height: 44px; font-weight: 700; width: 100%; font-size: 14px;">
        Start Mock Test
      </button>
    </div>
  `;

  // Bind change/checked behaviors
  const radios = tutorTestContainer.querySelectorAll('input[name="test-scope-radio"]');
  const subjectContainer = tutorTestContainer.querySelector('#test-subject-selection-container');
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      subjectContainer.style.display = e.target.value === 'subject' ? 'block' : 'none';
    });
  });

  const checkboxes = tutorTestContainer.querySelectorAll('input[name="test-subject-cb"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const label = tutorTestContainer.querySelector(`#lbl-sub-${e.target.value}`);
      if (label) {
        if (e.target.checked) label.classList.add('checked');
        else label.classList.remove('checked');
      }
    });
  });

  // Bind start action
  tutorTestContainer.querySelector('#start-test-btn').addEventListener('click', async () => {
    const activeScope = tutorTestContainer.querySelector('input[name="test-scope-radio"]:checked').value;
    let selectedSubjects = [];
    
    if (activeScope === 'subject') {
      const checkedBoxes = tutorTestContainer.querySelectorAll('input[name="test-subject-cb"]:checked');
      checkedBoxes.forEach(box => selectedSubjects.push(box.value));
      if (selectedSubjects.length === 0) {
        alert('Please select at least one subject for subject-specific test mode.');
        return;
      }
    }

    // Show dynamic loading state
    tutorTestContainer.innerHTML = `
      <div style="text-align: center; margin: auto; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; max-width: 500px;">
        <div class="tutor-test-spinner"></div>
        <h3 style="margin: 0; color: var(--accent);">Compiling Your Mock Test...</h3>
        <p style="font-size: 13px; opacity: 0.8; line-height: 1.6; margin: 0;">
          Querying ChromaDB vector database for 10 relevant previous year questions (PYQs) and formulating 10 specialized syllabus topics with the AI. This process usually takes 10-15 seconds. Please do not close the panel.
        </p>
      </div>
    `;

    try {
      const response = await fetch('/api/tutor/test/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paper: paper,
          test_type: activeScope,
          subjects: selectedSubjects
        })
      });

      if (!response.ok) {
        throw new Error('Server returned an error generating test');
      }

      const result = await response.json();
      
      activeTest = {
        questions: result.questions,
        answers: {},
        currentIndex: 0,
        scoreReport: null
      };

      renderActiveQuestion();
    } catch (err) {
      tutorTestContainer.innerHTML = `
        <div style="text-align: center; margin: auto; padding: 40px; max-width: 450px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
          <div style="font-size: 40px; color: #ef4444;">⚠️</div>
          <h3 style="margin: 0;">Generation Failed</h3>
          <p style="font-size: 13px; opacity: 0.8; line-height: 1.5; margin: 0;">
            There was a connection or server error while setting up your mock test. Let's try again.
          </p>
          <button class="button primary" id="retry-setup-btn" style="min-height: 40px; padding: 0 20px;">Retry</button>
        </div>
      `;
      const retryBtn = tutorTestContainer.querySelector('#retry-setup-btn');
      if (retryBtn) retryBtn.addEventListener('click', renderTestSetup);
    }
  });
}

function renderActiveQuestion() {
  if (!activeTest || !activeTest.questions || activeTest.questions.length === 0) return;

  const currentQ = activeTest.questions[activeTest.currentIndex];
  const progressPercent = (activeTest.currentIndex / activeTest.questions.length) * 100;
  const currentAnswer = activeTest.answers[currentQ.id] || "";
  
  // Format clean subject label
  const subjectLabel = currentQ.subject_id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  let answerInputHtml = "";

  if (currentQ.options && currentQ.options.length > 0) {
    // MCQ options
    const letters = ["A", "B", "C", "D"];
    answerInputHtml = `
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
        ${currentQ.options.map((opt, idx) => {
          const letter = letters[idx];
          const isSelected = currentAnswer === letter;
          return `
            <div class="tutor-test-option ${isSelected ? 'selected' : ''}" data-letter="${letter}">
              <input type="radio" name="q-option" value="${letter}" ${isSelected ? 'checked' : ''} style="pointer-events: none;">
              <div>
                <strong style="color: var(--accent); margin-right: 4px;">${letter}.</strong>
                <span>${opt}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else {
    // NAT input
    answerInputHtml = `
      <div style="margin-top: 15px;">
        <label style="display: block; font-weight: bold; margin-bottom: 8px; font-size: 13px;">Enter Numerical Answer:</label>
        <input type="text" id="nat-answer-input" placeholder="e.g. 5.14 or 24" value="${currentAnswer}" style="width: 100%; max-width: 320px; padding: 12px; font-size: 15px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface-soft); color: var(--text);">
        <p style="font-size: 11px; opacity: 0.6; margin: 8px 0 0 0;">Please write exact decimal/integer values without units.</p>
      </div>
    `;
  }

  tutorTestContainer.innerHTML = `
    <div style="max-width: 650px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 16px; padding: 20px;">
      <!-- Progress and metadata header -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 700; margin-bottom: 6px;">
          <span>Question ${activeTest.currentIndex + 1} of ${activeTest.questions.length}</span>
          <span style="opacity: 0.7;">Progress: ${Math.round(progressPercent)}%</span>
        </div>
        <div class="progress-bar-container" style="background: var(--line); height: 6px; border-radius: 3px; overflow: hidden;">
          <div class="progress-bar-fill" style="background: var(--accent); height: 100%; width: ${progressPercent}%; transition: width 0.2s ease;"></div>
        </div>
      </div>

      <!-- Question Card -->
      <div class="tutor-test-card">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 10px; margin-bottom: 8px;">
          <span class="tutor-test-badge ${currentQ.source_type}">${currentQ.source_type === 'pyq' ? 'PYQ / Study Material' : 'AI Generated'}</span>
          <span style="font-size: 11px; opacity: 0.7; font-weight: 600;">Subject: ${subjectLabel}</span>
        </div>
        
        <div style="font-size: 15px; line-height: 1.6; font-weight: 500; white-space: pre-line;">
          ${currentQ.question_text}
        </div>

        ${answerInputHtml}
      </div>

      <!-- Controls footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 10px;">
        <button class="button quiet" id="prev-q-btn" ${activeTest.currentIndex === 0 ? 'disabled' : ''} style="min-height: 40px; padding: 0 20px;">
          Previous
        </button>
        
        <button class="button primary" id="next-q-btn" style="min-height: 40px; padding: 0 24px;">
          ${activeTest.currentIndex === activeTest.questions.length - 1 ? 'Submit Test' : 'Next Question'}
        </button>
      </div>
    </div>
  `;

  // Bind option clicks
  const optionDivs = tutorTestContainer.querySelectorAll('.tutor-test-option');
  optionDivs.forEach(div => {
    div.addEventListener('click', () => {
      optionDivs.forEach(d => d.classList.remove('selected'));
      div.classList.add('selected');
      const radio = div.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      
      const answerVal = div.getAttribute('data-letter');
      activeTest.answers[currentQ.id] = answerVal;
    });
  });

  // Bind NAT text changes
  const natInput = tutorTestContainer.querySelector('#nat-answer-input');
  if (natInput) {
    natInput.addEventListener('input', (e) => {
      activeTest.answers[currentQ.id] = e.target.value;
    });
  }

  // Bind button events
  tutorTestContainer.querySelector('#prev-q-btn').addEventListener('click', () => {
    if (activeTest.currentIndex > 0) {
      activeTest.currentIndex--;
      renderActiveQuestion();
    }
  });

  tutorTestContainer.querySelector('#next-q-btn').addEventListener('click', () => {
    if (activeTest.currentIndex < activeTest.questions.length - 1) {
      activeTest.currentIndex++;
      renderActiveQuestion();
    } else {
      // Last question - Submit entire test!
      submitMockTestAnswers();
    }
  });
}

async function submitMockTestAnswers() {
  if (!activeTest) return;

  // Confirm before submitting
  const answeredCount = Object.keys(activeTest.answers).filter(k => activeTest.answers[k].trim() !== "").length;
  const unansweredCount = activeTest.questions.length - answeredCount;
  
  if (unansweredCount > 0) {
    const confirmSubmit = confirm(`You have ${unansweredCount} unanswered questions. Are you sure you want to submit the test?`);
    if (!confirmSubmit) return;
  }

  // Show evaluating/grading view
  tutorTestContainer.innerHTML = `
    <div style="text-align: center; margin: auto; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; max-width: 500px;">
      <div class="tutor-test-spinner"></div>
      <h3 style="margin: 0; color: var(--accent);">Evaluating Your Test...</h3>
      <p style="font-size: 13px; opacity: 0.8; line-height: 1.6; margin: 0;">
        Grading your Multiple Choice (MCQ) and Numerical (NAT) responses against correct standards using the AI Tutor. This takes a few seconds.
      </p>
    </div>
  `;

  try {
    const response = await fetch('/api/tutor/test/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions: activeTest.questions,
        answers: activeTest.answers
      })
    });

    if (!response.ok) {
      throw new Error('Evaluation request failed');
    }

    const report = await response.json();
    activeTest.scoreReport = report;
    
    renderTestScorecard();
  } catch (err) {
    tutorTestContainer.innerHTML = `
      <div style="text-align: center; margin: auto; padding: 40px; max-width: 450px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <div style="font-size: 40px; color: #ef4444;">⚠️</div>
        <h3 style="margin: 0;">Evaluation Error</h3>
        <p style="font-size: 13px; opacity: 0.8; line-height: 1.5; margin: 0;">
          An error occurred while grading your test submission. Let's try resubmitting.
        </p>
        <button class="button primary" id="retry-submit-btn" style="min-height: 40px; padding: 0 20px;">Resubmit Answers</button>
      </div>
    `;
    const retryBtn = tutorTestContainer.querySelector('#retry-submit-btn');
    if (retryBtn) retryBtn.addEventListener('click', submitMockTestAnswers);
  }
}

function renderTestScorecard() {
  if (!activeTest || !activeTest.scoreReport) return;

  const score = activeTest.scoreReport.score;
  const percentage = Math.round((score / activeTest.questions.length) * 100);
  
  // Grade message
  let feedbackMessage = "";
  if (percentage >= 85) feedbackMessage = "Excellent performance! You demonstrate an outstanding grasp of the GATE concepts.";
  else if (percentage >= 65) feedbackMessage = "Good attempt! You have a solid foundation, with room for minor revision.";
  else if (percentage >= 40) feedbackMessage = "Passable score. You should spend extra time studying resources for topics marked incorrect.";
  else feedbackMessage = "Requires focus. Use the syllabus mindmap to guide revision on these core topics.";

  // Build list of reviewed questions
  const evaluationsMap = {};
  activeTest.scoreReport.evaluations.forEach(ev => {
    evaluationsMap[ev.id] = ev;
  });

  const questionReviewsHtml = activeTest.questions.map((q, idx) => {
    const ev = evaluationsMap[q.id] || { correct: false, feedback: "No feedback generated.", correct_answer: q.correct_answer };
    const userAns = activeTest.answers[q.id] || "No Answer Provided";
    const subjectLabel = q.subject_id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    return `
      <div class="tutor-test-result-card ${ev.correct ? 'correct' : 'incorrect'}">
        <div class="tutor-test-result-header">
          <span class="status-icon ${ev.correct ? 'correct' : 'incorrect'}">
            ${ev.correct ? '✅ Correct' : '❌ Incorrect'}
          </span>
          <span style="opacity: 0.8; font-weight: 600;">Question ${idx + 1}</span>
        </div>
        
        <div style="font-size: 14px; font-weight: 500; line-height: 1.5; white-space: pre-line;">
          ${q.question_text}
        </div>

        <div style="display: flex; gap: 8px; font-size: 11px; margin-top: 6px;">
          <span class="tutor-test-badge ${q.source_type}">${q.source_type === 'pyq' ? 'PYQ / Study Guide' : 'AI Generated'}</span>
          <span style="opacity: 0.7; font-weight: 600; padding: 4px 0;">Subject: ${subjectLabel}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; background: rgba(0, 0, 0, 0.15); padding: 10px; border-radius: 6px; margin-top: 10px;">
          <div>
            <strong style="opacity: 0.8;">Your Answer:</strong>
            <span style="font-weight: bold; color: ${ev.correct ? '#4ade80' : '#f87171'};">${userAns}</span>
          </div>
          <div>
            <strong style="opacity: 0.8;">Correct Answer:</strong>
            <span style="font-weight: bold; color: #4ade80;">${ev.correct_answer}</span>
          </div>
        </div>

        <div style="font-size: 12px; line-height: 1.5; opacity: 0.9; border-top: 1px dashed var(--line); padding-top: 8px; margin-top: 10px;">
          <strong>Explanation:</strong> ${ev.feedback}
        </div>
      </div>
    `;
  }).join('');

  tutorTestContainer.innerHTML = `
    <div style="max-width: 650px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 20px; padding: 20px;">
      <div style="text-align: center;">
        <h2 style="margin: 0; color: var(--accent);">Mock Test Scorecard</h2>
        <p style="font-size: 13px; opacity: 0.8; margin-top: 6px;">Mock Test completed successfully</p>
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 30px; flex-wrap: wrap;">
        <div class="tutor-test-score-circle">
          <span class="tutor-test-score-value">${score} / 20</span>
          <span class="tutor-test-score-label">Score</span>
        </div>
        
        <div style="flex: 1; min-width: 250px;">
          <h4 style="margin: 0 0 8px 0; color: var(--accent);">${percentage}% Correct Answers</h4>
          <p style="font-size: 13px; line-height: 1.6; margin: 0; opacity: 0.9;">
            ${feedbackMessage}
          </p>
        </div>
      </div>

      <!-- Action items -->
      <div style="display: flex; gap: 16px; justify-content: stretch; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 16px 0;">
        <button class="button quiet" id="retake-test-btn" style="flex: 1; min-height: 40px; font-weight: bold;">
          Retake Test
        </button>
        <button class="button primary" id="exit-test-btn" style="flex: 1; min-height: 40px; font-weight: bold;">
          Return to Chat
        </button>
      </div>

      <!-- Detailed breakdown -->
      <div>
        <h4 style="margin: 0 0 12px 0;">Question-by-Question Review</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${questionReviewsHtml}
        </div>
      </div>
    </div>
  `;

  // Bind button actions
  tutorTestContainer.querySelector('#retake-test-btn').addEventListener('click', () => {
    activeTest = null;
    renderTestSetup();
  });

  tutorTestContainer.querySelector('#exit-test-btn').addEventListener('click', () => {
    testModeActive = false;
    activeTest = null;
    if (tutorModeToggle) {
      tutorModeToggle.classList.remove("active");
      tutorModeToggle.style.background = "";
      tutorModeToggle.style.color = "";
    }
    if (tutorChatContainer) tutorChatContainer.hidden = false;
    if (tutorTestContainer) tutorTestContainer.hidden = true;
  });
}


