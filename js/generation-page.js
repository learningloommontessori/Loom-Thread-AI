// js/generation-page.js
import getSupabase from './supabaseClient.js';

let supabase;
let currentUserSession;
let currentLessonData = null; 
let currentTopicName = "";

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    
    // 1. Auth Check
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { window.location.href = '/sign-in.html'; return; }
    currentUserSession = session;

    // 2. Header Setup
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut(); window.location.href = '/index.html';
    });
    
    // 3. Get Inputs & Start
    currentTopicName = localStorage.getItem('currentTopic');
    const language = localStorage.getItem('generationLanguage') || 'English';
    const age = localStorage.getItem('selectedAge') || 'Nursery';

    if (!currentTopicName) { alert('Missing data. Redirecting.'); window.location.href = '/new-chat.html'; return; }

    generateContent(currentTopicName, language, age, session.access_token);
});

async function generateContent(topic, language, age, token) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');
    if(loader) loader.style.display = 'flex';
    if(mainContent) mainContent.classList.add('hidden');

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ topic, language, age }),
        });

        if (!response.ok) throw new Error((await response.json()).error || 'Generation failed.');

        // The API now returns the raw lesson plan object directly
        const lessonPlan = await response.json();
        if (!lessonPlan || Object.keys(lessonPlan).length === 0) throw new Error("Received empty data.");

        currentLessonData = lessonPlan;
        populatePageUI(lessonPlan);
        setupGlobalButtons(); // Setup main download buttons

    } catch (err) {
        console.error('Error:', err);
        if(loader) loader.innerHTML = `<div class="text-center text-red-400"><p>Error: ${err.message}</p><a href="/new-chat.html" class="underline mt-4 block">Try Again</a></div>`;
    }
}

function populatePageUI(lessonPlan) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');

    // --- SPECIAL HANDLING FOR CLASSIC RESOURCES (Links) ---
    const classicContainer = document.getElementById('classicResources-content');
    if (classicContainer && lessonPlan.classicResources) {
        let html = '<div class="grid gap-4 md:grid-cols-2">';
        lessonPlan.classicResources.forEach(item => {
            html += `
            <div class="bg-white/5 p-4 rounded-lg border border-white/10 flex flex-col justify-between">
                <div>
                    <span class="text-xs font-medium text-purple-300 uppercase tracking-wider">${item.type}</span>
                    <h3 class="text-lg font-bold text-white mt-1 mb-3">${item.title}</h3>
                </div>
                <div class="flex gap-2 mt-2">
                    <a href="${item.youtubeLink}" target="_blank" class="flex-1 flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-600 text-white text-sm py-2 rounded transition-colors">
                        <span class="material-symbols-outlined text-base">play_circle</span> YouTube
                    </a>
                    <a href="${item.amazonLink}" target="_blank" class="flex-1 flex items-center justify-center gap-2 bg-orange-500/80 hover:bg-orange-500 text-white text-sm py-2 rounded transition-colors">
                        <span class="material-symbols-outlined text-base">shopping_cart</span> Amazon
                    </a>
                </div>
                 <button onclick="shareSingleItem('${item.type}: ${item.title}', 'Find it here: ${item.youtubeLink} or ${item.amazonLink}')" class="mt-3 w-full flex justify-center items-center gap-1 text-xs text-purple-300 hover:text-purple-100 transition-colors">
                    <span class="material-symbols-outlined text-sm">share</span> Share Resource
                 </button>
            </div>`;
        });
        html += '</div>';
        classicContainer.innerHTML = html;
    }

    // --- GENERIC HANDLING FOR OTHER TABS (Tags & Content) ---
    for (const tabKey in lessonPlan) {
        // Skip already handled or irrelevant keys
        if (tabKey === 'classicResources' || tabKey === 'imagePrompt' || tabKey.startsWith('user_')) continue;

        const container = document.getElementById(`${tabKey}-content`);
        if (container) {
            const tabData = lessonPlan[tabKey];
            let tagsHtml = '<div class="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">';
            let contentHtml = '<div class="mt-4">';
            let isFirst = true;

            if (typeof tabData === 'object' && !Array.isArray(tabData)) {
                for (const contentKey in tabData) {
                    // Format Title (e.g., "grossMotorActivities" -> "Gross Motor Activities")
                    const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    const activeClass = isFirst ? 'active-tag' : '';
                    const displayClass = isFirst ? 'block' : 'hidden';

                    tagsHtml += `<button class="glass-tag ${activeClass}" onclick="switchTag('${tabKey}', '${contentKey}', this)">${title}</button>`;
                    
                    let bodyContent = formatBodyContent(tabData[contentKey]);

                    contentHtml += `
                        <div id="${tabKey}-${contentKey}" class="tag-content-item ${displayClass}">
                            <div class="flex justify-between items-start mb-3">
                                <h3 class="text-xl font-bold text-white">${title}</h3>
                                <button onclick="shareSingleItem('${title}', '${escapeHtml(bodyContent)}')" class="text-purple-400 hover:text-purple-200 transition-colors p-1" title="Share to Hub">
                                    <span class="material-symbols-outlined">share</span>
                                </button>
                            </div>
                            <div class="prose prose-invert max-w-none text-gray-300 leading-relaxed">
                                ${bodyContent}
                            </div>
                        </div>
                    `;
                    isFirst = false;
                }
            }
            container.innerHTML = tagsHtml + tagsHtml ? (tagsHtml + contentHtml) : contentHtml;
        }
    }

    if(loader) loader.style.display = 'none';
    if(mainContent) mainContent.classList.remove('hidden');
    setupTabNavigation();
}

// Helper to format lists vs strings
function formatBodyContent(content) {
    if (Array.isArray(content)) {
        return `<ul class="list-disc list-inside space-y-2">${content.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }
    return content;
}

// Helper for HTML escaping to prevent breakage in share function
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// --- GLOBAL FUNCTIONS (Called by HTML attributes) ---

window.switchTag = (tabKey, contentKey, clickedBtn) => {
    const container = document.getElementById(`${tabKey}-content`);
    container.querySelectorAll('.glass-tag').forEach(btn => btn.classList.remove('active-tag'));
    clickedBtn.classList.add('active-tag');
    container.querySelectorAll('.tag-content-item').forEach(div => div.classList.add('hidden'));
    document.getElementById(`${tabKey}-${contentKey}`).classList.remove('hidden');
};

// New Share Functionality
window.shareSingleItem = async (title, contentHtml) => {
    if(!confirm(`Share "${title}" to the Community Hub?`)) return;
    
    // Strip HTML for plain text sharing
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = contentHtml;
    const plainTextContent = tempDiv.textContent || tempDiv.innerText || "";

    try {
        const { error } = await supabase.from('CommunityHub').insert([{
            user_id: currentUserSession.user.id,
            user_name: currentUserSession.user.user_metadata?.full_name || 'A Loom Weaver',
            topic: currentTopicName,
            category: 'Shared Lesson Snippet',
            content: `**${title}**\n\n${plainTextContent}`,
            age: localStorage.getItem('selectedAge') || 'General'
        }]);
        if (error) throw error;
        alert("Successfully shared to the Collective Loom!");
    } catch (error) {
        console.error("Share error:", error);
        alert("Failed to share. Please try again.");
    }
};

// --- SETUP LISTENERS ---

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.glass-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(t => t.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active-tab-content'));
            document.getElementById(`${tab.dataset.tab}-content`).classList.add('active-tab-content');
        });
    });
}

function setupGlobalButtons() {
    // 1. FULL DOWNLOAD BUTTON
    const fullDownloadBtn = document.getElementById('download-plan-btn');
    if (fullDownloadBtn) {
        fullDownloadBtn.onclick = generateFullPDF;
    }

    // 2. EXPORT SECTION BUTTONS
    const exportPdfBtn = document.getElementById('export-section-pdf');
    const exportWordBtn = document.getElementById('export-section-word');
    
    if (exportPdfBtn) exportPdfBtn.onclick = () => exportCurrentSection('pdf');
    if (exportWordBtn) exportWordBtn.onclick = () => exportCurrentSection('word');
}

// --- DOWNLOAD LOGIC ---

async function generateFullPDF() {
    if (!window.jspdf || !currentLessonData) return alert("Data or libraries not ready.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(22); doc.setTextColor(102, 51, 153);
    doc.text(currentTopicName, 10, yPos); yPos += 15;

    doc.setFontSize(12); doc.setTextColor(0);

    // Iterate through the data structure
    for (const [sectionKey, sectionData] of Object.entries(currentLessonData)) {
        if (['id', 'user_id', 'created_at', 'imagePrompt'].includes(sectionKey)) continue;

        const sectionTitle = sectionKey.replace(/([A-Z])/g, ' $1').toUpperCase();
        doc.setFontSize(16); doc.setTextColor(102, 51, 153);
        doc.text(sectionTitle, 10, yPos); yPos += 10;
        doc.setLineWidth(0.5); doc.line(10, yPos-2, 200, yPos-2); yPos += 5;

        doc.setFontSize(12); doc.setTextColor(0);

        if (Array.isArray(sectionData)) {
            // Handle arrays (like Classic Resources)
            sectionData.forEach(item => {
                 const text = typeof item === 'object' ? `${item.type}: ${item.title} (Links in web version)` : `• ${item}`;
                 // Simple page break check
                 if(yPos > 270) { doc.addPage(); yPos = 20; }
                 doc.text(text, 15, yPos); yPos += 7;
            });
        } else if (typeof sectionData === 'object') {
             // Handle nested objects (like Movement & Music)
            for (const [subKey, content] of Object.entries(sectionData)) {
                 const subTitle = subKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                 doc.setFont(undefined, 'bold');
                 if(yPos > 270) { doc.addPage(); yPos = 20; }
                 doc.text(subTitle, 10, yPos); yPos += 7;
                 doc.setFont(undefined, 'normal');

                 const bodyText = Array.isArray(content) ? content.map(i => `• ${i}`).join('\n') : content;
                 const splitText = doc.splitTextToSize(bodyText, 180);
                 if(yPos + splitText.length * 7 > 270) { doc.addPage(); yPos = 20; }
                 doc.text(splitText, 15, yPos);
                 yPos += (splitText.length * 7) + 10;
            }
        }
        yPos += 10;
    }
    doc.save(`${currentTopicName.replace(/\s+/g, '_')}_FullPlan.pdf`);
}

async function exportCurrentSection(format) {
    const activeTab = document.querySelector('.glass-tab.active-tab');
    if (!activeTab) return alert("No section selected.");
    const tabId = activeTab.dataset.tab;
    
    // Get visible content only
    const visibleContent = document.querySelector(`#${tabId}-content .tag-content-item:not(.hidden)`);
    const container = document.getElementById(`${tabId}-content`);
    
    // Use visible content if available (for tabs), otherwise whole container (for classic resources)
    const contentEl = visibleContent || container;

    if (!contentEl || contentEl.innerText.trim().length < 5) return alert("Section appears empty.");

    const title = activeTab.innerText;

    if (format === 'pdf') {
        if (!window.jspdf) return alert("PDF library missing.");
        const doc = new window.jspdf.jsPDF();
        doc.setFontSize(18); doc.text(title, 10, 20);
        doc.setFontSize(12);
        const splitText = doc.splitTextToSize(contentEl.innerText, 180);
        doc.text(splitText, 10, 30);
        doc.save(`${title}_Section.pdf`);
    } 
    else if (format === 'word') {
        if (!window.htmlToDocx) return alert("Word export library missing. Please refresh.");
        const htmlContent = `
            <html><head><style>body { font-family: Arial; }</style></head>
            <body><h1>${title}</h1>${contentEl.innerHTML}</body></html>
        `;
        try {
            const blob = await window.htmlToDocx(htmlContent, null, {
                table: { row: { cantSplit: true } }, footer: true, pageNumber: true,
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${title}.docx`;
            link.click();
        } catch (e) { console.error(e); alert("Word export failed."); }
    }
}