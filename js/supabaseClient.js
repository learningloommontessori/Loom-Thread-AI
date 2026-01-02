import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.44.2/+esm';

// This variable will hold the Supabase client instance.
let supabase = null;

/**
 * Fetches Supabase credentials from the serverless function and initializes the client.
 * It's designed to run only once.
 * @returns {object|null} The initialized Supabase client or null if an error occurs.
 */
async function getSupabase() {
    // If the client is already initialized, return it to avoid re-initializing.
    if (supabase) {
        return supabase;
    }

    try {
        // Fetch the Supabase URL and anonymous key from our secure API endpoint.
        const response = await fetch('/api/config');
        
        // If the fetch fails (e.g., network error, 404), throw an error.
        if (!response.ok) {
            throw new Error(`Failed to fetch Supabase config: ${response.statusText}`);
        }

        const { url, anon } = await response.json();

        // Check if the URL and key were successfully retrieved.
        if (!url || !anon) {
            throw new Error('Supabase URL or anon key is missing from config.');
        }
        
        // Create the Supabase client instance.
        supabase = createClient(url, anon);
        return supabase;

    } catch (error) {
        // Log the detailed error to the console for debugging.
        console.error('Error initializing Supabase client:', error);
        
        // Return null to indicate that initialization failed.
        return null;
    }
}

// Export the function so it can be imported and used in other scripts.
export default getSupabase;

