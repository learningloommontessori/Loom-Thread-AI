// js/reset-password.js

import getSupabase from './supabaseClient.js';
let supabase;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Reset Password script loaded.');
    try {
        supabase = await getSupabase();
        console.log('Supabase client initialized successfully.');
    } catch (e) {
        console.error('Failed to initialize Supabase client:', e);
        return;
    }

    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if (forgotPasswordForm) {
        console.log('Forgot Password form found. Attaching listener.');
        handleForgotPasswordPage(forgotPasswordForm);
    }

    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
        console.log('Reset Password form found. Setting up auth state change listener.');
        handleResetPasswordPage(resetPasswordForm);
    }
});

function handleForgotPasswordPage(form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('Forgot Password form submitted.');
        
        const email = form.email.value;
        const button = form.querySelector('button[type="submit"]');
        
        setLoading(button, true);
        console.log(`Attempting to send reset link to: ${email}`);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html',
        });
        
        setLoading(button, false);

        if (error) {
            console.error('Supabase error on resetPasswordForEmail:', error);
            showError(error.message);
        } else {
            console.log('Successfully requested password reset link.');
            showSuccess('Password reset link has been sent to your email. Please check your inbox.');
        }
    });
}

function handleResetPasswordPage(form) {
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    newPasswordInput.addEventListener('input', checkPasswordStrength);
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    newPasswordInput.addEventListener('input', checkPasswordMatch);

    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'PASSWORD_RECOVERY') {
            console.log('Password recovery event detected. Attaching submit listener to reset form.');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Reset Password form submitted.');
                const password = form['new-password'].value;

                if (password !== form['confirm-password'].value) {
                    showError('Passwords do not match.');
                    return;
                }
                
                const strengthText = document.getElementById('strength-text').textContent;
                if (strengthText === 'Weak' || strengthText === 'Empty') {
                    showError('Password is too weak. Please choose a stronger one.');
                    return;
                }

                const button = form.querySelector('button[type="submit"]');
                setLoading(button, true);
                console.log('Attempting to update user password...');

                const { error } = await supabase.auth.updateUser({ password });

                setLoading(button, false);

                if (error) {
                    console.error('Supabase error on updateUser:', error);
                    showError(error.message);
                } else {
                    console.log('Password updated successfully.');
                    showSuccess('Your password has been reset successfully! You will be redirected to sign in shortly.');
                    setTimeout(() => {
                        window.location.href = '/sign-in.html';
                    }, 4000);
                }
            });
        }
    });
}


// --- Shared UI Functions ---
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
            bar.className = `h-1.sem flex-1 rounded-full bg-gray-700`;
        }
    });
}

function checkPasswordMatch() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const indicator = document.getElementById('match-indicator');
    const confirmInput = document.getElementById('confirm-password');

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
    errorContainer.innerHTML = `<div class="flex items-center"><div class="flex-shrink-0"><span class="material-symbols-outlined text-red-400">error</span></div><div class="ml-3"><p class="text-sm font-medium text-red-300">${message}</p></div></div>`;
    errorContainer.classList.remove('hidden');
    document.getElementById('success-message').classList.add('hidden');
}

function showSuccess(message) {
    const successContainer = document.getElementById('success-message');
    successContainer.innerHTML = `<div class="flex items-center"><div class="flex-shrink-0"><span class="material-symbols-outlined text-green-400">check_circle</span></div><div class="ml-3"><p class="text-sm font-medium text-green-300">${message}</p></div></div>`;
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

