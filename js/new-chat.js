// js/new-chat.js
import getSupabase from './supabaseClient.js';

// --- Main Page Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();

    // 1. Check user session and protect the page
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }

    // 2. Personalize header and set up logout
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;
    document.getElementById('welcome-message').textContent = `Welcome, ${userName.split(' ')[0]}!`;
    document.getElementById('welcome-message').classList.remove('hidden');
    document.getElementById('logoutButton').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
    
    // --- Form Handling ---
    const generatorForm = document.getElementById('generator-form');
    const errorMessageContainer = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    const showErrorMessage = (message) => {
        errorText.textContent = message;
        errorMessageContainer.classList.remove('hidden');
    };

  if (generatorForm) {
        generatorForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const topicInput = document.getElementById('topic');
            const topic = topicInput.value.trim();
            
            // Get the selected language
            const selectedLanguage = document.querySelector('input[name="language"]:checked').value;

            // --- NEW: Get the Class Level ---
            const ageGroup = document.getElementById('age-select').value; 

            if (!topic) {
                showErrorMessage("Please enter a topic to continue.");
                return;
            }

            // Save ALL THREE preferences to localStorage
            localStorage.setItem('currentTopic', topic);
            localStorage.setItem('generationLanguage', selectedLanguage);
            localStorage.setItem('selectedAge', ageGroup); // <--- Saving the Class Level!
            
            // Redirect to the generation page
            window.location.href = '/generation-page.html';
        });
    }
});