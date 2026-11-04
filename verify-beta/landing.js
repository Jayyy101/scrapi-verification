// No SDK session, storage, analytics, external assets, raw error text or automatic
// app redirect. Only the fixed project's authoritative GET /user can prove success.
(() => {
    'use strict';
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    let token = fragment.getAll('access_token').length === 1 ? fragment.get('access_token') : null;
    const failed = fragment.has('error') || fragment.has('error_code') || new URLSearchParams(window.location.search).has('error');
    const type = fragment.getAll('type').length === 1 ? fragment.get('type') : null;
    // Clear the complete fragment and query, including refresh tokens and errors.
    // If history is unavailable, fail closed: never use credentials from the URL.
    let scrubbed = false;
    try { window.history.replaceState(null, '', window.location.pathname); scrubbed = true; } catch { token = null; }
    for (const key of [...fragment.keys()]) fragment.delete(key);
    let state = { title: 'Return to Spotroll', text: 'Open the verification link from your email. This page alone does not confirm your email.' };
    const show = () => {
        const title = document.getElementById('title'), status = document.getElementById('status');
        if (title && status) { title.textContent = state.title; status.textContent = state.text; }
    };
    const set = (title, text) => { state = { title, text }; show(); };
    document.addEventListener('DOMContentLoaded', show, { once: true });
    const uncertain = () => set('Verification not confirmed here', 'We could not check your verification status. It may already be complete. Return to Spotroll and try signing in once. If sign-in says your email is unverified, stop and ask for help; do not create another account.');
    if (!scrubbed) { uncertain(); return; }
    if (failed) { token = null; set('This link could not be verified', 'The link may be expired, already used or invalid. Return to Spotroll. If you already verified, sign in with your password. Otherwise, ask for help with verification.'); return; }
    if (!token) return;
    // Only the existing implicit signup-confirmation redirect is supported.
    // A query flag, decoded JWT or a non-signup link is never success evidence.
    if (type !== 'signup' || token.length > 8192 || !/^[A-Za-z0-9_.-]+$/.test(token)) { token = null; uncertain(); return; }
    set('Checking verification…', 'Checking the result securely. You do not need to enter any account details here.');
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error()); }, 10000); });
    const credential = token; token = null;
    void (async () => {
        try {
            // config.json is generated from the same public publishable key as
            // the app; never use a service-role key or a private server credential.
            await Promise.race([deadline, (async () => {
            const configResponse = await fetch('config.json', { cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
            if (!configResponse.ok) throw new Error();
            const config = await configResponse.json();
            if (config.url !== 'https://dibzmisddpqqmjqmtbyu.supabase.co' || typeof config.publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(config.publishableKey)) throw new Error();
            const response = await fetch(config.url + '/auth/v1/user', { method: 'GET', headers: { apikey: config.publishableKey, Authorization: 'Bearer ' + credential }, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
            if (!response.ok) throw new Error();
            const user = await response.json();
            if (typeof user.id !== 'string' || !user.id || typeof user.email_confirmed_at !== 'string' || !Number.isFinite(Date.parse(user.email_confirmed_at))) throw new Error();
            if (controller.signal.aborted) throw new Error();
            })()]);
            set('Email verified', 'Your email verification is confirmed. Return to Spotroll and sign in with your password.');
        } catch { uncertain(); }
        finally { clearTimeout(timer); }
    })();
})();
