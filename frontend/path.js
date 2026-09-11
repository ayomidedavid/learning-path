const API_BASE = 'http://localhost:8000';
let token = localStorage.getItem('token');
let completedTopics = [];
let graphData = null;
let selectedMode = localStorage.getItem('learningMode') || 'linear';
let selectedModule = null;

if (!token) window.location.href = 'index.html';

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('learningMode');
    window.location.href = 'index.html';
}

const urlParams = new URLSearchParams(window.location.search);
const targetTopic = urlParams.get('target');

if (!targetTopic) {
    window.location.href = 'dashboard.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('path-title').innerText = `Learning Path for: ${targetTopic}`;

    const mode = urlParams.get('mode') || selectedMode;
    selectedMode = mode;
    setMode(mode);

    await fetchProgress();
    await fetchGraph();
    renderPath();
    renderModule(targetTopic);
});

async function fetchProgress() {
    try {
        const res = await fetch(`${API_BASE}/me/progress`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load progress');
        const data = await res.json();
        completedTopics = data.completed || [];
    } catch (e) {
        console.error(e);
        logout();
    }
}

async function fetchGraph() {
    try {
        const res = await fetch(`${API_BASE}/graph`);
        graphData = await res.json();
    } catch (e) {
        console.error(e);
    }
}

function setMode(mode) {
    selectedMode = mode;
    localStorage.setItem('learningMode', mode);
    const linearBtn = document.getElementById('linear-mode');
    const dynamicBtn = document.getElementById('dynamic-mode');
    if (linearBtn && dynamicBtn) {
        linearBtn.style.background = mode === 'linear' ? 'linear-gradient(45deg, var(--secondary-accent), var(--primary-accent))' : 'rgba(255,255,255,0.08)';
        dynamicBtn.style.background = mode === 'dynamic' ? 'linear-gradient(45deg, var(--secondary-accent), var(--primary-accent))' : 'rgba(255,255,255,0.08)';
    }
    linearBtn.onclick = () => { setMode('linear'); renderPath(); renderModule(selectedModule || targetTopic); };
    dynamicBtn.onclick = () => { setMode('dynamic'); renderPath(); renderModule(selectedModule || targetTopic); };
}

function getChildrenMap() {
    const map = new Map();
    for (const link of graphData.links) {
        if (!map.has(link.source)) map.set(link.source, []);
        map.get(link.source).push(link.target);
    }
    return map;
}

function getPrerequisiteMap() {
    const map = new Map();
    for (const link of graphData.links) {
        if (!map.has(link.target)) map.set(link.target, []);
        map.get(link.target).push(link.source);
    }
    return map;
}

function isTopicLocked(topicId) {
    if (!graphData || !graphData.links) return false;
    const prereqs = getPrerequisiteMap().get(topicId) || [];
    return prereqs.length > 0 && prereqs.some(p => !completedTopics.includes(p));
}

function generateRoute() {
    if (!graphData || !graphData.nodes || !graphData.links) return [targetTopic];

    const childrenMap = getChildrenMap();
    const route = new Set([targetTopic]);
    const queue = [targetTopic];

    while (queue.length > 0) {
        const current = queue.shift();
        const children = childrenMap.get(current) || [];
        for (const child of children) {
            if (!route.has(child)) {
                route.add(child);
                queue.push(child);
            }
        }
    }

    let result = Array.from(route);

    if (selectedMode === 'dynamic') {
        result = result.filter(item => !completedTopics.includes(item) || item === targetTopic);
    }

    if (result.length === 0) result = [targetTopic];
    return result;
}

function getTopicFamily(topicId) {
    const lowered = topicId.toLowerCase();

    if (lowered.includes('number') || lowered.includes('numer') || lowered.includes('foundational')) return 'Foundational';
    if (lowered.includes('algebra') || lowered.includes('equation') || lowered.includes('inequal') || lowered.includes('commercial') || lowered.includes('matrix') || lowered.includes('series')) return 'Algebra';
    if (lowered.includes('geometry') || lowered.includes('coordinate') || lowered.includes('trig') || lowered.includes('mensur') || lowered.includes('vector')) return 'Geometry';
    if (lowered.includes('calculus')) return 'Calculus';
    if (lowered.includes('stat') || lowered.includes('probab')) return 'Statistics';
    return 'Applied';
}

function getFamilyColor(topicId) {
    const family = getTopicFamily(topicId);
    const palette = {
        Foundational: 'linear-gradient(135deg, rgba(255, 196, 87, 0.32), rgba(255, 153, 51, 0.18))',
        Algebra: 'linear-gradient(135deg, rgba(126, 211, 255, 0.32), rgba(58, 123, 213, 0.18))',
        Geometry: 'linear-gradient(135deg, rgba(110, 231, 183, 0.28), rgba(36, 191, 129, 0.17))',
        Calculus: 'linear-gradient(135deg, rgba(195, 132, 255, 0.28), rgba(149, 76, 233, 0.17))',
        Statistics: 'linear-gradient(135deg, rgba(253, 164, 175, 0.28), rgba(244, 114, 182, 0.18))',
        Applied: 'linear-gradient(135deg, rgba(96, 165, 250, 0.28), rgba(16, 185, 129, 0.16))'
    };
    return palette[family] || palette.Applied;
}

function renderPath() {
    const route = generateRoute();
    const routeSet = new Set(route);
    const pathList = document.getElementById('path-list');
    pathList.innerHTML = '';

    route.forEach((item, index) => {
        const li = document.createElement('li');
        const locked = isTopicLocked(item);
        li.className = `path-step ${selectedModule === item || index === 0 ? 'active' : ''} ${completedTopics.includes(item) ? 'done' : ''} ${locked ? 'locked' : ''}`;
        li.textContent = `${index + 1}. ${item}${locked ? ' (Locked)' : ''}`;
        li.onclick = () => {
            if (locked) {
                alert('This course is locked until you complete its prerequisite course(s).');
                return;
            }
            selectedModule = item;
            renderPath();
            renderModule(item);
        };
        pathList.appendChild(li);
    });

    const conceptMap = document.getElementById('concept-map');
    const visibleNodes = graphData.nodes.map(node => {
        const isSelected = routeSet.has(node.id);
        const isDone = completedTopics.includes(node.id);
        const isLocked = isTopicLocked(node.id);
        const family = getTopicFamily(node.id);
        const color = getFamilyColor(node.id);
        const details = node.details || '';
        const subTopics = details
            .replace(/\s*[-–—]\s*/g, ', ')
            .replace(/\s+and\s+/gi, ', ')
            .split(/[;,|]/)
            .map(item => item.trim())
            .filter(Boolean)
            .slice(0, 4);

        return {
            ...node,
            isSelected,
            isDone,
            isLocked,
            family,
            color,
            subTopics,
            isMain: true
        };
    });

    const familyCenter = {
        Foundational: { x: 24, y: 30 },
        Algebra: { x: 44, y: 26 },
        Geometry: { x: 66, y: 36 },
        Calculus: { x: 72, y: 70 },
        Statistics: { x: 52, y: 74 },
        Applied: { x: 28, y: 68 }
    };

    const nodePositions = {};
    visibleNodes.forEach((node) => {
        const family = node.family;
        const center = familyCenter[family] || { x: 50, y: 50 };
        const familyNodes = visibleNodes.filter(item => item.family === family);
        const familyIndex = familyNodes.findIndex(item => item.id === node.id);
        const radius = family === 'Foundational' ? 12 : family === 'Algebra' ? 15 : 18;
        const x = center.x + Math.cos((Math.PI * 2 * familyIndex) / Math.max(1, familyNodes.length)) * radius;
        const y = center.y + Math.sin((Math.PI * 2 * familyIndex) / Math.max(1, familyNodes.length)) * radius;
        nodePositions[node.id] = { x, y };

        node.subTopics.forEach((topicName, idx) => {
            const angle = (Math.PI * 2 * idx) / Math.max(1, node.subTopics.length);
            const subX = x + Math.cos(angle) * (12 + idx * 2);
            const subY = y + Math.sin(angle) * (12 + idx * 2) + 12;
            nodePositions[`${node.id} • ${topicName}`] = { x: subX, y: subY };
        });
    });

    const linkMarkup = graphData.links.map(link => {
        const from = nodePositions[link.source];
        const to = nodePositions[link.target];
        if (!from || !to) return '';
        const curve = Math.abs(to.x - from.x) * 0.6 + 10;
        const path = `M ${from.x} ${from.y} C ${from.x + curve} ${from.y}, ${to.x - curve} ${to.y}, ${to.x} ${to.y}`;
        const isRouteLink = routeSet.has(link.source) && routeSet.has(link.target);
        return `<path class="network-link" d="${path}" stroke="${isRouteLink ? 'rgba(0, 210, 255, 0.8)' : 'rgba(255,255,255,0.18)'}" stroke-width="${isRouteLink ? 2.4 : 1.5}" />`;
    }).join('');

    const mainTopicMarkup = visibleNodes.map((node) => {
        const position = nodePositions[node.id] || { x: 50, y: 50 };
        const isSelected = node.isSelected || (route.length > 0 && route[0] === node.id);
        const isActive = selectedModule === node.id || isSelected;
        const isLocked = node.isLocked;
        const isDone = node.isDone;
        const background = isSelected ? getFamilyColor(node.id) : node.color;

        return `
            <div class="concept-node main ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isLocked ? 'locked' : ''}"
                style="left:${position.x}%; top:${position.y}%; background:${background};"
                data-topic="${node.id}"
                onclick="${isLocked ? 'alert(\'This course is locked until you complete its prerequisite course(s).\')' : `selectRouteTopic('${node.id}')` }"
                title="${node.id}">
                <div class="node-lock">${isLocked ? '🔒' : (isDone ? '✅' : '')}</div>
                <div class="node-number">${visibleNodes.findIndex(item => item.id === node.id) + 1}</div>
                <div class="node-title">${node.id}</div>
            </div>
        `;
    }).join('');

    const childTopicMarkup = visibleNodes.flatMap((node) => {
        return node.subTopics.map((subtopic, idx) => {
            const key = `${node.id} • ${subtopic}`;
            const position = nodePositions[key] || { x: 50, y: 50 };
            const isLocked = isTopicLocked(node.id);
            const isDone = completedTopics.includes(node.id);
            const isSelected = selectedModule === node.id;
            return `
                <div class="concept-node ${isSelected ? 'active' : ''} ${isDone ? 'done' : ''} ${isLocked ? 'locked' : ''}"
                    style="left:${Math.min(90, Math.max(10, position.x))}%; top:${Math.min(88, Math.max(12, position.y))}%; background:${getFamilyColor(node.id)}; min-width:90px; max-width:120px;"
                    data-topic="${node.id}"
                    onclick="${isLocked ? 'alert(\'This course is locked until you complete its prerequisite course(s).\')' : `selectRouteTopic('${node.id}')` }"
                    title="${subtopic}">
                    <div class="node-lock">${isLocked ? '🔒' : (isDone ? '✅' : '')}</div>
                    <div class="node-number">${idx + 1}</div>
                    <div class="node-title">${subtopic}</div>
                </div>
            `;
        });
    }).join('');

    conceptMap.innerHTML = `
        <svg class="network-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${linkMarkup}
        </svg>
        <div class="graph-nodes">${mainTopicMarkup}${childTopicMarkup}</div>
    `;

    const summary = document.getElementById('path-summary');
    summary.innerHTML = `<strong>${selectedMode === 'linear' ? 'Linear' : 'Dynamic'} path:</strong> ${route.join(' → ')}<br><span style="color: var(--text-secondary);">Use the network map to explore the subject clusters and zoom into the syllabus.</span>`;

    const mapLink = document.getElementById('open-map-link');
    if (mapLink) {
        mapLink.href = `concept-map.html?target=${encodeURIComponent(selectedModule || targetTopic)}`;
    }
}

function selectRouteTopic(topicId) {
    selectedModule = topicId;
    renderPath();
    renderModule(topicId);
}

function buildModuleContent(topicId) {
    const meta = graphData.nodes.find(n => n.id === topicId) || { details: 'Study this topic thoroughly.' };
    const details = meta.details || 'Use the concept notes and practice examples to revise this topic.';
    const name = topicId;

    const materials = [
        `Read the concept summary for ${name}.`,
        `Review the main formulae, definitions, and worked examples in ${name}.`,
        `Practice at least 5 examples and write your own short notes.`,
        `Connect ${name} to the previous topic and next related topic in the syllabus.`
    ];

    const genericQuiz = [
        {
            question: `What is the main idea being tested in ${name}?`,
            options: ['The key concept and its method of use', 'Only the title of the topic', 'Random number practice', 'A topic unrelated to math'],
            answer: 'The key concept and its method of use'
        },
        {
            question: `Which activity best helps you learn ${name}?`,
            options: ['Solving worked examples and revising key rules', 'Skipping the topic', 'Memorising without practice', 'Avoiding all exercises'],
            answer: 'Solving worked examples and revising key rules'
        },
        {
            question: `Which statement is correct about a study plan?`,
            options: ['You should revise concepts, do practice, then revisit difficult steps', 'You only read once', 'You never check examples', 'You avoid repetition'],
            answer: 'You should revise concepts, do practice, then revisit difficult steps'
        }
    ];

    return { title: name, details, materials, quiz: genericQuiz };
}

function renderModule(topicId) {
    selectedModule = topicId;
    const content = buildModuleContent(topicId);
    const container = document.getElementById('module-content');
    const locked = isTopicLocked(topicId);

    if (locked) {
        container.innerHTML = `
            <div class="content-box" style="background: rgba(255, 71, 87, 0.08); border-color: rgba(255, 71, 87, 0.4);">
                <h3 style="margin-bottom: 0.8rem;">${content.title}</h3>
                <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">This course is locked until you complete the prerequisite course(s).</p>
                <p style="color: var(--text-secondary);">Required first: ${getPrerequisiteMap().get(topicId)?.join(', ') || 'None'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <h3 style="margin-bottom: 0.8rem;">${content.title}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.2rem;">${content.details}</p>

        <div class="content-box" style="margin-bottom: 1rem; background: rgba(0,210,255,0.04);">
            <h4 style="margin-bottom: 0.75rem;">Study materials</h4>
            <ul style="padding-left: 1.2rem; color: var(--text-primary); display:flex; flex-direction:column; gap:0.5rem;">
                ${content.materials.map(item => `<li>${item}</li>`).join('')}
            </ul>
        </div>

        <div class="content-box" style="background: rgba(255,255,255,0.02);">
            <h4 style="margin-bottom: 0.8rem;">Quick quiz</h4>
            ${content.quiz.map((q, idx) => `
                <div style="margin-bottom: 1rem;">
                    <p style="margin-bottom: 0.5rem; font-weight: 600;">${idx + 1}. ${q.question}</p>
                    ${q.options.map(option => `
                        <label class="quiz-option" data-answer="${option}" data-correct="${q.answer}" onclick="checkAnswer(this)">
                            ${option}
                        </label>
                    `).join('')}
                </div>
            `).join('')}
        </div>

        <button class="primary-btn" style="width:auto; padding: 10px 18px; margin-top: 1rem;" onclick="markCurrentTopicComplete()">Mark this topic complete</button>
    `;
}

function checkAnswer(element) {
    const chosen = element.dataset.answer;
    const correct = element.dataset.correct;
    element.parentElement.querySelectorAll('.quiz-option').forEach(option => {
        option.classList.remove('correct', 'wrong');
        if (option.dataset.answer === correct) option.classList.add('correct');
        if (option.dataset.answer === chosen && chosen !== correct) option.classList.add('wrong');
    });
}

async function markCurrentTopicComplete() {
    try {
        const res = await fetch(`${API_BASE}/me/progress`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic_id: selectedModule || targetTopic })
        });

        if (res.ok) {
            const currentTopic = selectedModule || targetTopic;
            if (!completedTopics.includes(currentTopic)) completedTopics.push(currentTopic);
            renderPath();
            renderModule(currentTopic);
        }
    } catch (e) {
        console.error(e);
    }
}
