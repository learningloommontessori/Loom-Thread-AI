import getSupabase from './supabaseClient.js';

// ** ADMIN CONFIGURATION **
// Ensure these are all lowercase for consistent matching
const ADMIN_EMAILS = [
    "monika.pathak@choithramschool.com",
    "vip.pathak.ai@gmail.com", 
    "learningloom.montessori@gmail.com"
];

// --- Helper Functions ---
function showMessage(type, text) {
    const errorContainer = document.getElementById('error-message');
    const successContainer = document.getElementById('success-message');
    const errorText = document.getElementById('error-text');
    const successText = document.getElementById('success-text');

    if(errorContainer) errorContainer.classList.add('hidden');
    if(successContainer) successContainer.classList.add('hidden');

    if (type === 'error' && errorContainer && errorText) {
        errorText.textContent = text;
        errorContainer.classList.remove('hidden');
    } else if (type === 'success' && successContainer && successText) {
        successText.textContent = text;
        successContainer.classList.remove('hidden');
    }
}

function setLoadingState(form, isLoading) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const buttonText = submitButton.querySelector('.button-text');
    const spinner = submitButton.querySelector('.button-spinner');

    submitButton.disabled = isLoading;
    if (buttonText) buttonText.classList.toggle('hidden', isLoading);
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
}

// --- Main Authentication Logic ---
async function handlePageAuth() {
    const supabase = await getSupabase();
    if (!supabase) {
        showMessage('error', 'Failed to connect to authentication service.');
        return;
    }

    // --- 1. GLOBAL GATEKEEPER CHECK (Runs on page load) ---
    const { data: { session } } = await supabase.auth.getSession();
    const isAuthPage = window.location.pathname.includes('/sign-in.html') || window.location.pathname.includes('/sign-up.html');

    if (session) {
        const userEmail = session.user.email.toLowerCase();
        
        // Fetch Profile Status
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_approved')
            .eq('id', session.user.id)
            .single();

        const isAdmin = ADMIN_EMAILS.includes(userEmail);
        const isApproved = profile && profile.is_approved;

        if (!isAdmin && !isApproved) {
            // LOGGED IN BUT NOT APPROVED -> KICK OUT
            await supabase.auth.signOut();
            if (!isAuthPage) {
                alert("Access Denied: Your account is pending approval.");
                window.location.href = '/sign-in.html';
            }
        } else if (isAuthPage) {
            // LOGGED IN AND APPROVED -> GO TO DASHBOARD
            window.location.replace('/dashboard.html');
            return;
        }

        // --- 5. INJECT ADMIN LINK (Only if Logged In & Admin) ---
        if (isAdmin) {
            // Try to find the Logout button container to inject the link before it
            const logoutBtn = document.getElementById('logoutButton');
            
            if (logoutBtn && logoutBtn.parentElement) {
                // Prevent duplicate buttons
                if (!document.getElementById('admin-link-item')) {
                    const adminLink = document.createElement('a');
                    adminLink.id = 'admin-link-item';
                    adminLink.href = '/admin-panel.html';
                    adminLink.className = "flex items-center px-4 py-2 text-sm text-yellow-400 hover:bg-purple-600 hover:text-white transition-colors cursor-pointer";
                    adminLink.innerHTML = `<span class="material-symbols-outlined mr-3">admin_panel_settings</span> Admin Panel`;
                    
                    // Insert it before the Logout button in the menu
                    logoutBtn.parentElement.insertBefore(adminLink, logoutBtn);
                }
            }
        }
    }

    // --- 2. GOOGLE SIGN IN ---
    const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/dashboard.html` }
            });
            if (error) showMessage('error', 'Google Sign-In failed: ' + error.message);
        });
    }

    // --- 3. MANUAL SIGN IN (With Gatekeeper) ---
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setLoadingState(signInForm, true);
            
            const email = signInForm.email.value.trim().toLowerCase();
            const password = signInForm.password.value;
            
            // A. Attempt Login
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) {
                showMessage('error', error.message);
                setLoadingState(signInForm, false);
                return;
            }

            // B. Gatekeeper Check
            const isAdmin = ADMIN_EMAILS.includes(email);
            
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('is_approved')
                .eq('id', data.user.id)
                .single();

            if (!isAdmin) {
                // If profile missing OR not approved
                if (profileError || !profile || !profile.is_approved) {
                    await supabase.auth.signOut(); // Kick out immediately
                    showMessage('error', 'Access Denied. Your account is pending Admin approval.');
                    setLoadingState(signInForm, false);
                    return;
                }
            }

            // C. Success
            window.location.replace('/dashboard.html');
        });
    }

   // --- 4. SIGN UP (With Unique ID Check) ---
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = signUpForm.email.value.trim().toLowerCase();
            const password = signUpForm.password.value;
            const fullName = signUpForm['full-name'].value;
            // Get the Unique ID
            const employeeId = document.getElementById('employee-id').value.trim().toUpperCase();

            setLoadingState(signUpForm, true);

            // A. CHECK UNIQUE ID
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('id')
                .eq('employee_id', employeeId)
                .single();

            if (existingUser) {
                showMessage('error', 'This ID is already registered to another account.');
                setLoadingState(signUpForm, false);
                return;
            }

            // B. Create Auth User
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName, employee_id: employeeId },
                    emailRedirectTo: `${window.location.origin}/dashboard.html`
                }
            });

            if (error) {
                showMessage('error', error.message);
            } else {
                // C. Create Profile
                if (data.user) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .insert([{ 
                            id: data.user.id, 
                            email: email, 
                            full_name: fullName,
                            employee_id: employeeId, // <--- Saving Unique ID
                            is_approved: false, 
                            is_admin: false
                        }]);
                    
                    if(profileError && profileError.code === '23505') {
                        showMessage('error', 'This ID is already in use.');
                        setLoadingState(signUpForm, false);
                        return;
                    }
                }

                showMessage('success', 'Account created! Please wait for Admin approval.');
                signUpForm.reset();
                const submitButton = signUpForm.querySelector('button[type="submit"]');
                if(submitButton) submitButton.disabled = true;
            }
            setLoadingState(signUpForm, false);
        });
    }
}

// Run the logic
handlePageAuth();