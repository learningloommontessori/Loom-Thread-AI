// js/collective-loom.js
import getSupabase from './supabaseClient.js';
let supabase;
let currentUserId;

document.addEventListener('DOMContentLoaded', async () => {
    supabase = await getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    const user = session.user;
    currentUserId = user.id;
    const userName = user.user_metadata?.full_name || user.email;

    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
        welcomeMessage.classList.remove('hidden');
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/';
        });
    }

    fetchAndDisplayPosts();

    const searchInput = document.getElementById('search-input');
    const ageFilter = document.getElementById('age-filter');

    const runFilters = () => {
        const searchText = searchInput ? searchInput.value : '';
        const ageValue = ageFilter ? ageFilter.value : 'all';
        filterPosts(searchText, ageValue);
    };

    if(searchInput) searchInput.addEventListener('input', runFilters);
    if(ageFilter) ageFilter.addEventListener('change', runFilters);
    
    setupModalListeners();
});

async function fetchAndDisplayPosts() {
    const grid = document.getElementById('community-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');

    loader.style.display = 'flex';
    grid.innerHTML = '';
    grid.style.display = 'none';
    emptyState.style.display = 'none';

    let { data: posts, error } = await supabase
        .from('CommunityHub')
        .select('*')
        .order('created_at', { ascending: false });

    loader.style.display = 'none';

    if (error) {
        console.error('Error fetching posts:', error);
        grid.innerHTML = `<p class="text-red-400 col-span-full text-center">Could not fetch community posts. Please try again later.</p>`;
        grid.style.display = 'block';
        return;
    }

    if (!posts || posts.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        grid.style.display = 'grid';
        window.communityPosts = new Map(posts.map(p => [p.post_id, p]));
        const postCards = posts.map(post => createPostCard(post)).join('');
        grid.innerHTML = postCards;
        attachCardListeners();
    }
}

function toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function createPostCard(post) {
    const formattedDate = new Date(post.created_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
    
    const ageGroup = post.age || 'General';
    const categories = post.category ? post.category.split(',') : ['General'];
    
    const categoryTags = categories.map(cat => `
        <span class="inline-block bg-purple-600/50 text-purple-200 text-xs font-medium px-2.5 py-1 rounded-full border border-purple-500/30">
            ${cat.trim()}
        </span>
    `).join('');

    let actionButtons = `
        <button class="download-btn text-gray-400 hover:text-green-400 transition-colors mr-2" title="Download PDF" data-post-id="${post.post_id}">
            <span class="material-symbols-outlined text-xl">download</span>
        </button>
        <button class="view-btn text-purple-400 hover:text-purple-300 text-sm font-semibold flex items-center" data-post-id="${post.post_id}">
            View More <span class="material-symbols-outlined text-base ml-1">arrow_forward</span>
        </button>
    `;

    if (post.user_id === currentUserId) {
        actionButtons = `
            <button class="delete-btn text-gray-400 hover:text-red-500 transition-colors mr-2" title="Delete Post" data-post-id="${post.post_id}">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        ` + actionButtons;
    }
    
    const displayTopic = toTitleCase(post.topic);

    return `
        <div class="community-card bg-black/30 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden flex flex-col justify-between p-6 hover:border-purple-500 border border-transparent transition-all duration-300" data-age="${ageGroup}">
            <div>
                <div class="flex flex-wrap items-center gap-2 mb-3">
                    ${categoryTags}
                    <span class="inline-block bg-blue-900/50 text-blue-200 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-500/30 flex items-center">
                        <span class="material-symbols-outlined text-[10px] mr-1">school</span>${ageGroup}
                    </span>
                </div>
                
                <h3 class="text-lg font-bold text-white mb-2 line-clamp-1">${displayTopic}</h3>
                
                <div class="text-gray-300 text-sm space-y-2 prose prose-invert prose-sm max-w-none line-clamp-4 relative">
                    ${post.content}
                    <div class="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-900/10 to-transparent"></div>
                </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                <div>
                    <p class="text-xs text-gray-400">By <span class="font-medium text-purple-300">${post.user_name}</span></p>
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">${formattedDate}</p>
                </div>
                <div class="flex items-center">
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
}

function attachCardListeners() {
    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const postId = e.currentTarget.dataset.postId;
            showPostModal(postId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeletePost);
    });

    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const postId = e.currentTarget.dataset.postId;
            handleDownloadPost(postId);
        });
    });
}

// --- UPGRADED HTML-TO-PDF GENERATOR ---
async function handleDownloadPost(postId) {
    const post = window.communityPosts.get(postId);
    if (!post) return;

    if (!window.jspdf) return alert("PDF Library not loaded. Please refresh the page.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    // Smart Text Adder (handles page breaks)
    const addText = (text, size, weight, color, indent = 0) => {
        if (!text) return;
        doc.setFontSize(size);
        doc.setFont(undefined, weight);
        doc.setTextColor(...color);
        
        const splitText = doc.splitTextToSize(text, maxLineWidth - indent);
        const textHeight = doc.getTextDimensions(splitText).h;
        
        if (y + textHeight > 280) {
            doc.addPage();
            y = 20;
        }
        
        doc.text(splitText, margin + indent, y);
        y += textHeight + 2; 
    };

    // 1. Header (Matches History Page Style)
    addText("Shared Lesson Idea", 10, 'normal', [100, 100, 100]);
    addText(toTitleCase(post.topic), 22, 'bold', [102, 51, 153]); // Purple Title
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
    y += 12;

    addText(`Shared By: ${post.user_name}`, 11, 'italic', [80, 80, 80]);
    addText(`Age Group: ${post.age || 'General'}`, 11, 'normal', [80, 80, 80]);
    y += 10;

    // 2. Recursive HTML Parser
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content;

    const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text && text.length > 1) { // Avoid stray characters
                // Fallback for loose text
                addText(text, 11, 'normal', [50, 50, 50]);
                y += 2;
            }
            return;
        }

        const tagName = node.tagName;

        // ** Section Header (e.g., New Activities) **
        if (tagName === 'H4') {
            y += 6;
            // Draw background bar like history PDF
            doc.setFillColor(245, 245, 255);
            doc.rect(margin, y - 5, maxLineWidth, 10, 'F');
            
            // Clean up title (remove icon names like 'music_note')
            let title = node.innerText.replace(/^[a-z_]+\s/i, '').trim();
            addText(title, 14, 'bold', [50, 0, 100]); // Purple header
            y += 2;
        }
        // ** Sub-Activity Header (e.g., Art Craft) **
        else if (tagName === 'H5') {
            y += 4;
            addText(node.innerText.trim(), 12, 'bold', [0, 0, 0]); // Bold Black
            y += 1;
        }
        // ** Paragraphs **
        else if (tagName === 'P') {
            addText(node.innerText.trim(), 11, 'normal', [50, 50, 50]);
            y += 3;
        }
        // ** Lists **
        else if (tagName === 'UL') {
            Array.from(node.children).forEach(li => {
                if(li.tagName === 'LI') {
                    addText(`• ${li.innerText.trim()}`, 11, 'normal', [50, 50, 50], 5); // Indent
                    y -= 1; // Tighter list spacing
                }
            });
            y += 3;
        }
        // ** Images (Skip them for text PDF to keep it clean) **
        else if (tagName === 'IMG' || tagName === 'FIGURE') {
            // Optional: You could add logic here to extract alt text or ignore
        }
        // ** Recursion for Divs/Spans **
        else if (node.childNodes.length > 0) {
            node.childNodes.forEach(child => processNode(child));
        }
    };

    // Process the bundled content items
    const items = tempDiv.querySelectorAll('.shared-item');
    if(items.length > 0){
        items.forEach(item => {
            // Process the H4 inside shared-item directly first to ensure header styling
            const header = item.querySelector('h4');
            if(header) processNode(header);

            // Process the content div
            const body = item.querySelector('div');
            if(body) {
                body.childNodes.forEach(child => processNode(child));
            }
            y += 5; // Spacing between bundled items
        });
    } else {
        // Fallback for single/legacy posts
        Array.from(tempDiv.childNodes).forEach(child => processNode(child));
    }

    // 3. Footer
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} - Loom Play AI`, pageWidth / 2, 290, { align: 'center' });
    }

    doc.save(`${toTitleCase(post.topic).replace(/\s+/g, '_')}_LoomIdea.pdf`);
}

async function handleDeletePost(event) {
    const button = event.currentTarget;
    const card = button.closest('.community-card');
    const postId = button.dataset.postId;

    if (window.confirm('Are you sure you want to permanently delete this shared post?')) {
        const { error } = await supabase
            .from('CommunityHub')
            .delete()
            .eq('post_id', postId);

        if (error) {
            console.error('Error deleting post:', error);
            alert('Failed to delete post: ' + error.message);
        } else {
            card.remove(); 
            if (document.querySelectorAll('.community-card').length === 0) {
                 document.getElementById('community-grid').style.display = 'none';
                 document.getElementById('empty-state').style.display = 'flex';
            }
        }
    }
}

function showPostModal(postId) {
    const post = window.communityPosts.get(postId);
    if (!post) return;

    const displayTopic = toTitleCase(post.topic);
    document.getElementById('modal-title').textContent = `${displayTopic}`;
    
    document.getElementById('modal-content').innerHTML = post.content;
    document.getElementById('post-modal').classList.remove('hidden');
}

function setupModalListeners() {
    const modal = document.getElementById('post-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('modal-close-btn');
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'post-modal') {
            modal.classList.add('hidden');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });
}

function filterPosts(searchTerm, ageFilter) {
    const term = searchTerm.toLowerCase();
    const selectedAge = ageFilter.toLowerCase(); 

    const cards = document.querySelectorAll('.community-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const content = card.querySelector('.prose').textContent.toLowerCase();
        const authorElement = card.querySelector('.font-medium.text-purple-300');
        const authorName = authorElement ? authorElement.textContent.toLowerCase() : '';
        const isTextMatch = title.includes(term) || content.includes(term) || authorName.includes(term);
        const cardAge = card.dataset.age.toLowerCase(); 
        const isAgeMatch = (selectedAge === 'all') || cardAge.includes(selectedAge);

        if (isTextMatch && isAgeMatch) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const emptyState = document.getElementById('empty-state');
    const grid = document.getElementById('community-grid');
    
    if (visibleCount === 0 && cards.length > 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        emptyState.querySelector('h3').textContent = 'No Matches Found';
        emptyState.querySelector('p').textContent = 'Try adjusting your filters.';
    } else if (cards.length > 0) {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
    }
}