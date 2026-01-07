// js/generation-page.js

// ... existing imports and top code ...

function populatePage(lessonPlan, imageUrl, topic) {
    const mainContent = document.getElementById('main-content');
    const loader = document.getElementById('loader');

    // 1. UPDATE HEADER
    // (Ensure you aren't overwriting the Export buttons in the header if they are static HTML!)
    // If your header is static in HTML, we just need to update content tabs.

    // 2. LOOP THROUGH TABS AND CREATE TAGS
    for (const tabKey in lessonPlan) {
        if (tabKey === 'imagePrompt') continue;

        const tabContentContainer = document.getElementById(`${tabKey}-content`);
        if (tabContentContainer) {
            const tabData = lessonPlan[tabKey];
            
            // A. Create the Container for Tags (Buttons)
            let tagsHtml = '<div class="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">';
            
            // B. Create the Container for the actual Text Content
            let contentHtml = '<div class="mt-4">';
            
            let isFirst = true;

            // Loop through the inner data (e.g., "Art Activity", "Sensory Activity")
            for (const contentKey in tabData) {
                const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                // GENERATE TAG BUTTON
                // We add 'active-tag' to the first one by default
                const activeClass = isFirst ? 'active-tag' : '';
                tagsHtml += `<button class="glass-tag ${activeClass}" onclick="switchTag('${tabKey}', '${contentKey}', this)">${title}</button>`;
                
                // GENERATE CONTENT DIV
                // We hide all except the first one
                const displayClass = isFirst ? 'block' : 'hidden';
                
                let body = tabData[contentKey];
                // Format Arrays (like lists) nicely
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

            tagsHtml += '</div>';
            contentHtml += '</div>';

            // Inject the combined HTML into the tab
            tabContentContainer.innerHTML = tagsHtml + contentHtml;
        }
    }

    // Reveal Content
    if(loader) loader.style.display = 'none';
    if(mainContent) mainContent.classList.remove('hidden');

    // Re-attach listeners for the new buttons we just made
    setupActionButtons();
}

// --- NEW FUNCTION TO HANDLE TAG SWITCHING ---
// Make this available globally or attach via event listeners
window.switchTag = (tabKey, contentKey, clickedBtn) => {
    const container = document.getElementById(`${tabKey}-content`);
    
    // 1. Reset all Buttons in this container
    const allBtns = container.querySelectorAll('.glass-tag');
    allBtns.forEach(btn => btn.classList.remove('active-tag'));
    
    // 2. Activate clicked Button
    clickedBtn.classList.add('active-tag');
    
    // 3. Hide all Content Items in this container
    const allContent = container.querySelectorAll('.tag-content-item');
    allContent.forEach(div => div.classList.add('hidden'));
    
    // 4. Show the selected Content Item
    const targetDiv = document.getElementById(`${tabKey}-${contentKey}`);
    if (targetDiv) targetDiv.classList.remove('hidden');
};

function setupActionButtons() {
    // --- FIX FOR EXPORT BUTTONS ---
    
    // 1. Export Section (PDF)
    const exportPdfBtn = document.getElementById('export-section-pdf');
    if (exportPdfBtn) {
        // Remove old listeners to prevent duplicates
        exportPdfBtn.replaceWith(exportPdfBtn.cloneNode(true));
        document.getElementById('export-section-pdf').addEventListener('click', () => {
            exportCurrentSection('pdf');
        });
    }

    // 2. Export Section (Word)
    const exportWordBtn = document.getElementById('export-section-word');
    if (exportWordBtn) {
        exportWordBtn.replaceWith(exportWordBtn.cloneNode(true));
        document.getElementById('export-section-word').addEventListener('click', () => {
            exportCurrentSection('word');
        });
    }
}

// --- LOGIC TO EXPORT ONLY THE ACTIVE TAB ---
async function exportCurrentSection(format) {
    // Find the currently active tab
    const activeTabLink = document.querySelector('.glass-tab.active-tab');
    if (!activeTabLink) return alert("No section selected.");
    
    const tabId = activeTabLink.dataset.tab;
    const contentContainer = document.getElementById(`${tabId}-content`);
    
    if (!contentContainer || contentContainer.innerText.trim() === "") {
        return alert("This section is empty.");
    }

    const title = activeTabLink.innerText.trim();
    
    if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(title, 10, 10);
        
        doc.setFontSize(12);
        // Get text from the visible content tag
        const visibleContent = contentContainer.querySelector('.tag-content-item:not(.hidden)');
        const text = visibleContent ? visibleContent.innerText : contentContainer.innerText;
        
        const splitText = doc.splitTextToSize(text, 180);
        doc.text(splitText, 10, 20);
        
        doc.save(`${title}.pdf`);
    } 
    else if (format === 'word') {
        // Basic HTML to Docx export
        const content = `
            <html><body>
                <h1>${title}</h1>
                ${contentContainer.innerHTML}
            </body></html>`;
            
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