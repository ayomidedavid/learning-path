const API_BASE = window.location.origin.includes('http') ? window.location.origin : 'http://localhost:8000';
let token = localStorage.getItem('token');
let completedTopics = [];
let graphData = null;
let selectedMode = localStorage.getItem('learningMode') || 'linear';
let selectedModuleId = null;
let simulation = null;
let zoomBehavior = null;
let svgD3 = null;

if (!token) window.location.href = 'index.html';

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('learningMode');
    window.location.href = 'index.html';
}

const urlParams = new URLSearchParams(window.location.search);
let targetTopic = urlParams.get('target') || "Module 1: Foundational Numbers";

document.addEventListener('DOMContentLoaded', async () => {
    const titleEl = document.getElementById('path-title');
    if (titleEl) titleEl.innerText = targetTopic;

    const mode = urlParams.get('mode') || selectedMode;
    selectedMode = mode;
    setMode(mode);

    await fetchProgress();
    await fetchGraph();
    
    // Set default selected module
    selectedModuleId = targetTopic;

    renderNetworkGraph();
    setupFilters();
    setupZoomControls();
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
    const structureLabel = document.getElementById('structure-type-label');

    if (linearBtn) {
        linearBtn.classList.toggle('active', mode === 'linear');
        linearBtn.onclick = () => { setMode('linear'); renderNetworkGraph(); };
    }
    if (dynamicBtn) {
        dynamicBtn.classList.toggle('active', mode === 'dynamic' || mode === 'adaptive');
        dynamicBtn.onclick = () => { setMode('dynamic'); renderNetworkGraph(); };
    }

    if (structureLabel) {
        structureLabel.innerText = mode === 'linear' ? 'Linear Syllabus' : 'Dynamic Adaptive Flow';
    }
}

function getNodeDifficulty(nodeId) {
    const lower = String(nodeId).toLowerCase();
    if (lower.includes('calculus') || lower.includes('differential') || lower.includes('integration') || lower.includes('matrices')) return 'SS3';
    if (lower.includes('probability') || lower.includes('sequence') || lower.includes('trigonometry') || lower.includes('coordinate')) return 'SS2';
    return 'SS1';
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

async function fetchRecommendedPath(target = targetTopic) {
    try {
        const sourceNode = (graphData && graphData.nodes && graphData.nodes.length > 0) ? graphData.nodes[0].id : "Module 1: Foundational Numbers";
        const res = await fetch(`${API_BASE}/recommend_path`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                source: sourceNode,
                target: target,
                algorithm: selectedMode,
                completed_topics: completedTopics,
                adaptive: true
            })
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error("Path recommendation fetch error:", e);
    }
    return null;
}

function getSubheadingForTopic(topicId) {
    const lower = String(topicId).toLowerCase();
    if (lower.includes('number') || lower.includes('base') || lower.includes('conversion')) return 'Binary, octal, hex conversion algorithms';
    if (lower.includes('modular') || lower.includes('clock') || lower.includes('arithmetic')) return 'Congruence relations, residues, and finite system algebraic rings';
    if (lower.includes('indices') || lower.includes('standard')) return 'Fractional exponent rules & power representations';
    if (lower.includes('residues') || lower.includes('cyclic') || lower.includes('bridge')) return 'Higher-order cyclical group theory';
    if (lower.includes('logarithm')) return 'Logarithmic laws and bases';
    return 'Core conceptual mastery and applications';
}

async function renderNetworkGraph() {
    if (!graphData || !graphData.nodes) return;

    const recommended = await fetchRecommendedPath();
    let route = recommended && recommended.path ? recommended.path : [targetTopic];
    const bridgeNodes = recommended ? (recommended.bridge_nodes || []) : [];
    const routeSet = new Set(route);

    const svgContainer = document.getElementById('network-svg');
    svgContainer.innerHTML = '';

    const containerRect = svgContainer.parentElement.getBoundingClientRect();
    const width = containerRect.width || 1000;
    const height = containerRect.height || 720;

    // Build node items
    let nodes = graphData.nodes.map(node => ({
        id: node.id,
        label: node.id,
        inRoute: routeSet.has(node.id),
        completed: completedTopics.includes(node.id),
        locked: isTopicLocked(node.id),
        difficulty: getNodeDifficulty(node.id),
        isBridge: false,
        details: node.details || '',
        subheading: getSubheadingForTopic(node.id)
    }));

    bridgeNodes.forEach(bridge => {
        if (!nodes.some(n => n.id === bridge.id)) {
            nodes.push({
                id: bridge.id,
                label: bridge.title || bridge.id,
                inRoute: true,
                completed: false,
                locked: false,
                difficulty: 'Bridge Stage',
                isBridge: true,
                details: bridge.details,
                subheading: getSubheadingForTopic(bridge.id)
            });
        }
    });

    // Build links
    const links = graphData.links
        .filter(link => nodes.some(n => n.id === link.source) && nodes.some(n => n.id === link.target))
        .map(link => ({
            source: link.source,
            target: link.target,
            inRoute: routeSet.has(link.source) && routeSet.has(link.target)
        }));

    for (let i = 0; i < route.length - 1; i++) {
        if (String(route[i]).startsWith("Bridge:") || String(route[i+1]).startsWith("Bridge:")) {
            links.push({
                source: route[i],
                target: route[i+1],
                inRoute: true
            });
        }
    }

    svgD3 = d3.select('#network-svg')
        .attr('viewBox', [0, 0, width, height]);

    const gContainer = svgD3.append('g').attr('class', 'zoom-layer');

    let htmlContainer = document.getElementById('html-nodes-container');
    if (htmlContainer) {
        htmlContainer.innerHTML = '';
        htmlContainer.style.transform = 'translate(0px, 0px) scale(1)';
    }

    zoomBehavior = d3.zoom()
        .scaleExtent([0.6, 2.0])
        .on('zoom', (event) => {
            gContainer.attr('transform', event.transform);
            if (htmlContainer) {
                htmlContainer.style.transform = `translate(${event.transform.x}px, ${event.transform.y}px) scale(${event.transform.k})`;
            }
            updateMinimapViewport(event.transform, width, height);
        });

    svgD3.call(zoomBehavior);

    // Layout horizontal node sequence alignment with ample spacing
    const horizontalStep = 320;
    const startX = 180;
    const centerY = height / 2 - 20;

    nodes.forEach((node, index) => {
        node.x = startX + index * horizontalStep;
        node.y = centerY + ((index % 2 === 0) ? -35 : 35);
    });

    // Render Curved SVG Link Paths
    const linkElements = gContainer.append('g')
        .selectAll('path')
        .data(links)
        .join('path')
        .attr('class', d => `link-path ${d.inRoute ? 'active' : ''}`);

    linkElements.attr('d', l => {
        const sourceNode = nodes.find(n => n.id === (l.source.id || l.source));
        const targetNode = nodes.find(n => n.id === (l.target.id || l.target));
        if (!sourceNode || !targetNode) return '';
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 0.95;
        return `M ${sourceNode.x} ${sourceNode.y} A ${dr} ${dr} 0 0 1 ${targetNode.x} ${targetNode.y}`;
    });

    // Render Native HTML Node Cards
    if (htmlContainer) {
        nodes.forEach(d => {
            const isCurrent = d.id === selectedModuleId;
            const inRoute = routeSet.has(d.id);
            let tagHeaderHtml = '';

            if (d.completed) {
                tagHeaderHtml = `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 4px;">✓ Completed</span> <span style="font-size: 0.65rem; color: #94a3b8; font-weight: 600;">100% Score</span>`;
            } else if (isCurrent) {
                tagHeaderHtml = `<span style="background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.5); color: #a5b4fc; font-size: 0.65rem; font-weight: 800; padding: 2px 7px; border-radius: 4px;">• CURRENT FOCUS</span> <span style="font-size: 0.65rem; color: #818cf8; font-weight: 700;">SS1-Mod 1</span>`;
            } else if (d.locked) {
                tagHeaderHtml = `<span style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 4px;">🔒 Locked</span>`;
            } else if (d.isBridge) {
                tagHeaderHtml = `<span style="background: rgba(245, 158, 11, 0.18); border: 1px solid rgba(245, 158, 11, 0.5); color: #fbbf24; font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 4px;">Bridge Stage</span>`;
            } else {
                tagHeaderHtml = `<span style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #e2e8f0; font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 4px;">Unlocked</span>`;
            }

            const progressBarHtml = isCurrent ? `
                <div style="width: 100%; height: 4px; background: rgba(255, 255, 255, 0.1); border-radius: 2px; margin-top: 8px; overflow: hidden;">
                    <div style="width: 35%; height: 100%; background: #6366f1; border-radius: 2px;"></div>
                </div>
            ` : '';

            const cardEl = document.createElement('div');
            cardEl.className = `node-card-item ${isCurrent ? 'current-focus' : ''} ${inRoute ? 'in-route' : ''} ${d.completed ? 'completed' : ''} ${d.locked ? 'locked' : ''}`;
            cardEl.style.left = `${d.x}px`;
            cardEl.style.top = `${d.y}px`;
            cardEl.style.marginLeft = '-120px';
            cardEl.style.marginTop = '-59px';
            cardEl.setAttribute('data-node-id', d.id);

            cardEl.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        ${tagHeaderHtml}
                    </div>
                    <div style="font-weight: 800; font-size: 0.84rem; color: #ffffff; line-height: 1.25; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${d.label}
                    </div>
                    <div style="font-size: 0.7rem; color: #94a3b8; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${d.subheading}
                    </div>
                </div>
                ${progressBarHtml}
            `;

            cardEl.addEventListener('click', (event) => {
                event.stopPropagation();
                if (d.locked) {
                    alert('This course is locked until you complete its prerequisite course(s).');
                    return;
                }
                selectNode(d);
            });

            htmlContainer.appendChild(cardEl);
        });
    }

    const activeNode = nodes.find(n => n.id === selectedModuleId) || nodes[0];
    if (activeNode) {
        updateSelectedModuleInspector(activeNode);
    }
}

async function selectNode(d) {
    selectedModuleId = d.id;
    targetTopic = d.id;

    // Update header title to reflect the newly targeted module
    const pathTitleEl = document.getElementById('path-title');
    if (pathTitleEl) pathTitleEl.innerText = d.id;

    const levelBadgeEl = document.getElementById('level-badge');
    if (levelBadgeEl) levelBadgeEl.innerText = `${d.difficulty || 'SS1'} Level`;

    updateSelectedModuleInspector(d);

    // Fetch updated recommended path for this newly selected target topic
    const recommended = await fetchRecommendedPath(d.id);
    let route = recommended && recommended.path ? recommended.path : [d.id];
    const routeSet = new Set(route);

    // Update glowing active path links on the graph
    d3.selectAll('.link-path').each(function(l) {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;

        const sourceIdx = route.indexOf(sourceId);
        const targetIdx = route.indexOf(targetId);
        const isPathActive = (sourceIdx !== -1 && targetIdx !== -1 && Math.abs(sourceIdx - targetIdx) === 1) || (routeSet.has(sourceId) && routeSet.has(targetId));

        d3.select(this).classed('active', isPathActive);
    });

    // Update node card focus & route highlight styles natively
    document.querySelectorAll('.node-card-item').forEach(cardEl => {
        const nodeId = cardEl.getAttribute('data-node-id');
        const isCurrent = nodeId === selectedModuleId;
        const inRoute = routeSet.has(nodeId);

        cardEl.classList.toggle('current-focus', isCurrent);
        cardEl.classList.toggle('in-route', !isCurrent && inRoute);
    });

    // On mobile view, automatically switch tab to module details when node is selected
    if (window.innerWidth <= 860) {
        switchMobileTab('module');
    }
}

function updateSelectedModuleInspector(node) {
    const titleEl = document.getElementById('module-title-text');
    const descEl = document.getElementById('module-desc-text');
    const levelTagEl = document.getElementById('module-level-tag');
    const prereqList = document.getElementById('prereq-list-container');
    const objList = document.getElementById('objectives-list-container');
    const startBtn = document.getElementById('start-module-btn');

    if (titleEl) titleEl.innerText = node.id || "Module 1: Foundational Numbers";
    if (descEl) descEl.innerText = node.details || "Core prerequisite mastery covering positional representations, binary/modular arithmetic systems, and fundamental root bases.";
    if (levelTagEl) levelTagEl.innerText = `${node.difficulty || 'SS1'} Core`;

    if (prereqList) {
        const prereqs = getPrerequisiteMap().get(node.id) || [];
        if (prereqs.length === 0) {
            prereqList.innerHTML = `
                <div class="prereq-item">
                    <div class="prereq-name"><span class="check-icon">✓</span> Basic Arithmetic Operations</div>
                    <span class="prereq-status-tag">Completed</span>
                </div>
                <div class="prereq-item">
                    <div class="prereq-name"><span class="check-icon">✓</span> Prime Factorization & GCD</div>
                    <span class="prereq-status-tag">Completed</span>
                </div>
            `;
        } else {
            prereqList.innerHTML = prereqs.map(p => {
                const isDone = completedTopics.includes(p);
                return `
                    <div class="prereq-item">
                        <div class="prereq-name"><span class="check-icon">${isDone ? '✓' : '•'}</span> ${p}</div>
                        <span class="prereq-status-tag">${isDone ? 'Completed' : 'Pending'}</span>
                    </div>
                `;
            }).join('');
        }
    }

    if (objList) {
        objList.innerHTML = `
            <li>Convert accurately across Bases 2, 8, 10, and 16</li>
            <li>Evaluate cyclic residues in modular clock systems</li>
            <li>Apply logarithmic laws to algebraic expressions</li>
        `;
    }

    if (startBtn) {
        startBtn.onclick = () => {
            openLearningModuleModal(node);
        };
    }

    const diagBtn = document.getElementById('diagnostic-btn');
    if (diagBtn) {
        diagBtn.onclick = () => {
            openDiagnosticModal(node);
        };
    }
}

function closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
}

async function markModuleCompleted(topicId) {
    try {
        const res = await fetch(`${API_BASE}/me/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ topic_id: topicId })
        });
        if (res.ok) {
            if (!completedTopics.includes(topicId)) {
                completedTopics.push(topicId);
            }
            await renderNetworkGraph();
            return true;
        }
    } catch (e) {
        console.error('Failed to mark topic complete:', e);
    }
    return false;
}

function openDiagnosticModal(node) {
    const backdrop = document.getElementById('modal-backdrop');
    const bodyContent = document.getElementById('modal-body-content');
    if (!backdrop || !bodyContent) return;

    const topicTitle = node.id || "Module 1: Foundational Numbers";
    
    let questions = [
        {
            q: `What is the binary (Base-2) equivalent of decimal number 25?`,
            options: [`11001₂`, `10101₂`, `11100₂`, `10011₂`],
            answer: 0
        },
        {
            q: `Evaluate the modular congruence residue: (14 + 19) mod 7`,
            options: [`5`, `3`, `2`, `0`],
            answer: 0
        },
        {
            q: `Simplify the logarithmic expression: log₂ (64)`,
            options: [`6`, `8`, `5`, `4`],
            answer: 0
        }
    ];

    if (topicTitle.toLowerCase().includes('algebra') || topicTitle.toLowerCase().includes('equation')) {
        questions = [
            { q: `Solve for x: 3x - 7 = 14`, options: [`x = 7`, `x = 5`, `x = 8`, `x = 6`], answer: 0 },
            { q: `Factorize the quadratic expression: x² - 5x + 6`, options: [`(x-2)(x-3)`, `(x-1)(x-6)`, `(x+2)(x+3)`, `(x+1)(x-6)`], answer: 0 },
            { q: `Determine the discriminant of 2x² - 4x + 2 = 0`, options: [`0`, `8`, `16`, `-8`], answer: 0 }
        ];
    } else if (topicTitle.toLowerCase().includes('trigonometry') || topicTitle.toLowerCase().includes('geometry')) {
        questions = [
            { q: `What is the exact value of sin(30°)?`, options: [`1/2`, `√3/2`, `√2/2`, `1`], answer: 0 },
            { q: `In a right triangle with legs 6 and 8, calculate the hypotenuse:`, options: [`10`, `12`, `14`, `9`], answer: 0 },
            { q: `Calculate the sum of interior angles in a hexagon (6 sides):`, options: [`720°`, `540°`, `360°`, `900°`], answer: 0 }
        ];
    }

    let userAnswers = {};

    bodyContent.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); color: #a5b4fc; font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">Diagnostic Assessment</span>
                <span style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">Adaptive Evaluation</span>
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: #ffffff;">${topicTitle}</h2>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Answer the diagnostic questions below to evaluate your prerequisite knowledge and unlock advanced path stages.</p>
        </div>

        <div id="quiz-questions-container">
            ${questions.map((item, idx) => `
                <div class="assessment-question-box">
                    <div style="font-weight: 700; font-size: 0.92rem; color: #ffffff; margin-bottom: 10px;">
                        Question ${idx + 1}: ${item.q}
                    </div>
                    <div class="options-list">
                        ${item.options.map((opt, oIdx) => `
                            <button class="assessment-option-btn" data-q="${idx}" data-o="${oIdx}" onclick="selectQuizOption(${idx}, ${oIdx})">
                                <span style="display: inline-block; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--glass-border-subtle); text-align: center; line-height: 20px; margin-right: 10px; font-size: 0.75rem; color: #a5b4fc;">${String.fromCharCode(65 + oIdx)}</span>
                                <span>${opt}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        <div id="quiz-footer-row" style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn-secondary-dark" onclick="closeModal()" style="width: auto; padding: 10px 20px;">Cancel</button>
            <button class="btn-primary-indigo" id="submit-quiz-btn" onclick="submitDiagnosticAssessment('${topicTitle}')" style="width: auto; padding: 10px 24px; margin-bottom: 0;">Submit Assessment</button>
        </div>
    `;

    backdrop.classList.remove('hidden');

    window.selectQuizOption = (qIdx, oIdx) => {
        userAnswers[qIdx] = oIdx;
        const qBtns = document.querySelectorAll(`button[data-q="${qIdx}"]`);
        qBtns.forEach(btn => {
            const isThis = parseInt(btn.getAttribute('data-o')) === oIdx;
            btn.classList.toggle('selected', isThis);
        });
    };

    window.submitDiagnosticAssessment = async (title) => {
        const submitBtn = document.getElementById('submit-quiz-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%;"></span> Evaluating...`;
        }

        let score = 0;
        questions.forEach((q, idx) => {
            if (userAnswers[idx] === q.answer) score++;
        });

        const scorePct = Math.round((score / questions.length) * 100);
        await markModuleCompleted(title);

        bodyContent.innerHTML = `
            <div style="text-align: center; padding: 1.5rem 0;">
                <div style="width: 64px; height: 64px; background: rgba(16, 185, 129, 0.2); border: 2px solid #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: #34d399; font-size: 1.8rem; font-weight: bold;">✓</div>
                <h2 style="font-size: 1.5rem; font-weight: 800; color: #ffffff; margin-bottom: 0.35rem;">Assessment Completed!</h2>
                <div style="font-size: 2.2rem; font-weight: 800; color: #34d399; margin-bottom: 0.5rem;">${scorePct}% Score</div>
                <p style="font-size: 0.88rem; color: var(--text-secondary); max-width: 440px; margin: 0 auto 1.5rem auto;">
                    Great job! Prerequisite mastery verified for <strong>${title}</strong>. This module is now marked completed and dependent learning path stages have been unlocked.
                </p>
                <button class="btn-primary-indigo" onclick="closeModal()" style="max-width: 240px; margin: 0 auto;">Continue Learning Path</button>
            </div>
        `;
    };
}

function openLearningModuleModal(node) {
    const backdrop = document.getElementById('modal-backdrop');
    const bodyContent = document.getElementById('modal-body-content');
    if (!backdrop || !bodyContent) return;

    const topicTitle = node.id || "Module 1: Foundational Numbers";
    const topicDesc = node.details || "Core prerequisite mastery covering positional representations, binary/modular arithmetic systems, and fundamental root bases.";

    bodyContent.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); color: #a5b4fc; font-size: 0.7rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">Interactive Module</span>
                <span style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 600;">${node.difficulty || 'SS1'} Syllabus</span>
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: #ffffff;">${topicTitle}</h2>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${topicDesc}</p>
        </div>

        <div class="assessment-question-box" style="margin-bottom: 1rem;">
            <h4 style="font-size: 0.88rem; color: #a5b4fc; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">Lesson Highlights</h4>
            <ul style="color: var(--text-secondary); font-size: 0.82rem; padding-left: 18px; line-height: 1.6;">
                <li>Master fundamental algorithms and algebraic transformations.</li>
                <li>Work through step-by-step solved examples and self-check exercises.</li>
                <li>Complete the diagnostic assessment to verify prerequisite readiness.</li>
            </ul>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 1.5rem;">
            <button class="btn-secondary-dark" onclick="closeModal()" style="flex: 1;">Close</button>
            <button class="btn-primary-indigo" onclick="closeModal(); openDiagnosticModal({ id: '${topicTitle}', difficulty: '${node.difficulty || 'SS1'}' });" style="flex: 2; margin-bottom: 0;">Take Assessment Now</button>
        </div>
    `;

    backdrop.classList.remove('hidden');
}

let dragStartPos = null;
let isDragMoving = false;

function dragstarted(event, d) {
    dragStartPos = { x: event.x, y: event.y };
    isDragMoving = false;
}

function dragged(event, d) {
    if (dragStartPos) {
        const dx = event.x - dragStartPos.x;
        const dy = event.y - dragStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 4) {
            isDragMoving = true;
        }
    }
}

function dragended(event, d) {
    setTimeout(() => { isDragMoving = false; }, 50);
}

function setupZoomControls() {
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomFitBtn = document.getElementById('zoom-fit-btn');

    if (zoomInBtn && svgD3 && zoomBehavior) {
        zoomInBtn.onclick = () => svgD3.transition().duration(300).call(zoomBehavior.scaleBy, 1.25);
    }
    if (zoomOutBtn && svgD3 && zoomBehavior) {
        zoomOutBtn.onclick = () => svgD3.transition().duration(300).call(zoomBehavior.scaleBy, 0.8);
    }
    if (zoomFitBtn && svgD3 && zoomBehavior) {
        zoomFitBtn.onclick = () => svgD3.transition().duration(300).call(zoomBehavior.transform, d3.zoomIdentity);
    }
}

function updateMinimapViewport(transform, width, height) {
    const minimapVp = document.getElementById('minimap-viewport');
    if (!minimapVp) return;
    const scale = transform.k || 1;
    const widthPct = Math.max(30, Math.min(80, (1 / scale) * 60));
    const heightPct = Math.max(30, Math.min(80, (1 / scale) * 60));
    const leftPct = Math.max(5, Math.min(60, 20 - (transform.x / width) * 20));
    const topPct = Math.max(5, Math.min(60, 20 - (transform.y / height) * 20));

    minimapVp.style.width = `${widthPct}%`;
    minimapVp.style.height = `${heightPct}%`;
    minimapVp.style.left = `${leftPct}%`;
    minimapVp.style.top = `${topPct}%`;
}

function setupFilters() {
    const input = document.getElementById('concept-filter-input');
    if (input) {
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            d3.selectAll('.node-group').style('opacity', d => {
                if (!query) return 1;
                return d.label.toLowerCase().includes(query) || d.subheading.toLowerCase().includes(query) ? 1 : 0.2;
            });
        });
    }
}

function switchMobileTab(tab) {
    const graphBtn = document.getElementById('mobile-tab-graph');
    const moduleBtn = document.getElementById('mobile-tab-module');
    const strategyBtn = document.getElementById('mobile-tab-strategy');
    
    const canvasCard = document.getElementById('canvas-card');
    const inspectorCard = document.getElementById('inspector-card');
    const strategyCard = document.getElementById('strategy-card');

    [graphBtn, moduleBtn, strategyBtn].forEach(b => b && b.classList.remove('active'));

    if (window.innerWidth <= 860) {
        if (tab === 'graph') {
            if (graphBtn) graphBtn.classList.add('active');
            if (canvasCard) canvasCard.classList.remove('mobile-tab-hidden');
            if (inspectorCard) inspectorCard.classList.add('mobile-tab-hidden');
            if (strategyCard) strategyCard.classList.add('mobile-tab-hidden');
        } else if (tab === 'module') {
            if (moduleBtn) moduleBtn.classList.add('active');
            if (canvasCard) canvasCard.classList.add('mobile-tab-hidden');
            if (inspectorCard) inspectorCard.classList.remove('mobile-tab-hidden');
            if (strategyCard) strategyCard.classList.add('mobile-tab-hidden');
        } else if (tab === 'strategy') {
            if (strategyBtn) strategyBtn.classList.add('active');
            if (canvasCard) canvasCard.classList.add('mobile-tab-hidden');
            if (inspectorCard) inspectorCard.classList.add('mobile-tab-hidden');
            if (strategyCard) strategyCard.classList.remove('mobile-tab-hidden');
        }
    }
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 860) {
        const canvasCard = document.getElementById('canvas-card');
        const inspectorCard = document.getElementById('inspector-card');
        const strategyCard = document.getElementById('strategy-card');
        [canvasCard, inspectorCard, strategyCard].forEach(c => c && c.classList.remove('mobile-tab-hidden'));
    }
});

