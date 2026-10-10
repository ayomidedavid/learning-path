const API_BASE = window.location.origin;
const token = localStorage.getItem('token');

let graphData = null;
let completedTopics = [];
let selectedTopic = new URLSearchParams(window.location.search).get('target')
    || 'Module 1: Foundational Numbers';
let simulation = null;
let zoomBehavior = null;
let graphGroup = null;
let linkElements = null;
let nodeElements = null;

const TOPIC_FAMILY_COLORS = {
    foundational: '#6366f1',
    algebra: '#3b82f6',
    geometry: '#10b981',
    calculus: '#8b5cf6',
    statistics: '#ec4899',
    applied: '#f59e0b'
};

if (!token) window.location.href = 'index.html';

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('learningMode');
    window.location.href = 'index.html';
}

function getTopicFamily(topicId) {
    const lowered = String(topicId).toLowerCase();
    if (lowered.includes('number') || lowered.includes('set') || lowered.includes('logic')
        || lowered.includes('indices') || lowered.includes('logarithm')) return 'foundational';
    if (lowered.includes('algebra') || lowered.includes('equation') || lowered.includes('inequal')
        || lowered.includes('matrix') || lowered.includes('series') || lowered.includes('variation')) return 'algebra';
    if (lowered.includes('geometry') || lowered.includes('trigon') || lowered.includes('bearing')
        || lowered.includes('coordinate') || lowered.includes('circle') || lowered.includes('vector')) return 'geometry';
    if (lowered.includes('calculus') || lowered.includes('differential') || lowered.includes('integration')) return 'calculus';
    if (lowered.includes('stat') || lowered.includes('probab') || lowered.includes('measure')
        || lowered.includes('dispersion')) return 'statistics';
    return 'applied';
}

function getTopicFamilyColor(topicId) {
    return TOPIC_FAMILY_COLORS[getTopicFamily(topicId)];
}

function isPriorityLink(link) {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return sourceId === selectedTopic || targetId === selectedTopic;
}

function getPrerequisiteMap() {
    const prerequisites = new Map();
    for (const link of graphData.links) {
        if (!prerequisites.has(link.target)) prerequisites.set(link.target, []);
        prerequisites.get(link.target).push(link.source);
    }
    return prerequisites;
}

function isTopicLocked(topicId) {
    const prerequisites = getPrerequisiteMap().get(topicId) || [];
    return prerequisites.some((prerequisite) => !completedTopics.includes(prerequisite));
}

async function fetchProgress() {
    const response = await fetch(`${API_BASE}/me/progress`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401) {
        logout();
        return;
    }
    if (!response.ok) throw new Error('Unable to load your learning progress.');

    const data = await response.json();
    completedTopics = data.completed || [];
}

async function fetchGraph() {
    const response = await fetch(`${API_BASE}/graph`);
    if (!response.ok) throw new Error('Unable to load the curriculum graph.');

    const data = await response.json();
    if (!Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        throw new Error('The curriculum graph response is not in the expected format.');
    }
    graphData = data;
}

function setGraphStatus(message, visible = true) {
    const status = document.getElementById('graph-status');
    status.textContent = message;
    status.hidden = !visible;
}

function renderTopicInfo(topicId) {
    const node = graphData.nodes.find((item) => item.id === topicId);
    if (!node) return;

    const prerequisites = getPrerequisiteMap().get(topicId) || [];
    const locked = isTopicLocked(topicId);
    const completed = completedTopics.includes(topicId);

    document.getElementById('map-topic-title').textContent = topicId;
    document.getElementById('map-topic-status').textContent = completed
        ? 'Completed'
        : locked ? 'Locked until prerequisites are completed' : 'Available for study';
    document.getElementById('map-topic-details').textContent =
        node.details || 'No topic description is available yet.';
    document.getElementById('map-topic-prerequisites').textContent =
        `Prerequisites: ${prerequisites.length ? prerequisites.join(', ') : 'None'}`;
}

function updateSelection() {
    if (nodeElements) {
        nodeElements
            .classed('selected', (node) => node.id === selectedTopic)
            .attr('aria-pressed', (node) => node.id === selectedTopic ? 'true' : 'false');
    }

    if (linkElements) {
        linkElements
            .classed('route', isPriorityLink)
            .style('opacity', (link) => isPriorityLink(link) ? 1 : 0.45)
            .style('filter', (link) => isPriorityLink(link)
                ? `drop-shadow(0 0 5px ${getTopicFamilyColor(link.target.id)})`
                : null)
            .attr('marker-end', (link) => {
                const priority = isPriorityLink(link) ? 'priority' : 'standard';
                const family = getTopicFamily(link.target.id);
                return `url(#prerequisite-arrow-${family}-${priority})`;
            });
    }

    renderTopicInfo(selectedTopic);
}

function createNodeCard(node) {
    const button = document.createElement('button');
    const status = document.createElement('span');
    const title = document.createElement('span');
    const description = document.createElement('span');
    const completed = completedTopics.includes(node.id);
    const locked = isTopicLocked(node.id);

    button.type = 'button';
    button.className = `network-node family-${getTopicFamily(node.id)}${completed ? ' done' : ''}${locked ? ' locked' : ''}`;
    button.setAttribute('aria-label', `${node.id}${locked ? ', locked' : completed ? ', completed' : ', available'}`);
    button.setAttribute('aria-pressed', 'false');
    button.title = node.id;

    status.className = 'node-status';
    status.textContent = completed ? 'Completed' : locked ? 'Locked' : (node.grade_level || 'Available');
    title.className = 'node-title';
    title.textContent = node.id;
    description.className = 'node-description';
    description.textContent = node.details || 'Topic details are not yet attached.';

    button.append(status, title, description);
    button.addEventListener('click', () => {
        selectedTopic = node.id;
        updateSelection();
    });
    return button;
}

function renderNetwork() {
    if (!graphData || !graphData.nodes.length) {
        setGraphStatus('No curriculum topics are available to display.');
        return;
    }

    const stage = document.getElementById('network-stage');
    const svg = d3.select('#network-svg');
    const nodeLayer = d3.select('#html-nodes-container');
    const width = stage.clientWidth;
    const height = stage.clientHeight;

    if (!width || !height) return;
    if (simulation) simulation.stop();

    svg.selectAll('*').remove();
    nodeLayer.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    graphGroup = svg.append('g').attr('class', 'network-graph');
    const arrowDefinitions = graphGroup.append('defs');
    Object.entries(TOPIC_FAMILY_COLORS).forEach(([family, color]) => {
        ['standard', 'priority'].forEach((priority) => {
            const marker = arrowDefinitions.append('marker')
                .attr('id', `prerequisite-arrow-${family}-${priority}`)
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 8)
                .attr('refY', 0)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto');

            marker.append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', color)
                .attr('opacity', priority === 'priority' ? 1 : 0.55)
                .style('filter', priority === 'priority' ? `drop-shadow(0 0 3px ${color})` : null);
        });
    });

    const nodes = graphData.nodes.map((node, index) => {
        const angle = (index / graphData.nodes.length) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.28;
        return {
            ...node,
            x: width / 2 + Math.cos(angle) * radius,
            y: height / 2 + Math.sin(angle) * radius
        };
    });
    const nodeIds = new Set(nodes.map((node) => node.id));
    const links = graphData.links
        .filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target))
        .map((link) => ({ ...link }));

    linkElements = graphGroup.append('g')
        .attr('class', 'network-links')
        .selectAll('path')
        .data(links)
        .join('path')
        .attr('class', 'network-link')
        .style('stroke', (link) => getTopicFamilyColor(link.target))
        .style('opacity', (link) => isPriorityLink(link) ? 1 : 0.45)
        .style('filter', (link) => isPriorityLink(link)
            ? `drop-shadow(0 0 5px ${getTopicFamilyColor(link.target)})`
            : null)
        .attr('marker-end', (link) => {
            const priority = isPriorityLink(link) ? 'priority' : 'standard';
            return `url(#prerequisite-arrow-${getTopicFamily(link.target)}-${priority})`;
        });

    const cardById = new Map();
    nodeElements = nodeLayer.selectAll('button')
        .data(nodes, (node) => node.id)
        .join((enter) => enter.append((node) => {
            const card = createNodeCard(node);
            cardById.set(node.id, card);
            return card;
        }))
        .attr('class', (node) => {
            const card = cardById.get(node.id);
            return card ? card.className : 'network-node';
        });

    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id((node) => node.id).distance(250).strength(0.65))
        .force('charge', d3.forceManyBody().strength(-850))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide(142))
        .on('tick', () => {
            linkElements.attr('d', (link) => {
                const dx = link.target.x - link.source.x;
                const dy = link.target.y - link.source.y;
                const sourceCard = cardById.get(link.source.id);
                const targetCard = cardById.get(link.target.id);
                const sourceScale = Math.min(
                    (sourceCard.offsetWidth / 2) / Math.max(1, Math.abs(dx)),
                    (sourceCard.offsetHeight / 2) / Math.max(1, Math.abs(dy))
                );
                const targetScale = Math.min(
                    (targetCard.offsetWidth / 2) / Math.max(1, Math.abs(dx)),
                    (targetCard.offsetHeight / 2) / Math.max(1, Math.abs(dy))
                );
                const startX = link.source.x + dx * sourceScale;
                const startY = link.source.y + dy * sourceScale;
                const endX = link.target.x - dx * targetScale;
                const endY = link.target.y - dy * targetScale;
                return `M${startX},${startY} L${endX},${endY}`;
            });

            nodeElements
                .style('left', (node) => `${node.x}px`)
                .style('top', (node) => `${node.y}px`);
        });

    nodeElements.call(d3.drag()
        .on('start', (event, node) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            node.fx = node.x;
            node.fy = node.y;
        })
        .on('drag', (event, node) => {
            node.fx = event.x;
            node.fy = event.y;
        })
        .on('end', (event, node) => {
            if (!event.active) simulation.alphaTarget(0);
            node.fx = null;
            node.fy = null;
        }));

    zoomBehavior = d3.zoom()
        .scaleExtent([0.6, 1.8])
        .on('zoom', (event) => {
            graphGroup.attr('transform', event.transform);
            nodeLayer.style('transform', `translate(${event.transform.x}px, ${event.transform.y}px) scale(${event.transform.k})`);
            const percent = Math.round(event.transform.k * 100);
            document.getElementById('zoom-slider').value = percent;
            document.getElementById('zoom-value').textContent = `${percent}%`;
        });
    svg.call(zoomBehavior);

    const slider = document.getElementById('zoom-slider');
    slider.addEventListener('input', () => {
        const scale = Number(slider.value) / 100;
        const transform = d3.zoomIdentity
            .translate(width * (1 - scale) / 2, height * (1 - scale) / 2)
            .scale(scale);
        svg.transition().duration(120).call(zoomBehavior.transform, transform);
    }, { once: true });

    setGraphStatus(`${nodes.length} topics · ${links.length} prerequisite connections`, false);
    if (!nodes.some((node) => node.id === selectedTopic)) selectedTopic = nodes[0].id;
    updateSelection();
}

async function init() {
    if (!token) return;

    try {
        await fetchProgress();
        if (!localStorage.getItem('token')) return;
        await fetchGraph();

        const backLink = document.getElementById('back-link');
        const target = new URLSearchParams(window.location.search).get('target');
        if (target) backLink.href = `path.html?target=${encodeURIComponent(target)}`;

        renderNetwork();
        const resizeObserver = new ResizeObserver(() => renderNetwork());
        resizeObserver.observe(document.getElementById('network-stage'));
    } catch (error) {
        console.error('Unable to display the curriculum graph:', error);
        setGraphStatus(error.message);
    }
}

document.addEventListener('DOMContentLoaded', init);
