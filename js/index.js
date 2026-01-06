// js/index.js
import getSupabase from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Supabase
    const supabase = await getSupabase();

    // 2. CHECK FOR EXISTING SESSION (The Fix)
    // This catches users returning from Google Auth or who are already logged in
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        console.log("Session found, redirecting to dashboard...");
        
        // Optional: You can also double-check approval here if you want strict security
        // preventing unapproved users from even seeing the loading transition.
        /* const { data: profile } = await supabase
            .from('profiles')
            .select('is_approved, is_admin')
            .eq('id', session.user.id)
            .single();
            
        if (!profile?.is_approved && !profile?.is_admin) {
            // If not approved, let them stay on landing or send to a "Wait" page
            // await supabase.auth.signOut(); 
            // return;
        }
        */

        window.location.href = '/dashboard.html';
        return; // Stop the rest of the script (don't setup buttons if leaving)
    }

    // --- STANDARD BUTTON LOGIC (Only runs if NOT logged in) ---
    
    // Function to handle the loading animation and navigation
    const handleNavClick = (event) => {
        event.preventDefault(); 
        
        const button = event.currentTarget;
        const text = button.querySelector('.btn-text');
        const loader = button.querySelector('.btn-loader');
        const destination = button.getAttribute('href'); // Changed to getAttribute for safety

        if (button.style.pointerEvents === 'none') return; // Prevent double clicks

        // Disable button and show loader
        button.style.pointerEvents = 'none';
        if(text) text.style.display = 'none';
        if(loader) loader.style.display = 'inline-block';

        // Wait a short moment before navigating
        setTimeout(() => {
            window.location.href = destination;
        }, 500); 
    };

    const signInBtn = document.getElementById('signin-btn');
    const signUpBtn = document.getElementById('signup-btn');
    const startInspiringBtn = document.getElementById('start-inspiring-btn');

    if (signInBtn) signInBtn.addEventListener('click', handleNavClick);
    if (signUpBtn) signUpBtn.addEventListener('click', handleNavClick);
    if (startInspiringBtn) startInspiringBtn.addEventListener('click', handleNavClick);
});