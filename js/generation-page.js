// js/generation-page.js
import getSupabase from './supabaseClient.js';

let supabase;
let currentUserSession;
let currentLessonData = null; 

// --- 1. INITIALIZATION & DATA FETCHING ---
document.addEventListener('DOMContentLoaded', async () => {
    // A. Initialize Supabase
    supabase = await getSupabase();
    
    // B. Check Auth
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    currentUserSession = session;

    // C. Setup Header (Welcome msg & Logout)
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) {
        welcomeMsg.textContent = `Welcome, ${userName.split(' ')[0]}!`;
        welcomeMsg.classList.remove('hidden');
    }
    
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
    
    // D. Retrieve User Inputs
    const currentTopic = localStorage.getItem('currentTopic');
    const currentLanguage = localStorage.getItem('generationLanguage') || 'English';
    const currentAge = localStorage.getItem('selectedAge') || 'Nursery';

    if (!currentTopic) {
        alert('No topic found. Redirecting to start a new lesson.');
        window.location.href = '/new-chat.html';
        return;
    }

    // E. TRIGGER GENERATION
    generateAndDisplayContent(currentTopic, currentLanguage, currentAge, session.access_token);
});

// --- 2. API CALL ---
async function generateAndDisplayContent(topic, language, age, token) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');
    
    // Show Loader
    if(loader) loader.style.display = 'flex';
    if(mainContent) mainContent.classList.add('hidden');

    try {
        console.log("Calling API...");
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ topic, language, age }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate content.');
        }

        const result = await response.json();
        console.log("API Response:", result);

        // ROBUST DATA PARSING (Handles both {data: ...} and {lessonPlan: ...})
        let lessonPlan = result.lessonPlan || result.data;
        
        // If data is wrapped in 'success', dig deeper
        if (!lessonPlan && result.success && result.data) {
            lessonPlan = result.data;
        }

        if (!lessonPlan) throw new Error("Received empty data from AI.");

        currentLessonData = lessonPlan;
        
        // Populate the UI
        populatePage(lessonPlan, null, topic);
        
        // Setup Image Tab (Optional, if you have image generation logic)
        // setupImageTab(topic, lessonPlan); 

    } catch (err) {
        console.error('Error fetching generated content:', err);
        if(loader) {
            loader.innerHTML = `
                <div class="text-center">
                    <p class="text-red-400 text-lg">Sorry, something went wrong.</p>
                    <p class="text-gray-400 text-sm mt-2">${err.message}</p>
                    <a href="/new-chat.html" class="mt-4 inline-block bg-purple-600 text-white px-4 py-2 rounded-lg">Try Again</a>
                </div>
            `;
        }
    }
}

// --- 3. UI BUILDER (TABS & TAGS) ---
function populatePage(lessonPlan, imageUrl, topic) {
    const mainContent = document.getElementById('main-content');
    const loader = document.getElementById('loader');

    // Loop through tabs
    for (const tabKey in lessonPlan) {
        if (tabKey === 'imagePrompt') continue;

        const tabContentContainer = document.getElementById(`${tabKey}-content`);
        if (tabContentContainer) {
            const tabData = lessonPlan[tabKey];
            
            // Containers for Tags and Content
            let tagsHtml = '<div class="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">';
            let contentHtml = '<div class="mt-4">';
            
            let isFirst = true;

            // Check if tabData is an object (nested content) or array
            if (typeof tabData === 'object' && !Array.isArray(tabData)) {
                for (const contentKey in tabData) {
                    const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    
                    const activeClass = isFirst ? 'active-tag' : '';
                    const displayClass = isFirst ? 'block' : 'hidden';

                    // Create Tag Button
                    tagsHtml += `<button class="glass-tag ${activeClass}" onclick="switchTag('${tabKey}', '${contentKey}', this)">${title}</button>`;
                    
                    // Create Content Div
                    let body = tabData[contentKey];
                    if (Array.isArray(body)) {
                        body = `<ul class="list-disc list-inside space-y-2 text-gray-300">${body.map(item => `<li>${item}</li>`).join('')}</ul>`;
                    } else {
                        body = `<p class="text-gray-300 leading-relaxed">${body}</p>`;
                    }

                    contentHtml += `
                        <div id="${tabKey}-${contentKey}" class="tag-content-item ${displayClass}">
                            <h3 class="text-xl font-bold text-white mb-3">${title}</h3>
                            <div class="prose prose-invert max-w-none">
                                ${body}
                            </div>
                        </div>
                    `;
                    isFirst = false;
                }
            } else if (Array.isArray(tabData)) {
                 // Fallback for simple array data (like Classic Resources)
                 contentHtml += `<ul class="list-disc list-inside space-y-2 text-gray-300">${tabData.map(item => `<li>${item}</li>`).join('')}</ul>`;
            }

            tagsHtml += '</div>';
            contentHtml += '</div>';

            // Inject HTML
            tabContentContainer.innerHTML = tagsHtml + contentHtml;
        }
    }

    // Reveal Content
    if(loader) loader.style.display = 'none';
    if(mainContent) mainContent.classList.remove('hidden');

    setupActionButtons();
}

// --- 4. INTERACTIVITY & EXPORT ---

// Global function for tag switching
window.switchTag = (tabKey, contentKey, clickedBtn) => {
    const container = document.getElementById(`${tabKey}-content`);
    
    // Reset buttons
    const allBtns = container.querySelectorAll('.glass-tag');
    allBtns.forEach(btn => btn.classList.remove('active-tag'));
    clickedBtn.classList.add('active-tag');
    
    // Toggle content
    const allContent = container.querySelectorAll('.tag-content-item');
    allContent.forEach(div => div.classList.add('hidden'));
    
    const targetDiv = document.getElementById(`${tabKey}-${contentKey}`);
    if (targetDiv) targetDiv.classList.remove('hidden');
};

function setupActionButtons() {
    // 1. Tab Switching Logic
    const tabs = document.querySelectorAll('.glass-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active-tab'));
            // Add active class to clicked tab
            tab.classList.add('active-tab');
            
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active-tab-content'));
            
            // Show target content
            const targetId = tab.dataset.tab;
            const targetContent = document.getElementById(`${targetId}-content`);
            if (targetContent) targetContent.classList.add('active-tab-content');
        });
    });

    // 2. Export Buttons
    const exportPdfBtn = document.getElementById('export-section-pdf');
    if (exportPdfBtn) {
        exportPdfBtn.replaceWith(exportPdfBtn.cloneNode(true)); // Clean listeners
        document.getElementById('export-section-pdf').addEventListener('click', () => exportCurrentSection('pdf'));
    }

    const exportWordBtn = document.getElementById('export-section-word');
    if (exportWordBtn) {
        exportWordBtn.replaceWith(exportWordBtn.cloneNode(true));
        document.getElementById('export-section-word').addEventListener('click', () => exportCurrentSection('word'));
    }
}

async function exportCurrentSection(format) {
    const activeTabLink = document.querySelector('.glass-tab.active-tab');
    if (!activeTabLink) return alert("No section selected.");
    
    const tabId = activeTabLink.dataset.tab;
    const contentContainer = document.getElementById(`${tabId}-content`);
    
    if (!contentContainer || contentContainer.innerText.trim() === "") {
        return alert("This section is empty.");
    }

    const title = activeTabLink.innerText.trim();
    
    if (format === 'pdf') {
        if (!window.jspdf) return alert("PDF library not loaded.");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(title, 10, 10);
        
        doc.setFontSize(12);
        // Try to get visible tag content first, else get whole container
        const visibleContent = contentContainer.querySelector('.tag-content-item:not(.hidden)');
        const text = visibleContent ? visibleContent.innerText : contentContainer.innerText;
        
        const splitText = doc.splitTextToSize(text, 180);
        doc.text(splitText, 10, 20);
        
        doc.save(`${title}.pdf`);
    } 
    else if (format === 'word') {
        const content = `<html><body><h1>${title}</h1>${contentContainer.innerHTML}</body></html>`;
        try {
            const blob = await htmlToDocx(content, null, {
                table: { row: { cantSplit: true } },
                footer: true,
                pageNumber: true,
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${title}.docx`;
            link.click();
        } catch (error) {
            console.error(error);
            alert("Error exporting Word document");
        }
    }
}