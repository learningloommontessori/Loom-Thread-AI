// js/history.js
import getSupabase from './supabaseClient.js';
let supabase;

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    
    // 1. Auth Check
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;

    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('welcome-message').classList.remove('hidden');
    
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
    
    // 2. Load Data
    fetchAndDisplayLessons(user.id);

    // 3. Setup Filter Listeners
    const searchInput = document.getElementById('search-input');
    const ageFilter = document.getElementById('age-filter');

    const runFilters = () => {
        const searchText = searchInput ? searchInput.value : '';
        const ageValue = ageFilter ? ageFilter.value : 'all';
        filterLessons(searchText, ageValue);
    };

    if(searchInput) searchInput.addEventListener('input', runFilters);
    if(ageFilter) ageFilter.addEventListener('change', runFilters);

    setupModalListeners();
});

async function fetchAndDisplayLessons(userId) {
    const grid = document.getElementById('history-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');

    loader.style.display = 'flex';
    grid.innerHTML = '';
    emptyState.style.display = 'none';

    // Fetch necessary fields
    let { data: lessons, error } = await supabase
        .from('AIGeneratedContent')
        .select('id, created_at, topic, language, age')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    loader.style.display = 'none';

    if (error) {
        console.error('Error fetching lessons:', error);
        grid.innerHTML = `<p class="text-red-400 col-span-full">Error loading history.</p>`;
        return;
    }

    if (!lessons || lessons.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        emptyState.querySelector('h3').textContent = "No Lessons Yet";
    } else {
        grid.style.display = 'grid';
        grid.innerHTML = lessons.map(lesson => createLessonCard(lesson)).join('');
        attachCardListeners();
    }
}

function createLessonCard(lesson) {
    const formattedDate = new Date(lesson.created_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
    
    const language = lesson.language || 'English';
    const ageGroup = lesson.age || 'General';

    return `
        <div class="lesson-card bg-black/30 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden flex flex-col justify-between border border-transparent hover:border-purple-500 transition-all duration-300" data-lesson-id="${lesson.id}" data-topic="${lesson.topic}" data-age="${ageGroup}">
            <div class="p-6">
                <h3 class="text-xl font-bold text-white mb-3 line-clamp-2">${lesson.topic}</h3>
                
                <div class="flex flex-wrap gap-2 mb-4">
                    <span class="text-xs font-medium bg-purple-900/60 text-purple-200 px-2 py-1 rounded-full border border-purple-700/50">
                        ${language}
                    </span>
                    <span class="text-xs font-medium bg-blue-900/60 text-blue-200 px-2 py-1 rounded-full border border-blue-700/50 flex items-center">
                        <span class="material-symbols-outlined text-[10px] mr-1">school</span>${ageGroup}
                    </span>
                </div>

                <p class="text-gray-400 text-sm line-clamp-2">Review your generated lesson plan.</p>
            </div>
            
            <div class="px-6 pb-4 pt-2 border-t border-gray-800/50 flex justify-between items-center">
                <span class="text-xs text-gray-500">${formattedDate}</span>
                <div class="flex items-center space-x-1">
                    <button class="download-btn p-2 text-gray-400 hover:text-green-400 transition-colors" title="Download PDF" data-lesson-id="${lesson.id}">
                        <span class="material-symbols-outlined">download</span>
                    </button>
                    
                    <button class="view-btn p-2 text-gray-400 hover:text-white transition-colors" title="View Lesson">
                        <span class="material-symbols-outlined">visibility</span>
                    </button>
                    <button class="share-btn p-2 text-gray-400 hover:text-purple-400 transition-colors" title="Share to Collective Loom">
                        <span class="material-symbols-outlined">groups</span>
                    </button>
                    <button class="delete-btn p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete Lesson">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function attachCardListeners() {
    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', handleViewLesson);
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeleteLesson);
    });
    
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', openShareSelectionModal);
    });

    // New Listener for Download
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const card = e.currentTarget.closest('.lesson-card');
            const lessonId = card.dataset.lessonId;
            handleDownloadLesson(lessonId);
        });
    });
}

// --- NEW PDF DOWNLOAD LOGIC ---
async function handleDownloadLesson(lessonId) {
    if (!window.jspdf) return alert("PDF Library loading... please wait.");

    // Fetch full data for this lesson
    const { data: lesson, error } = await supabase
        .from('AIGeneratedContent')
        .select('*')
        .eq('id', lessonId)
        .single();

    if (error || !lesson) return alert("Could not fetch lesson data.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    const addText = (text, size = 12, weight = 'normal', color = [0, 0, 0]) => {
        if (!text) return;
        doc.setFontSize(size);
        doc.setFont(undefined, weight);
        doc.setTextColor(...color);
        
        const splitText = doc.splitTextToSize(text, maxLineWidth);
        const textHeight = doc.getTextDimensions(splitText).h;
        
        if (y + textHeight > 280) {
            doc.addPage();
            y = 20;
        }
        
        doc.text(splitText, margin, y);
        y += textHeight + 4;
    };

    // 1. Header
    addText("Lesson Plan", 10, 'normal', [100, 100, 100]);
    addText(lesson.topic, 22, 'bold', [102, 51, 153]);
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    addText(`Age Group: ${lesson.age || 'General'}`, 12, 'normal', [60, 60, 60]);
    addText(`Language: ${lesson.language || 'English'}`, 12, 'normal', [60, 60, 60]);
    y += 10;

    // 2. Content Iterator
    const content = lesson.content_json;
    if (content) {
        for (const category in content) {
            if (category === 'imagePrompt') continue;

            // Category Title (e.g., "New Activities")
            const categoryTitle = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            
            // Separator
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFillColor(245, 245, 255);
            doc.rect(margin, y - 5, maxLineWidth, 10, 'F'); // Background bar
            addText(categoryTitle, 14, 'bold', [50, 0, 100]);
            y += 2;

            const subcategories = content[category];
            for (const sub in subcategories) {
                // Subcategory Title (e.g., "Art Craft Activity")
                const subTitle = sub.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                addText(subTitle, 12, 'bold', [0, 0, 0]);

                let body = subcategories[sub];
                if (Array.isArray(body)) {
                    // List
                    body.forEach(item => {
                        addText(`• ${item}`, 11, 'normal', [50, 50, 50]);
                        y -= 2; // Tighter list spacing
                    });
                    y += 4;
                } else {
                    // Paragraph
                    addText(body, 11, 'normal', [50, 50, 50]);
                }
                y += 2;
            }
            y += 5;
        }
    }

    // 3. Footer
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} - Loom Play AI`, pageWidth / 2, 290, { align: 'center' });
    }

    doc.save(`${lesson.topic.replace(/\s+/g, '_')}_LessonPlan.pdf`);
}

// --- SHARE MODAL (Unchanged but included) ---

async function openShareSelectionModal(event) {
    const card = event.currentTarget.closest('.lesson-card');
    const lessonId = card.dataset.lessonId;
    
    const modal = document.getElementById('lesson-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    modal.classList.remove('hidden');
    modalTitle.textContent = "Weave into the Collective Loom";
    modalContent.innerHTML = '<div class="flex justify-center p-8"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div></div>';

    // 1. Fetch Fresh Data
    const { data: lessonData, error } = await supabase
        .from('AIGeneratedContent')
        .select('*')
        .eq('id', lessonId)
        .single();

    if (error || !lessonData) {
        modalContent.innerHTML = `<p class="text-red-400 text-center text-sm">Error loading data.</p>`;
        return;
    }

    // 2. Generate Options
    const options = generateShareableItems(lessonData);

    if (options.length === 0) {
        modalContent.innerHTML = `<p class="text-gray-400 text-center text-sm">No content found.</p>`;
        return;
    }

    // 3. Build Compact UI
    let html = `
        <div class="flex flex-col h-full">
            <p class="text-xs text-gray-400 mb-2 px-1">Select threads to share. Multiple items will be bundled into a single card.</p>
            
            <div class="flex-grow overflow-y-auto pr-1 space-y-2 max-h-[55vh] custom-scrollbar">
    `;

    let currentGroup = '';

    options.forEach((opt, index) => {
        if (opt.group !== currentGroup) {
            currentGroup = opt.group;
            html += `
                <div class="sticky top-0 bg-gray-800/95 backdrop-blur z-10 py-1 px-1 border-b border-gray-700 mb-1 mt-2 first:mt-0">
                    <h5 class="text-[10px] font-bold text-purple-400 uppercase tracking-wider">${currentGroup}</h5>
                </div>
            `;
        }

        html += `
            <label class="flex items-center p-1.5 rounded-md bg-gray-700/20 border border-gray-700/50 hover:bg-gray-700/50 hover:border-purple-500/30 cursor-pointer transition-all group">
                <div class="flex items-center h-full">
                    <input type="checkbox" class="share-checkbox form-checkbox h-3.5 w-3.5 text-purple-600 rounded border-gray-500 bg-gray-800 focus:ring-purple-500 focus:ring-1" value="${index}">
                </div>
                <div class="ml-2.5 flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm ${opt.iconColor}">${opt.icon}</span>
                        <h4 class="text-xs font-medium text-gray-200 group-hover:text-white truncate">${opt.label}</h4>
                    </div>
                    <p class="text-[10px] text-gray-500 line-clamp-1 leading-tight">${opt.preview}</p>
                </div>
            </label>
        `;
    });

    html += `
            </div>
            <div class="pt-3 mt-2 border-t border-gray-700 flex justify-between items-center bg-gray-800 z-20">
                <button id="select-all-btn" class="text-[10px] text-purple-400 hover:text-purple-300 font-medium px-2 uppercase tracking-wide">Select All</button>
                <button id="confirm-share-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-4 rounded text-xs transition-all flex items-center shadow-md disabled:opacity-50">
                    <span class="material-symbols-outlined mr-1.5 text-sm">groups</span> Share Bundle
                </button>
            </div>
        </div>
    `;

    modalContent.innerHTML = html;

    // 4. Attach Listeners
    const checkboxes = modalContent.querySelectorAll('.share-checkbox');
    const confirmBtn = document.getElementById('confirm-share-btn');
    const selectAllBtn = document.getElementById('select-all-btn');

    selectAllBtn.onclick = () => {
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        selectAllBtn.textContent = allChecked ? "Select All" : "Deselect All";
    };

    confirmBtn.onclick = async () => {
        const selectedIndices = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.value));

        if (selectedIndices.length === 0) {
            alert("Select at least one item.");
            return;
        }

        const selectedItems = selectedIndices.map(i => options[i]);
        await executeBatchShare(selectedItems, lessonData, confirmBtn);
    };
}

// Generate the Comprehensive List of Items
function generateShareableItems(lesson) {
    const items = [];
    const json = lesson.content_json;
    if (!json) return items;

    const addTextItem = (group, label, category, content, icon, color) => {
        const text = Array.isArray(content) ? content.join(" ") : content;
        if (!text) return;
        items.push({ group, label, category, content: text, icon, iconColor: color, preview: text.substring(0, 50) });
    };

    // B. Text Content
    addTextItem("Overview", "Full Lesson Plan", "Full Plan", buildLessonHtml(json), "description", "text-white");
    if (json.newlyCreatedContent) {
        if (json.newlyCreatedContent.originalRhyme) addTextItem("Creative Arts", "Original Rhyme", "Rhyme", json.newlyCreatedContent.originalRhyme, "music_note", "text-pink-400");
        if (json.newlyCreatedContent.originalMiniStory) addTextItem("Creative Arts", "Mini Story", "Story", json.newlyCreatedContent.originalMiniStory, "auto_stories", "text-yellow-400");
    }
    if (json.newActivities) {
        Object.entries(json.newActivities).forEach(([key, val]) => {
            const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            addTextItem("Classroom Activities", title, "Activity", val, "extension", "text-blue-400");
        });
    }
    if (json.movementAndMusic) {
        Object.entries(json.movementAndMusic).forEach(([key, val]) => {
            const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            addTextItem("Movement & Music", title, "Movement", val, "directions_run", "text-green-400");
        });
    }
    if (json.socialAndEmotionalLearning) {
        Object.entries(json.socialAndEmotionalLearning).forEach(([key, val]) => {
            const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            addTextItem("Social & Emotional", title, "SEL", val, "diversity_3", "text-orange-400");
        });
    }
    if (json.teacherResources) {
        Object.entries(json.teacherResources).forEach(([key, val]) => {
            const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            addTextItem("Teacher Guide", title, "Resource", val, "menu_book", "text-teal-400");
        });
    }
    
    return items;
}

// Bundle function
async function executeBatchShare(items, lessonData, buttonElement) {
    const originalContent = buttonElement.innerHTML;
    buttonElement.innerHTML = `<span class="animate-spin material-symbols-outlined mr-2 text-sm">progress_activity</span> Bundling...`;
    buttonElement.disabled = true;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session.user;

    const distinctCategories = [...new Set(items.map(i => i.category))];
    const combinedCategoryString = distinctCategories.join(',');

    const combinedContent = items.map(item => `
        <div class="shared-item mb-6">
            <h4 class="text-purple-300 font-bold text-lg mb-2 flex items-center">
                <span class="material-symbols-outlined text-base mr-2">${item.icon}</span> ${item.label}
            </h4>
            <div class="text-gray-300 leading-relaxed">${item.content}</div>
        </div>
        <hr class="border-gray-700 my-4 last:hidden">
    `).join('');

    const { error } = await supabase.from('CommunityHub').insert([{
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email,
        topic: lessonData.topic,
        category: combinedCategoryString, 
        content: combinedContent,
        age: lessonData.age || 'General'
    }]);

    if (error) {
        alert('Share failed: ' + error.message);
        buttonElement.innerHTML = originalContent;
        buttonElement.disabled = false;
    } else {
        buttonElement.innerHTML = `<span class="material-symbols-outlined mr-2 text-sm">check_circle</span> Shared!`;
        buttonElement.classList.replace('bg-purple-600', 'bg-green-600');
        buttonElement.classList.replace('hover:bg-purple-700', 'hover:bg-green-700');
        
        setTimeout(() => {
            document.getElementById('lesson-modal').classList.add('hidden');
        }, 1500);
    }
}


// --- VIEW LESSON LOGIC ---

async function handleViewLesson(event) {
    const card = event.currentTarget.closest('.lesson-card');
    const lessonId = card.dataset.lessonId;
    const topic = card.dataset.topic;

    const modal = document.getElementById('lesson-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');

    modal.classList.remove('hidden');
    modalTitle.textContent = topic;
    modalContent.innerHTML = '<div class="flex justify-center p-8"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div></div>';
    
    const { data, error } = await supabase.from('AIGeneratedContent').select('content_json').eq('id', lessonId).single();

    if (error || !data) {
        modalContent.innerHTML = `<p class="text-red-400 text-center">Could not load lesson details.</p>`;
        return;
    }

    modalContent.innerHTML = buildLessonHtml(data.content_json);
}

function buildLessonHtml(lessonData) {
    let html = '<div class="space-y-6">';
    for (const category in lessonData) {
        if (category === 'imagePrompt') continue;
        const categoryTitle = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        html += `<div class="p-4 bg-gray-800/50 rounded-lg"><h4 class="text-lg font-bold text-purple-300 mb-3 border-b border-gray-700 pb-2">${categoryTitle}</h4><div class="space-y-4">`;
        const subcategories = lessonData[category];
        for (const sub in subcategories) {
            const subTitle = sub.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            let content = subcategories[sub];
            const contentHtml = Array.isArray(content) ? `<ul class="list-disc list-inside text-gray-300 space-y-1">${content.map(item => `<li>${item}</li>`).join('')}</ul>` : `<p class="text-gray-300 leading-relaxed">${content}</p>`;
            html += `<div><h5 class="font-semibold text-white mb-1">${subTitle}</h5>${contentHtml}</div>`;
        }
        html += '</div></div>';
    }
    html += '</div>';
    return html;
}

async function handleDeleteLesson(event) {
    const card = event.currentTarget.closest('.lesson-card');
    const lessonId = card.dataset.lessonId;
    if (window.confirm(`Delete this lesson?`)) {
        const { error } = await supabase.from('AIGeneratedContent').delete().eq('id', lessonId);
        if (!error) {
            card.remove(); 
            const grid = document.getElementById('history-grid');
            if (grid.children.length === 0) {
                grid.style.display = 'none';
                document.getElementById('empty-state').style.display = 'flex';
            }
        }
    }
}

function filterLessons(searchTerm, ageFilter) {
    const term = searchTerm.toLowerCase();
    const selectedAge = ageFilter.toLowerCase();
    const cards = document.querySelectorAll('.lesson-card');
    let visibleCount = 0;
    cards.forEach(card => {
        const topic = card.dataset.topic.toLowerCase();
        const cardAge = card.dataset.age.toLowerCase();
        const isTextMatch = topic.includes(term);
        const isAgeMatch = (selectedAge === 'all') || cardAge.includes(selectedAge);
        if (isTextMatch && isAgeMatch) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    const emptyState = document.getElementById('empty-state');
    const grid = document.getElementById('history-grid');
    if (visibleCount === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
    }
}

function setupModalListeners() {
    const modal = document.getElementById('lesson-modal');
    if (!modal) return;
    const closeBtn = document.getElementById('modal-close-btn');
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target.id === 'lesson-modal' || e.target.id === 'modal-container') modal.classList.add('hidden'); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) modal.classList.add('hidden'); });
}