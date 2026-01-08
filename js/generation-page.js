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
    const age = localStorage.getItem('selectedAge') || 'Class 1-5';

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

        const result = await response.json();
        
        // Unwrap data (Handles both {lessonPlan: ...} and direct object)
        let lessonPlan = result.lessonPlan || result; 

        if (!lessonPlan || Object.keys(lessonPlan).length === 0) throw new Error("Received empty data.");

        currentLessonData = lessonPlan;
        populatePageUI(lessonPlan);
        setupGlobalButtons(); 

    } catch (err) {
        console.error('Error:', err);
        if(loader) loader.innerHTML = `<div class="text-center text-red-400"><p>Error: ${err.message}</p><a href="/new-chat.html" class="underline mt-4 block">Try Again</a></div>`;
    }
}

function populatePageUI(lessonPlan) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');

    // --- GENERIC HANDLING FOR ALL TABS ---
    // The new JSON structure is consistent: { TabKey: { SubTag: Content } }
    // We iterate through all keys in the JSON and match them to HTML IDs.
    
    for (const tabKey in lessonPlan) {
        // Skip metadata keys
        if (['id', 'user_id', 'created_at', 'topic', 'age', 'language', 'imagePrompt', 'success'].includes(tabKey)) continue;

        // Find the matching container in HTML (e.g., 'lessonStarters-content')
        const container = document.getElementById(`${tabKey}-content`);
        
        if (container) {
            const tabData = lessonPlan[tabKey];
            
            // Prepare HTML builders
            let tagsHtml = '<div class="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">';
            let contentHtml = '<div class="mt-4">';
            let isFirst = true;

            // Handle Nested Objects (e.g. activeLearning -> handsOnExperiment)
            if (typeof tabData === 'object' && tabData !== null) {
                for (const contentKey in tabData) {
                    // Convert "handsOnExperiment" to "Hands On Experiment"
                    const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    
                    // Create safe ID for DOM elements
                    const safeId = contentKey.replace(/[^a-zA-Z0-9]/g, '');
                    
                    const activeClass = isFirst ? 'active-tag' : '';
                    const displayClass = isFirst ? 'block' : 'hidden';

                    // 1. Create the Tag Button
                    tagsHtml += `<button class="glass-tag ${activeClass}" onclick="switchTag('${tabKey}', '${safeId}', this)">${title}</button>`;
                    
                    // 2. Format the Body Content (Handles Strings and Arrays)
                    let bodyContent = formatBodyContent(tabData[contentKey]);

                    // 3. Create the Content Block
                    contentHtml += `
                        <div id="${tabKey}-${safeId}" class="tag-content-item ${displayClass}">
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
                container.innerHTML = tagsHtml + contentHtml;
            } 
        }
    }

    if(loader) loader.style.display = 'none';
    if(mainContent) mainContent.classList.remove('hidden');
    setupTabNavigation();
}

// Helpers
function formatBodyContent(content) {
    // If it's a list (like in Resource Hub or Materials), make a bulleted list
    if (Array.isArray(content)) {
        return `<ul class="list-disc list-inside space-y-2 marker:text-purple-400">${content.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }
    // Convert newlines to breaks for readability
    if (typeof content === 'string') {
        return content.replace(/\n/g, '<br>');
    }
    return content;
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Global functions (Attached to window for inline onclicks)
window.switchTag = (tabKey, contentKey, clickedBtn) => {
    const container = document.getElementById(`${tabKey}-content`);
    // Reset all tags in this container
    container.querySelectorAll('.glass-tag').forEach(btn => btn.classList.remove('active-tag'));
    // Activate clicked tag
    clickedBtn.classList.add('active-tag');
    
    // Hide all content items
    container.querySelectorAll('.tag-content-item').forEach(div => div.classList.add('hidden'));
    
    // Show target content
    const target = document.getElementById(`${tabKey}-${contentKey}`);
    if(target) target.classList.remove('hidden');
};

window.shareSingleItem = async (title, contentHtml) => {
    if(!confirm(`Share "${title}" to the Community Hub?`)) return;
    
    // Strip HTML for simple storage, or keep it if your Hub supports HTML
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
        alert("Failed to share.");
    }
};

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.glass-tab[data-tab]'); // Only main sidebar tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Handle active state for Sidebar Tabs
            tabs.forEach(t => t.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            
            // Handle visibility of Content Areas
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active-tab-content'));
            const targetId = `${tab.dataset.tab}-content`;
            const targetContent = document.getElementById(targetId);
            if(targetContent) targetContent.classList.add('active-tab-content');
        });
    });
}

function setupGlobalButtons() {
    const fullDownloadBtn = document.getElementById('download-plan-btn');
    if (fullDownloadBtn) fullDownloadBtn.onclick = generateFullPDF;

    const exportPdfBtn = document.getElementById('export-section-pdf');
    const exportWordBtn = document.getElementById('export-section-word');
    if (exportPdfBtn) exportPdfBtn.onclick = () => exportCurrentSection('pdf');
    if (exportWordBtn) exportWordBtn.onclick = () => exportCurrentSection('word');
}

async function generateFullPDF() {
    if (!window.jspdf || !currentLessonData) return alert("Libraries not ready.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(22); doc.setTextColor(102, 51, 153);
    doc.text(currentTopicName, 10, yPos); yPos += 15;
    
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Generated by Loom Thread AI | Age: ${localStorage.getItem('selectedAge')}`, 10, yPos); yPos += 15;

    doc.setFontSize(12); doc.setTextColor(0);

    for (const [sectionKey, sectionData] of Object.entries(currentLessonData)) {
        // Skip metadata
        if (['id', 'user_id', 'created_at', 'imagePrompt', 'success', 'topic', 'language', 'age'].includes(sectionKey)) continue;

        // Section Title (e.g., LESSON STARTERS)
        const sectionTitle = sectionKey.replace(/([A-Z])/g, ' $1').toUpperCase();
        
        // Page Break check
        if(yPos > 260) { doc.addPage(); yPos = 20; }
        
        doc.setFontSize(16); doc.setTextColor(102, 51, 153); // Purple
        doc.text(sectionTitle, 10, yPos); yPos += 8;
        doc.setLineWidth(0.5); doc.setDrawColor(200);
        doc.line(10, yPos-2, 200, yPos-2); yPos += 10;

        doc.setFontSize(12); doc.setTextColor(0);

        if (typeof sectionData === 'object' && sectionData !== null) {
             // Sub-sections (e.g. Story Hook, Wonder Question)
             for (const [subKey, content] of Object.entries(sectionData)) {
                 const subTitle = subKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                 
                 // Sub-title bold
                 doc.setFont(undefined, 'bold');
                 if(yPos > 270) { doc.addPage(); yPos = 20; }
                 doc.text(subTitle, 10, yPos); yPos += 6;
                 doc.setFont(undefined, 'normal');

                 // Content Body
                 const bodyText = Array.isArray(content) ? content.map(i => `• ${i}`).join('\n') : content;
                 
                 const splitText = doc.splitTextToSize(String(bodyText), 180);
                 if(yPos + (splitText.length * 6) > 275) { doc.addPage(); yPos = 20; }
                 
                 doc.text(splitText, 15, yPos);
                 yPos += (splitText.length * 6) + 10;
            }
        }
        yPos += 5;
    }
    doc.save(`${currentTopicName.replace(/\s+/g, '_')}_FullPlan.pdf`);
}

async function exportCurrentSection(format) {
    const activeTab = document.querySelector('.glass-tab.active-tab[data-tab]'); // Ensure it's a sidebar tab
    if (!activeTab) return alert("No section selected.");
    
    const tabId = activeTab.dataset.tab;
    const container = document.getElementById(`${tabId}-content`);
    
    // Get the currently visible sub-tag content, OR all content if no sub-tags are hidden
    const visibleContent = container.querySelector('.tag-content-item:not(.hidden)');
    
    // Fallback: If no single sub-tag is "active" (shouldn't happen), just take the whole container text
    const contentEl = visibleContent || container;

    if (!contentEl || contentEl.innerText.trim().length < 5) return alert("Section empty or loading.");
    
    // Clean up title
    const mainTitle = activeTab.innerText.trim();
    const subTitle = visibleContent ? visibleContent.querySelector('h3')?.innerText : '';
    const fullTitle = subTitle ? `${mainTitle} - ${subTitle}` : mainTitle;

    if (format === 'pdf') {
        const doc = new window.jspdf.jsPDF();
        doc.setFontSize(18); doc.setTextColor(102, 51, 153);
        doc.text(fullTitle, 10, 20);
        
        doc.setFontSize(12); doc.setTextColor(0);
        const splitText = doc.splitTextToSize(contentEl.innerText, 180);
        doc.text(splitText, 10, 35);
        
        doc.save(`${fullTitle}.pdf`);
    } else if (format === 'word') {
        if (!window.htmlToDocx) return alert("Word library missing.");
        
        const html = `
            <html>
                <head><style>body { font-family: sans-serif; }</style></head>
                <body>
                    <h1 style="color: #663399;">${fullTitle}</h1>
                    ${contentEl.innerHTML}
                </body>
            </html>`;
            
        try {
            const blob = await window.htmlToDocx(html, null, { 
                table: { row: { cantSplit: true } }, 
                footer: true, 
                pageNumber: true 
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${fullTitle}.docx`;
            link.click();
        } catch (e) { console.error(e); alert("Word export failed."); }
    }
}