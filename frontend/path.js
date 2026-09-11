const API_BASE = 'http://localhost:8000';
let token = localStorage.getItem('token');
let completedTopics = [];
let graphData = null;
let selectedMode = localStorage.getItem('learningMode') || 'linear';
let selectedModule = null;
let simulation = null;

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
    renderNetworkGraph();
    renderModuleContent(targetTopic);
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
        console.error('Error loading graph:', e);
        graphData = { nodes: [], links: [] };
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
    linearBtn.onclick = () => { setMode('linear'); renderNetworkGraph(); };
    dynamicBtn.onclick = () => { setMode('dynamic'); renderNetworkGraph(); };
}

function getNodeDifficulty(nodeId) {
    const lower = nodeId.toLowerCase();
    if (lower.includes('differential') || lower.includes('integration') || lower.includes('matrices')) return 'SS3';
    if (lower.includes('probability') || lower.includes('sequence') || lower.includes('trigonometry') || lower.includes('approximation')) return 'SS2';
    return 'SS1';
}

function getNodeColor(nodeId) {
    const difficulty = getNodeDifficulty(nodeId);
    if (difficulty === 'SS3') return 'rgba(250, 128, 114, 0.8)'; // Salmon/Red
    if (difficulty === 'SS2') return 'rgba(144, 238, 144, 0.8)'; // Light Green
    return 'rgba(173, 216, 230, 0.8)'; // Light Blue
}

function getPrerequisiteMap() {
    const map = new Map();
    if (!graphData || !graphData.links) return map;
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
    if (!graphData || !graphData.nodes) return [targetTopic];

    const childrenMap = new Map();
    for (const link of graphData.links) {
        if (!childrenMap.has(link.source)) childrenMap.set(link.source, []);
        childrenMap.get(link.source).push(link.target);
    }

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

    return result.length === 0 ? [targetTopic] : result;
}

function renderNetworkGraph() {
    if (!graphData || !graphData.nodes) return;

    const route = generateRoute();
    const routeSet = new Set(route);

    const svgContainer = document.getElementById('network-svg');
    svgContainer.innerHTML = '';

    const containerRect = svgContainer.parentElement.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    // Prepare nodes and links
    const nodes = graphData.nodes.map(node => ({
        id: node.id,
        label: node.id,
        inRoute: routeSet.has(node.id),
        completed: completedTopics.includes(node.id),
        locked: isTopicLocked(node.id),
        difficulty: getNodeDifficulty(node.id)
    }));

    const links = graphData.links
        .filter(link => nodes.some(n => n.id === link.source) && nodes.some(n => n.id === link.target))
        .map(link => ({
            source: link.source,
            target: link.target,
            inRoute: routeSet.has(link.source) && routeSet.has(link.target)
        }));

    // Create SVG
    const svg = d3.select('#network-svg')
        .attr('viewBox', [0, 0, width, height])
        .attr('width', width)
        .attr('height', height);

    // Create simulation
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(35));

    // Add links
    const linkElements = svg.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', d => `link ${d.inRoute ? 'active' : ''}`)
        .attr('stroke-width', d => d.inRoute ? 3 : 2);

    // Add nodes
    const nodeElements = svg.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', d => `node ${d.inRoute ? 'active' : ''} ${d.completed ? 'completed' : ''} ${d.locked ? 'locked' : ''}`)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // Draw circles
    nodeElements.append('circle')
        .attr('r', 24)
        .attr('fill', d => getNodeColor(d.id))
        .attr('stroke', d => {
            if (d.inRoute) return 'rgba(0, 210, 255, 0.9)';
            if (d.completed) return 'rgba(46, 213, 115, 0.9)';
            return 'rgba(255,255,255,0.3)';
        })
        .on('click', function(event, d) {
            if (d.locked) {
                alert('This course is locked until you complete its prerequisite course(s).');
                return;
            }
            selectedModule = d.id;
            renderModuleContent(d.id);
        });

    // Add labels
    nodeElements.append('text')
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .attr('fill', 'white')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('pointer-events', 'none')
        .text(d => {
            const words = d.label.split(' ');
            if (words.length > 2) {
                return words.slice(0, 2).join('\n');
            }
            return d.label;
        })
        .attr('dy', (d, i) => {
            const text = d.label;
            const words = text.split(' ');
            return words.length > 2 ? '-0.5em' : '0em';
        });

    // Simulation update
    simulation.on('tick', () => {
        linkElements
            .attr('x1', d => nodes.find(n => n.id === d.source).x)
            .attr('y1', d => nodes.find(n => n.id === d.source).y)
            .attr('x2', d => nodes.find(n => n.id === d.target).x)
            .attr('y2', d => nodes.find(n => n.id === d.target).y);

        nodeElements
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Update path summary
    const summary = document.getElementById('path-summary');
    summary.innerHTML = `
        <strong>${selectedMode === 'linear' ? 'Linear' : 'Dynamic'} Path:</strong> ${route.length} topics • 
        <span style="color: var(--text-secondary);">Click nodes to view details. Color indicates difficulty level.</span>
    `;

    // Update map link
    const mapLink = document.getElementById('open-map-link');
    if (mapLink) {
        mapLink.href = `concept-map.html?target=${encodeURIComponent(selectedModule || targetTopic)}`;
    }
}

function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

function renderModuleContent(topicId) {
    const moduleContent = document.getElementById('module-content');
    const locked = isTopicLocked(topicId);
    const completed = completedTopics.includes(topicId);

    moduleContent.innerHTML = `
        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <h4 style="margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
                ${topicId}
                ${locked ? '🔒 Locked' : (completed ? '✅ Completed' : '⏳ In Progress')}
            </h4>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
                Difficulty: <strong>${getNodeDifficulty(topicId)}</strong>
            </p>
            ${locked ? `
                <p style="color: rgba(255, 71, 87, 0.8); font-size: 0.9rem;">
                    ⚠️ Complete prerequisite courses to unlock this topic.
                </p>
            ` : `
                <button class="primary-btn" style="width: auto; padding: 8px 16px; margin-top: 1rem;">
                    ${completed ? 'Review' : 'Start Learning'}
                </button>
            `}
        </div>
    `;
}
