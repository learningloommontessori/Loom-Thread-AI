// js/generation-page.js
import getSupabase from './supabaseClient.js';

let supabase;
let currentUserSession;
let currentLessonData = null; 
let currentTopic = '';
let currentLanguage = 'English'; 
let currentAge = 'Nursery'; // Default Age

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    currentUserSession = session;

    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('welcome-message').classList.remove('hidden');
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
    
    // 1. Retrieve Data from LocalStorage
    currentTopic = localStorage.getItem('currentTopic');
    currentLanguage = localStorage.getItem('generationLanguage') || 'English';
    currentAge = localStorage.getItem('selectedAge') || 'Nursery'; // <--- RETRIEVE AGE

    if (!currentTopic) {
        alert('No topic found. Redirecting to start a new lesson.');
        window.location.href = '/new-chat.html';
        return;
    }
    
    setupTabInteractions();
    // 2. Pass 'currentAge' to the function
    generateAndDisplayContent(currentTopic, currentLanguage, currentAge, session.access_token);
});

async function generateAndDisplayContent(topic, language, age, token) {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');
    
    loader.style.display = 'flex';
    mainContent.style.display = 'none';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            // 3. Send 'age' to the API
            body: JSON.stringify({ topic, language, age }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate content.');
        }

        const { lessonPlan, imageUrl } = await response.json();
        currentLessonData = lessonPlan; 
        
        populatePage(lessonPlan, imageUrl, topic);
        setupImageTab(topic, lessonPlan);

    } catch (err) {
        console.error('Error fetching generated content:', err);
        loader.innerHTML = `<div class="text-center"><p class="text-red-400 text-lg">Sorry, something went wrong.</p><p class="text-gray-400 text-sm mt-2">${err.message}</p><a href="/new-chat.html" class="mt-4 inline-block bg-purple-600 text-white px-4 py-2 rounded-lg">Try Again</a></div>`;
    }
}

// ... (Rest of your file: populatePage, setupTabInteractions, handlePdfDownload, etc. remains exactly the same) ...
// Copy the rest of the functions from your previous file starting from "function populatePage" downwards.
// OR just paste the logic above into the top of your existing file.

// --- Helper for PDF Download (Ensure this is in your file) ---
function populatePage(lessonPlan, imageUrl, topic) {
    const mainContent = document.getElementById('main-content');

    const headerHtml = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-gray-700">
            <div>
                <h2 class="text-3xl font-bold" id="lesson-title">Topic: ${topic}</h2>
                <p class="mt-1 text-gray-400">This plan includes new and classic resources to explore ${topic}.</p>
            </div>
            
            <div class="relative mt-4 sm:mt-0 group" id="pdf-dropdown-container">
                <button class="flex items-center text-sm bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md shadow-lg transition-all">
                    <span class="material-symbols-outlined mr-2">picture_as_pdf</span> Download PDF
                    <span class="material-symbols-outlined ml-1 text-sm">expand_more</span>
                </button>
                <div class="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-xl z-50 hidden group-hover:block border border-gray-700">
                    <button id="pdf-text-only" class="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-purple-600 hover:text-white rounded-t-md transition-colors flex items-center">
                        <span class="material-symbols-outlined text-base mr-2">description</span> Text Only
                    </button>
                    <button id="pdf-with-images" class="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-purple-600 hover:text-white rounded-b-md transition-colors flex items-center">
                        <span class="material-symbols-outlined text-base mr-2">image</span> With Images
                    </button>
                </div>
            </div>
        </div>
    `;
    
    for (const tabKey in lessonPlan) {
        if (tabKey === 'imagePrompt') continue;

        const tabContentContainer = document.getElementById(`${tabKey}-content`);
        if (tabContentContainer) {
            const tabData = lessonPlan[tabKey];
            let tagsHtml = '<div class="flex items-center flex-wrap gap-2 mb-6 tag-group">';
            let contentHtml = '';
            let isFirstTag = true;

            for (const contentKey in tabData) {
                const title = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                tagsHtml += `<button class="tag text-sm font-medium px-3 py-1 rounded-full cursor-pointer transition-colors duration-200 bg-purple-800/50 text-purple-200 hover:bg-purple-700 ${isFirstTag ? 'active-tag' : ''}" data-content-id="${tabKey}-${contentKey}">${title}</button>`;
                
                let body = tabData[contentKey];
                if (tabKey === 'classicResources' && Array.isArray(body)) {
                    body = `<ul class="list-disc list-inside space-y-2">${body.map(item => {
                        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(item)}`;
                        return `<li><a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="text-purple-400 hover:underline">${item}</a></li>`;
                    }).join('')}</ul>`;
                } else if (Array.isArray(body)) {
                    body = `<ul class="list-disc list-inside space-y-2">${body.map(item => `<li>${item}</li>`).join('')}</ul>`;
                }

                contentHtml += `
                    <div id="${tabKey}-${contentKey}" class="tag-content ${isFirstTag ? 'active-tag-content' : ''}">
                        <div class="prose prose-invert max-w-none text-gray-300">${body.replace(/\n/g, '<br>')}</div>
                        <div class="mt-6 pt-4 border-t border-gray-700 text-right">
                            <button class="share-btn flex items-center text-sm bg-transparent hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500 font-medium py-2 px-3 rounded-md transition-colors duration-200" data-category="${title}">
                                <span class="material-symbols-outlined mr-2">groups</span> Share to Hub
                            </button>
                        </div>
                    </div>
                `;
                isFirstTag = false;
            }
            tagsHtml += '</div>';
            tabContentContainer.innerHTML = headerHtml + tagsHtml + contentHtml;
        }
    }
    setupActionButtons();
    mainContent.style.display = 'block';
    loader.style.display = 'none';
}

function setupTabInteractions() {
    const tabs = document.querySelectorAll('#tabs-navigation a');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            tabs.forEach(item => item.classList.remove('active-tab'));
            tabContents.forEach(content => content.classList.remove('active-tab-content'));
            
            tab.classList.add('active-tab');
            const tabId = tab.dataset.tab;
            document.getElementById(`${tabId}-content`).classList.add('active-tab-content');
        });
    });
}

function setupActionButtons() {
    document.getElementById('pdf-text-only')?.addEventListener('click', () => handlePdfDownload(false));
    document.getElementById('pdf-with-images')?.addEventListener('click', () => handlePdfDownload(true));

    document.querySelectorAll('.tag-group .tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const parentGroup = tag.closest('.tag-group');
            parentGroup.querySelectorAll('.tag').forEach(t => t.classList.remove('active-tag'));
            tag.classList.add('active-tag');
            
            const contentId = tag.dataset.contentId;
            const parentTabContent = tag.closest('.tab-content');
            parentTabContent.querySelectorAll('.tag-content').forEach(c => c.classList.remove('active-tag-content'));
            document.getElementById(contentId).classList.add('active-tag-content');
        });
    });

    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', handleShareToHub);
    });
}

async function handlePdfDownload(includeImages) {
    if (!currentLessonData) return alert('Lesson data not available.');
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    let y = 15;
    const margin = 10;
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();

    const addText = (text, size, weight) => {
        doc.setFontSize(size).setFont(undefined, weight);
        const splitText = doc.splitTextToSize(text, maxWidth);
        const textHeight = doc.getTextDimensions(splitText).h;
        
        if (y + textHeight > pageHeight - margin) {
            doc.addPage();
            y = 15;
        }
        doc.text(splitText, margin, y);
        y += textHeight + 4;
    };

    addText(`Topic: ${currentTopic}`, 20, 'bold');
    y += 5;

    for (const tabKey in currentLessonData) {
        if (tabKey === 'imagePrompt') continue;
        const tabTitle = tabKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        if (y + 10 > pageHeight - margin) { doc.addPage(); y = 15; }
        y += 2;
        doc.setDrawColor(150); 
        doc.line(margin, y, margin + maxWidth, y); 
        y += 7;
        
        addText(tabTitle, 16, 'bold');
        
        for (const contentKey in currentLessonData[tabKey]) {
            const contentTitle = contentKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            addText(contentTitle, 13, 'bold');
            
            let body = currentLessonData[tabKey][contentKey];
            if (Array.isArray(body)) {
                body.forEach(item => addText(`• ${item}`, 11, 'normal'));
            } else {
                addText(body, 11, 'normal');
            }
            y += 2;
        }
        y += 5;
    }

    if (includeImages) {
        const visibleImages = Array.from(document.querySelectorAll('#image-gallery-grid img'))
            .filter(img => !img.classList.contains('hidden') && img.src);
        
        if (visibleImages.length > 0) {
            doc.addPage();
            y = 15;
            addText("Visual Gallery", 20, 'bold');
            y += 5;

            for (const img of visibleImages) {
                try {
                    const base64Img = await getBase64FromImage(img);
                    const imgProps = doc.getImageProperties(base64Img);
                    const imgWidth = maxWidth; 
                    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                    if (y + imgHeight > pageHeight - margin) {
                        doc.addPage();
                        y = 15;
                    }

                    doc.addImage(base64Img, 'JPEG', margin, y, imgWidth, imgHeight);
                    y += imgHeight + 5;
                    if (img.alt) {
                        doc.setFontSize(10).setFont(undefined, 'italic');
                        doc.text(img.alt, margin, y);
                        y += 8;
                    }
                    y += 5; 

                } catch (err) {
                    console.error("Could not add image to PDF", err);
                }
            }
        }
    }

    doc.save(`${currentTopic}_Plan.pdf`);
}

function getBase64FromImage(imgElement) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgElement, 0, 0);
        try {
            const dataURL = canvas.toDataURL("image/jpeg");
            resolve(dataURL);
        } catch (error) {
            reject(error);
        }
    });
}

async function handleShareToHub(event) {
    const button = event.currentTarget;
    const originalContent = button.innerHTML;
    const contentToShare = button.closest('.tag-content').querySelector('.prose').innerHTML;
    const category = button.dataset.category;

    if (!currentUserSession) return alert('You must be logged in to share.');

    button.disabled = true;
    button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mx-auto"></div>`;

    const { error } = await supabase.from('CommunityHub').insert([{
        user_id: currentUserSession.user.id,
        user_name: currentUserSession.user.user_metadata?.full_name || currentUserSession.user.email,
        topic: currentTopic,
        category: category,
        content: contentToShare,
    }]);

    if (error) {
        alert('Error sharing to hub: ' + error.message);
        button.innerHTML = originalContent;
        button.disabled = false;
    } else {
        button.innerHTML = `<span class="material-symbols-outlined mr-2">check_circle</span> Shared!`;
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.disabled = false;
        }, 2500);
    }
}

function setupImageTab(topic, lessonPlan) {
    const galleryContainer = document.getElementById('image-gallery-grid');
    if (!galleryContainer) return;
    galleryContainer.innerHTML = '';

    const createCard = (title, type, promptContext) => {
        const uniqueId = Math.random().toString(36).substr(2, 9);
        const cardHtml = `
            <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg flex flex-col">
                <div class="p-4 border-b border-gray-700 bg-gray-900/50">
                    <span class="text-xs font-bold uppercase text-purple-400 tracking-wider">${type}</span>
                    <h4 class="text-lg font-bold text-white mt-1">${title}</h4>
                </div>
                <div class="p-4 flex-grow flex flex-col items-center justify-center min-h-[300px] bg-black/20 relative">
                    <div id="start-${uniqueId}" class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                        <p class="text-gray-500 text-sm mb-4 line-clamp-3 italic">"${promptContext.substring(0, 80)}..."</p>
                        <button id="btn-${uniqueId}" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full font-medium transition shadow-lg flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">auto_awesome</span> Generate Visual
                        </button>
                    </div>
                    <div id="loader-${uniqueId}" class="hidden absolute inset-0 bg-gray-900 flex-col items-center justify-center z-20">
                        <div class="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mb-3"></div>
                        <p class="text-xs text-purple-300 animate-pulse">Painting...</p>
                    </div>
                    <img id="img-${uniqueId}" crossorigin="anonymous" class="hidden w-full h-full object-cover z-30 transition-opacity duration-500" alt="${title} - ${type}" />
                    <a id="down-${uniqueId}" class="hidden absolute bottom-2 right-2 bg-black/70 hover:bg-black text-white p-2 rounded-full z-40 cursor-pointer" title="Download">
                        <span class="material-symbols-outlined text-sm">download</span>
                    </a>
                </div>
            </div>
        `;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml;
        galleryContainer.appendChild(tempDiv.firstElementChild);

        const btn = document.getElementById(`btn-${uniqueId}`);
        const loader = document.getElementById(`loader-${uniqueId}`);
        const img = document.getElementById(`img-${uniqueId}`);
        const startDiv = document.getElementById(`start-${uniqueId}`);
        const downloadBtn = document.getElementById(`down-${uniqueId}`);

        btn.addEventListener('click', () => {
            startDiv.classList.add('hidden');
            loader.classList.remove('hidden');
            const seed = Math.floor(Math.random() * 1000000);
            const specificPrompt = encodeURIComponent(`educational illustration for ${type}: ${promptContext.substring(0, 100)}, ${topic}, children's book style, clear, colorful`);
            const imageUrl = `https://image.pollinations.ai/prompt/${specificPrompt}?width=768&height=768&seed=${seed}&nologo=true&model=flux`;
            
            img.src = imageUrl;
            img.onload = () => {
                loader.classList.add('hidden');
                img.classList.remove('hidden');
                downloadBtn.classList.remove('hidden');
                downloadBtn.href = imageUrl;
                downloadBtn.download = `${type}_${seed}.jpg`;
            };
            img.onerror = () => {
                loader.classList.add('hidden');
                startDiv.classList.remove('hidden');
                alert("Generation failed. Try again.");
            };
        });
    };

    createCard(topic, "Lesson Cover", `A cover image representing ${topic}`);
    if (lessonPlan.newlyCreatedContent) {
        Object.entries(lessonPlan.newlyCreatedContent).forEach(([key, content]) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('rhyme') || lowerKey.includes('poem')) createCard("Nursery Rhyme", "Rhyme", content);
            if (lowerKey.includes('story') || lowerKey.includes('narrative')) createCard("Short Story", "Story", content);
        });
    }
    if (lessonPlan.newActivities) {
        Object.entries(lessonPlan.newActivities).forEach(([key, content]) => {
            const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const promptText = Array.isArray(content) ? content.join(" ") : content;
            createCard(title, "Activity", promptText);
        });
    }
}