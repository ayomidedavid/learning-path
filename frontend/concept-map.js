const API_BASE = 'http://localhost:8000';
let token = localStorage.getItem('token');
let graphData = null;
let completedTopics = [];
let selectedTopic = new URLSearchParams(window.location.search).get('target') || 'Sets';

if (!token) window.location.href = 'index.html';

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('learningMode');
    window.location.href = 'index.html';
}

function getTopicFamily(topicId) {
    const lowered = String(topicId).toLowerCase();
    if (lowered.includes('number') || lowered.includes('set') || lowered.includes('logic') || lowered.includes('indices') || lowered.includes('logarithm')) return 'Foundational';
    if (lowered.includes('algebra') || lowered.includes('equation') || lowered.includes('inequal') || lowered.includes('matrix') || lowered.includes('series') || lowered.includes('variation')) return 'Algebra';
    if (lowered.includes('geometry') || lowered.includes('trigon') || lowered.includes('bearing') || lowered.includes('coordinate') || lowered.includes('circle') || lowered.includes('vector')) return 'Geometry';
    if (lowered.includes('calculus') || lowered.includes('differential') || lowered.includes('integration')) return 'Calculus';
    if (lowered.includes('stat') || lowered.includes('probab') || lowered.includes('measure') || lowered.includes('dispersion')) return 'Statistics';
    return 'Applied';
}

function getFamilyColor(topicId) {
    const family = getTopicFamily(topicId);
    const palette = {
        Foundational: 'linear-gradient(135deg, rgba(255, 196, 87, 0.35), rgba(255, 153, 51, 0.18))',
        Algebra: 'linear-gradient(135deg, rgba(126, 211, 255, 0.35), rgba(58, 123, 213, 0.18))',
        Geometry: 'linear-gradient(135deg, rgba(110, 231, 183, 0.30), rgba(36, 191, 129, 0.18))',
        Calculus: 'linear-gradient(135deg, rgba(195, 132, 255, 0.30), rgba(149, 76, 233, 0.18))',
        Statistics: 'linear-gradient(135deg, rgba(253, 164, 175, 0.30), rgba(244, 114, 182, 0.18))',
        Applied: 'linear-gradient(135deg, rgba(96, 165, 250, 0.30), rgba(16, 185, 129, 0.16))'
    };
    return palette[family] || palette.Applied;
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
    return prereqs.length > 0 && prereqs.some((pr) => !completedTopics.includes(pr));
}

async function fetchProgress() {
    try {
        const res = await fetch(`${API_BASE}/me/progress`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load progress');
        const data = await res.json();
        completedTopics = data.completed || [];
    } catch (err) {
        console.error(err);
        logout();
    }
}

async function fetchGraph() {
    try {
        const res = await fetch(`${API_BASE}/graph`);
        graphData = await res.json();
    } catch (err) {
        console.error(err);
    }
}

function renderTopicInfo(topicId) {
    const node = graphData.nodes.find((n) => n.id === topicId) || { details: 'Topic details are not yet attached.' };
    const prereqs = getPrerequisiteMap().get(topicId) || [];
    const locked = isTopicLocked(topicId);
    const title = document.getElementById('map-topic-title');
    const details = document.getElementById('map-topic-details');

    title.textContent = topicId;
    details.innerHTML = `
        <strong style="color: var(--text-primary); display:block; margin-bottom:0.6rem;">${locked ? 'Locked until prerequisites are done' : 'Available for study'}</strong>
        ${node.details || 'This topic is part of the learning network and connects to related concepts.'}
        <br><br>
        <span style="color: var(--text-secondary);">Prerequisites: ${prereqs.length ? prereqs.join(', ') : 'None'}</span>
    `;
}

function extractSubtopics(details) {
    const raw = String(details || '')
        .replace(/\s*[-–—]\s*/g, ', ')
        .replace(/\s+and\s+/gi, ', ')
        .split(/[;,|]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/\s*\([^)]*\)/g, '').trim())
        .filter(Boolean);

    if (raw.length) return raw.slice(0, 5);
    return ['Core ideas', 'Worked examples', 'Practice', 'Review'];
}

function buildDisplayGraph() {
    if (!graphData || !graphData.nodes) return { nodes: [], links: [] };

    const familyCenters = {
        Foundational: { x: 18, y: 24 },
        Algebra: { x: 42, y: 22 },
        Geometry: { x: 71, y: 32 },
        Calculus: { x: 74, y: 70 },
        Statistics: { x: 52, y: 74 },
        Applied: { x: 27, y: 70 }
    };

    const nodes = [];
    const links = [];
    const familyOrder = ['Foundational', 'Algebra', 'Geometry', 'Calculus', 'Statistics', 'Applied'];

    const mainTopics = graphData.nodes.map((node) => ({
        id: node.id,
        family: getTopicFamily(node.id),
        details: node.details || '',
        color: getFamilyColor(node.id),
        kind: 'hub'
    }));

    mainTopics.forEach((topic) => {
        nodes.push(topic);
        const subtopics = extractSubtopics(topic.details);
        subtopics.forEach((label, idx) => {
            const subId = `${topic.id} • ${label}`;
            nodes.push({
                id: subId,
                family: topic.family,
                parent: topic.id,
                color: topic.color,
                kind: 'subtopic'
            });
            links.push({ source: topic.id, target: subId, type: 'subtopic' });
        });
    });

    graphData.links.forEach((link) => {
        links.push({ source: link.source, target: link.target, type: 'dependency' });
    });

    const positions = new Map();

    familyOrder.forEach((family) => {
        const hubs = mainTopics.filter((node) => node.family === family);
        const center = familyCenters[family] || { x: 50, y: 50 };
        hubs.forEach((hub, hubIndex) => {
            const familyCount = Math.max(1, hubs.length);
            const angle = (Math.PI * 2 * hubIndex) / familyCount;
            const radius = family === 'Geometry' ? 11 : family === 'Calculus' ? 15 : 12;
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            positions.set(hub.id, { x, y, isHub: true });

            const subnodes = nodes.filter((node) => node.parent === hub.id);
            subnodes.forEach((subnode, subIndex) => {
                const subAngle = (Math.PI * 2 * subIndex) / Math.max(1, subnodes.length);
                const subRadius = 18 + (subIndex % 3) * 8;
                positions.set(subnode.id, {
                    x: x + Math.cos(subAngle) * subRadius,
                    y: y + Math.sin(subAngle) * subRadius + 9,
                    isHub: false
                });
            });
        });
    });

    return { nodes, links, positions };
}

function renderNetwork() {
    if (!graphData || !graphData.nodes || !graphData.links) return;

    const display = buildDisplayGraph();
    const { nodes, links, positions } = display;

    const linkMarkup = links
        .map((link) => {
            const from = positions.get(link.source);
            const to = positions.get(link.target);
            if (!from || !to) return '';
            const curve = Math.abs(to.x - from.x) * 0.42 + 8;
            const path = `M ${from.x} ${from.y} C ${from.x + curve} ${from.y}, ${to.x - curve} ${to.y}, ${to.x} ${to.y}`;
            const isActive = link.source === selectedTopic || link.target === selectedTopic || (typeof link.source === 'string' && link.source.startsWith(selectedTopic));
            return `<path class="network-link ${isActive ? 'route' : ''}" d="${path}" />`;
        })
        .join('');

    const nodeMarkup = nodes
        .map((node) => {
            const pos = positions.get(node.id) || { x: 50, y: 50, isHub: false };
            const isHub = node.kind === 'hub';
            const selected = node.id === selectedTopic || (node.parent && node.parent === selectedTopic);
            const done = completedTopics.includes(node.id) || (node.parent && completedTopics.includes(node.parent));
            const locked = isTopicLocked(node.id) || (node.parent ? isTopicLocked(node.parent) : false);
            const size = isHub ? '160px' : '110px';
            const fontSize = isHub ? '0.82rem' : '0.72rem';
            const label = isHub ? node.id : node.id.split(' • ').slice(1).join(' • ');

            return `
                <button
                    class="network-node ${selected ? 'selected' : ''} ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${isHub ? 'hub' : ''}"
                    style="left:${pos.x}%; top:${pos.y}%; width:${size}; background:${node.color}; font-size:${fontSize};"
                    data-topic="${node.id}"
                    data-parent="${node.parent || ''}"
                    onclick="selectTopic('${node.id}')"
                    title="${node.id}"
                >
                    <div class="node-badge">${locked ? '🔒' : done ? '✓' : ''}</div>
                    <div class="node-label">${label}</div>
                </button>
            `;
        })
        .join('');

    document.getElementById('network-map').innerHTML = `
        <svg class="network-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${linkMarkup}
        </svg>
        <div class="network-layer">${nodeMarkup}</div>
    `;

    renderTopicInfo(selectedTopic);
}

function selectTopic(topicId) {
    const normalized = String(topicId).includes(' • ') ? String(topicId).split(' • ')[0] : topicId;
    selectedTopic = normalized;
    renderNetwork();
}

function setupZoom() {
    const slider = document.getElementById('zoom-slider');
    const zoomValue = document.getElementById('zoom-value');
    const stage = document.getElementById('network-stage');

    slider.addEventListener('input', () => {
        const value = Number(slider.value);
        const scale = value / 100;
        stage.style.transform = `scale(${scale})`;
        zoomValue.textContent = `${value}%`;
    });
}

async function init() {
    await fetchProgress();
    await fetchGraph();
    setupZoom();
    renderNetwork();

    const backLink = document.getElementById('back-link');
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target');
    if (target) backLink.href = `path.html?target=${encodeURIComponent(target)}`;
}

document.addEventListener('DOMContentLoaded', init);
