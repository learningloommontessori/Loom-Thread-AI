import getSupabase from './supabaseClient.js';

// ** ADMIN CONFIGURATION **
const ADMIN_EMAILS = [
    "monika.pathak@choithramschool.com",
    "vip.pathak.ai@gmail.com", 
    "learningloom.montessori@gmail.com"
];

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await getSupabase();

    // 1. Check Session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }

    const user = session.user;
    const userEmail = user.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    // 2. ** FETCH PROFILE **
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    // ---------------------------------------------------------------
    // SCENARIO A: MISSING INFORMATION (No Profile OR No Employee ID)
    // ---------------------------------------------------------------
    // LOGIC FIX: Check for 'employee_id' instead of 'mobile'
    if ((!profile || !profile.employee_id) && !isAdmin) {
        showIdModal(supabase, user, profile); // <--- Fixed Function Name
        return; // Stop here
    }

    // ---------------------------------------------------------------
    // SCENARIO B: PENDING USER (Has Profile, Not Approved)
    // ---------------------------------------------------------------
    if (profile && !profile.is_approved && !isAdmin) {
        showPendingScreen(supabase, user);
        return;
    }

    // ---------------------------------------------------------------
    // SCENARIO C: ACCESS GRANTED
    // ---------------------------------------------------------------
    loadDashboardFeatures(supabase, user, isAdmin);
});

// --- HELPER: EMPLOYEE ID MODAL ---
function showIdModal(supabase, user, existingProfile) {
    const modalHtml = `
    <div id="id-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div class="bg-gray-800 rounded-lg shadow-2xl border border-purple-500/30 p-8 w-full max-w-md m-4">
            <h2 class="text-2xl font-bold text-white mb-2">Complete Profile</h2>
            <p class="text-gray-400 mb-6 text-sm">Please enter your School/Employee ID to continue.</p>
            
            <form id="id-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Employee / Student ID</label>
                    <input type="text" id="id-input" required class="w-full bg-gray-700 border border-gray-600 rounded text-white px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g., T-105">
                </div>
                <div id="modal-error" class="text-red-400 text-sm hidden"></div>
                <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors flex justify-center items-center">
                    <span>Save ID</span>
                </button>
            </form>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // FIX: Element IDs must match the HTML above
    const form = document.getElementById('id-form');
    const input = document.getElementById('id-input');
    const errorMsg = document.getElementById('modal-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const employeeId = input.value.trim().toUpperCase(); // Normalize ID
        const submitBtn = form.querySelector('button');
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin material-symbols-outlined text-sm">progress_activity</span>';

        // 1. Check for Duplicate ID (FIX: Check 'employee_id' column)
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('employee_id', employeeId) 
            .single();

        // Allow if it's their own ID (e.g. they are updating it)
        if (existing && existing.id !== user.id) {
            errorMsg.textContent = "This Employee ID is already registered to another user.";
            errorMsg.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = "Save ID";
            return;
        }

        let error;

        // 2. SAVE LOGIC (Update vs Insert)
        if (existingProfile) {
            // ** UPDATE EXISTING USER **
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ employee_id: employeeId })
                .eq('id', user.id);
            error = updateError;
        } else {
            // ** INSERT NEW USER **
            const { error: insertError } = await supabase
                .from('profiles')
                .insert([{
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata.full_name || user.email.split('@')[0],
                    employee_id: employeeId,
                    is_approved: false,
                    is_admin: false
                }]);
            error = insertError;
        }

        if (error) {
            errorMsg.textContent = "Error: " + error.message;
            errorMsg.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = "Save ID";
        } else {
            // Success! Reload to proceed
            window.location.reload();
        }
    });
}

// --- HELPER: PENDING SCREEN ---
function showPendingScreen(supabase, user) {
    document.body.innerHTML = `
        <div class="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
            <div class="bg-gray-800 p-8 rounded-lg shadow-2xl border border-yellow-600/50 max-w-md">
                <span class="material-symbols-outlined text-6xl text-yellow-500 mb-4">hourglass_top</span>
                <h2 class="text-2xl font-bold text-white mb-2">Approval Pending</h2>
                <p class="text-gray-300 mb-6">
                    Thanks for joining, <span class="text-white font-semibold">${user.user_metadata.full_name || user.email}</span>!
                    <br><br>Your account is waiting for Admin approval.
                </p>
                <button id="logoutBtn" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full transition-colors">Sign Out</button>
            </div>
        </div>
    `;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    });
}

// --- HELPER: LOAD DASHBOARD FEATURES ---
function loadDashboardFeatures(supabase, user, isAdmin) {
    // 1. Personalization
    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const welcomeMsg = document.getElementById('welcome-message');
    const mainTitle = document.getElementById('user-name-main');
    
    if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${userName.split(' ')[0]}!`;
    if (mainTitle) mainTitle.textContent = `Welcome, ${userName}`;

    // 2. Logout Logic
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/index.html';
        });
    }

    // 3. Admin Link Injection
    if (isAdmin && logoutBtn && logoutBtn.parentElement && !document.getElementById('admin-link-item')) {
        const adminLink = document.createElement('a');
        adminLink.id = 'admin-link-item';
        adminLink.href = '/admin-panel.html';
        adminLink.className = "flex items-center px-4 py-3 text-sm text-yellow-400 hover:bg-purple-600 hover:text-white transition-colors cursor-pointer";
        adminLink.innerHTML = `<span class="material-symbols-outlined mr-3">admin_panel_settings</span> Admin Panel`;
        
        logoutBtn.parentElement.insertBefore(adminLink, logoutBtn);
    }
}