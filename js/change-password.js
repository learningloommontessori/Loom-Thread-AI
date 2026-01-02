// js/change-password.js

// ** THE FIX **: Changed to use the getSupabase default export
import getSupabase from './supabaseClient.js';
let supabase;

document.addEventListener('DOMContentLoaded', async () => {
    // ** THE FIX **: Initialize supabase from the imported function
    supabase = await getSupabase();

    // 1. Authentication & User Info
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = '/sign-in.html';
        return;
    }
    const user = session.user;
    const userName = user.user_metadata?.full_name || user.email;

    // Setup header
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome, ${userName.split(' ')[0]}!`;
        welcomeMessage.classList.remove('hidden');
    }
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/';
        });
    }
    
    // 2. Setup form interactions
    const form = document.getElementById('change-password-form');
    if (form) {
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-new-password');

        form.addEventListener('submit', handlePasswordUpdate);
        newPasswordInput.addEventListener('input', checkPasswordStrength);
        confirmPasswordInput.addEventListener('input', checkPasswordMatch);
        newPasswordInput.addEventListener('input', checkPasswordMatch);
    }
});

async function handlePasswordUpdate(event) {
    event.preventDefault();
    const form = event.target;
    const newPassword = form['new-password'].value;
    const confirmPassword = form['confirm-new-password'].value;

    const strengthText = document.getElementById('strength-text').textContent;

    if (newPassword !== confirmPassword) {
        showError('Passwords do not match.');
        return;
    }
    if (strengthText === 'Weak' || strengthText === 'Empty') {
        showError('Password is too weak. Please choose a stronger one.');
        return;
    }

    const button = form.querySelector('button[type="submit"]');
    setLoading(button, true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setLoading(button, false);

    if (error) {
        showError(error.message);
    } else {
        showSuccess('Password updated successfully! For your security, you will be logged out and redirected to the sign-in page.');
        
        // Wait a moment for the user to read the message, then log out and redirect.
        setTimeout(async () => {
            await supabase.auth.signOut();
            window.location.href = '/sign-in.html';
        }, 4000); // 4-second delay
    }
}

function checkPasswordStrength() {
    const password = document.getElementById('new-password').value;
    const strengthText = document.getElementById('strength-text');
    const bars = [
        document.getElementById('strength-bar-1'),
        document.getElementById('strength-bar-2'),
        document.getElementById('strength-bar-3'),
        document.getElementById('strength-bar-4'),
    ];

    let score = 0;
    if (password.length > 0) {
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
    }

    const strengthMap = {
        0: { text: "Empty", color: "bg-gray-700", textColor: "text-gray-500" },
        1: { text: "Weak", color: "bg-red-500", textColor: "text-red-400" },
        2: { text: "Fair", color: "bg-yellow-500", textColor: "text-yellow-400" },
        3: { text: "Good", color: "bg-blue-500", textColor: "text-blue-400" },
        4: { text: "Strong", color: "bg-green-500", textColor: "text-green-400" },
    };
    
    const currentStrength = strengthMap[score];
    strengthText.textContent = currentStrength.text;
    strengthText.className = `font-medium ${currentStrength.textColor}`;

    bars.forEach((bar, index) => {
        if (index < score) {
            bar.className = `h-1.5 flex-1 rounded-full ${currentStrength.color}`;
        } else {
            bar.className = `h-1.5 flex-1 rounded-full bg-gray-700`;
        }
    });
}

function checkPasswordMatch() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const indicator = document.getElementById('match-indicator');
    const confirmInput = document.getElementById('confirm-new-password');

    if (confirmPassword === '' && newPassword === '') {
        indicator.textContent = '';
        confirmInput.classList.remove('border-red-500', 'border-green-500');
        confirmInput.classList.add('border-gray-600');
        return;
    }
    
    if (confirmPassword === '' && newPassword !== '') {
        indicator.textContent = '';
        confirmInput.classList.remove('border-red-500', 'border-green-500');
        confirmInput.classList.add('border-gray-600');
        return;
    }

    if (newPassword === confirmPassword) {
        indicator.textContent = 'check_circle';
        indicator.classList.remove('text-red-500');
        indicator.classList.add('text-green-500');
        confirmInput.classList.remove('border-red-500', 'border-gray-600');
        confirmInput.classList.add('border-green-500');
    } else {
        indicator.textContent = 'cancel';
        indicator.classList.remove('text-green-500');
        indicator.classList.add('text-red-500');
        confirmInput.classList.remove('border-green-500', 'border-gray-600');
        confirmInput.classList.add('border-red-500');
    }
}

function showError(message) {
    const errorContainer = document.getElementById('error-message');
    errorContainer.innerHTML = `<div class="flex"><div class="flex-shrink-0"><span class="material-symbols-outlined text-red-400">error</span></div><div class="ml-3"><p class="text-sm font-medium text-red-300">${message}</p></div></div>`;
    errorContainer.classList.remove('hidden');
    document.getElementById('success-message').classList.add('hidden');
}

function showSuccess(message) {
    const successContainer = document.getElementById('success-message');
    successContainer.innerHTML = `<div class="flex"><div class="flex-shrink-0"><span class="material-symbols-outlined text-green-400">check_circle</span></div><div class="ml-3"><p class="text-sm font-medium text-green-300">${message}</p></div></div>`;
    successContainer.classList.remove('hidden');
    document.getElementById('error-message').classList.add('hidden');
}

function setLoading(button, isLoading) {
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.button-spinner');
    if(buttonText && spinner){
        buttonText.classList.toggle('hidden', isLoading);
        spinner.classList.toggle('hidden', !isLoading);
    }
    button.disabled = isLoading;
}
