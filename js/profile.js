import getSupabase from './supabaseClient.js';

// --- Global variables ---
let supabase;
let currentUser;

// --- Helper Functions ---

/**
 * Populates the profile page with user data.
 * @param {object} user - The Supabase user object.
 */
function populateProfile(user) {
    console.log("Populating profile with user data:", user);
    currentUser = user;
    const fullName = user.user_metadata?.full_name || 'Your Name';
    const email = user.email;
    const bio = user.user_metadata?.bio || 'Your bio will appear here.';
    const avatarUrl = user.user_metadata?.avatar_url;

    document.getElementById('profile-name-header').textContent = fullName;
    document.getElementById('profile-email-header').textContent = email;
    document.getElementById('profile-bio-header').textContent = bio;
    document.getElementById('full_name').value = user.user_metadata?.full_name || '';
    document.getElementById('email').value = email;
    document.getElementById('bio').value = user.user_metadata?.bio || '';
    document.getElementById('welcome-message').textContent = `Welcome, ${fullName.split(' ')[0]}!`;

    const memberSinceElement = document.getElementById('member_since');
    if (user.created_at) {
        const joinDate = new Date(user.created_at);
        const formattedDate = joinDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        memberSinceElement.textContent = formattedDate;
    } else {
        memberSinceElement.textContent = 'N/A';
    }

    const profilePic = document.getElementById('profile-pic');
    if (avatarUrl) {
        profilePic.src = `${avatarUrl}?t=${new Date().getTime()}`;
    }
    console.log("Profile population complete.");
}

/**
 * Displays a custom modal for confirmations.
 * @param {string} message - The message to display in the modal.
 * @returns {Promise<boolean>} - A promise that resolves to true if confirmed, false otherwise.
 */
function showConfirmationModal(message) {
    return new Promise((resolve) => {
        const modalHtml = `
            <div id="confirmation-modal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <div class="bg-gray-800 rounded-lg p-8 shadow-xl max-w-sm w-full">
                    <p class="text-white text-lg mb-6">${message}</p>
                    <div class="flex justify-end space-x-4">
                        <button id="modal-cancel" class="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md transition duration-300">Cancel</button>
                        <button id="modal-confirm" class="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-md transition duration-300">Confirm</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');
        const modal = document.getElementById('confirmation-modal');

        const closeModal = (result) => {
            modal.remove();
            resolve(result);
        };

        confirmBtn.onclick = () => closeModal(true);
        cancelBtn.onclick = () => closeModal(false);
    });
}


/**
 * Handles the profile picture upload process.
 */
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentUser) return;

    console.log("Starting avatar upload...");
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar.${fileExt}`;
    const filePath = `${currentUser.id}/${fileName}`;
    const profilePic = document.getElementById('profile-pic');
    const originalSrc = profilePic.src;

    try {
        profilePic.style.opacity = '0.5';
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;
        console.log("Avatar successfully uploaded to storage.");

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        if (!urlData || !urlData.publicUrl) throw new Error("Could not get public URL for avatar.");

        console.log("Public URL retrieved:", urlData.publicUrl);
        const publicUrl = urlData.publicUrl;
        const { data, error: updateError } = await supabase.auth.updateUser({
            data: { avatar_url: publicUrl }
        });

        if (updateError) throw updateError;

        console.log("User metadata updated with new avatar URL.");
        populateProfile(data.user);

    } catch (error) {
        console.error('Error uploading avatar:', error);
        alert('Failed to upload new profile picture. Please try again.');
        profilePic.src = originalSrc;
    } finally {
        profilePic.style.opacity = '1';
    }
}

/**
 * Handles the submission of the profile update form.
 */
async function handleProfileUpdate(event) {
    event.preventDefault();
    const form = event.target;
    const saveButton = form.querySelector('button[type="submit"]');
    const buttonText = saveButton.querySelector('.button-text');
    const spinner = saveButton.querySelector('.button-spinner');
    const successMessage = document.getElementById('success-message');

    buttonText.classList.add('hidden');
    spinner.classList.remove('hidden');
    saveButton.disabled = true;
    successMessage.classList.add('hidden');

    const fullName = form.full_name.value;
    const bio = form.bio.value;

    // ** THE FIX **: Merge new data with existing metadata to prevent overwriting.
    const newMetaData = {
        ...currentUser.user_metadata,
        full_name: fullName,
        bio: bio,
    };

    const { data, error } = await supabase.auth.updateUser({
        data: newMetaData
    });

    buttonText.classList.remove('hidden');
    spinner.classList.add('hidden');
    saveButton.disabled = false;

    if (error) {
        alert('Error updating profile: ' + error.message);
    } else {
        populateProfile(data.user);
        successMessage.classList.remove('hidden');
        setTimeout(() => successMessage.classList.add('hidden'), 3000);
    }
}

/**
 * Handles logging the user out.
 */
async function handleLogout() {
    console.log("Logging out...");
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error logging out:', error);
        alert('Failed to log out. Please try again.');
    } else {
        window.location.href = '/sign-in.html';
    }
}

/**
 * Handles the logic for deleting a user's profile.
 */
async function handleProfileDelete() {
    const confirmed = await showConfirmationModal('Are you sure you want to delete your profile? This action is permanent and cannot be undone.');
    if (confirmed) {
        // Since we cannot securely delete a user from the client-side,
        // we will log them out as a placeholder action.
        console.log("User confirmed profile deletion. Logging out.");
        await handleLogout();
    }
}

// --- Main Execution Block ---

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Profile page script loaded.");
    supabase = await getSupabase();
    if (!supabase) {
        console.error("Supabase client failed to initialize.");
        return;
    }
    console.log("Supabase client initialized.");

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error("Error getting session:", error);
        window.location.href = '/sign-in.html';
        return;
    }
    if (!session) {
        console.log("No active session found. Redirecting to sign in.");
        window.location.href = '/sign-in.html';
        return;
    }

    console.log("Session found:", session);
    populateProfile(session.user);

    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    document.getElementById('delete-profile-btn').addEventListener('click', handleProfileDelete);
    document.getElementById('logoutButton').addEventListener('click', handleLogout);

    const editPicBtn = document.getElementById('edit-pic-btn');
    const avatarInput = document.getElementById('avatar-input');

    editPicBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', handleAvatarUpload);
});


