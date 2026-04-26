// Manages authentication state and all user-related API calls.
// A single singleton instance is shared across the entire app via the module export.
class AuthContext {
    /** @type {{ username: string, email: string | null, emailVerified: boolean } | null} */
    user = $state(null);

    /**
     * @param {string} username
     * @param {string} password
     * @returns {Promise<'ok' | 'wrong_password' | 'not_found' | 'too_many_attempts'>}
     */
    async login(username, password) {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username, password })
        });
        const data = await res.json();
        if (!res.ok) return data.error;
        this.user = data.user;
        return 'ok';
    }

    /**
     * @param {string} username
     * @param {string} password
     * @param {string} email
     * @returns {Promise<'ok' | 'taken' | 'email_taken' | 'invalid_email' | 'weak_password' | 'invalid_username'>}
     */
    async register(username, password, email) {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', username, password, email })
        });
        const data = await res.json();
        if (!res.ok) return data.error;
        this.user = data.user;
        return 'ok';
    }

    /**
     * Always returns 'ok' regardless of outcome — we never reveal whether
     * an email exists to prevent user enumeration attacks.
     * @param {string} email
     * @returns {Promise<'ok'>}
     */
    async requestPasswordReset(email) {
        await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'request_reset', email })
        });
        return 'ok';
    }

    /**
     * @param {string} token
     * @param {string} newPassword
     * @returns {Promise<'ok' | 'invalid_token' | 'expired' | 'too_short' | 'invalid'>}
     */
    async resetPassword(token, newPassword) {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_password', token, newPassword })
        });
        const data = await res.json();
        if (!res.ok) return data.error;
        return 'ok';
    }

    // Clears the local user state after the server invalidates the session cookie.
    async logout() {
        await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout' })
        });
        this.user = null;
    }

    /**
     * @param {string} email
     * @returns {Promise<'ok' | 'invalid_email' | 'email_taken' | 'unauthorized'>}
     */
    async updateEmail(email) {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_email', email })
        });
        const data = await res.json();
        if (!res.ok) return data.error;
        // Update the local user object so the UI reflects the change immediately.
        if (this.user) this.user = { ...this.user, email: email.trim().toLowerCase() };
        return 'ok';
    }

    async resendVerification() {
        await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resend_verification' })
        });
    }

    async deleteAccount() {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_account' })
        });
        if (!res.ok) return 'error';
        this.user = null;
        return 'ok';
    }

    // Used when sharing a list — checks whether the target username exists before sending an invitation.
    /** @param {string} username */
    async userExists(username) {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'exists', username })
        });
        const data = await res.json();
        return data.exists === true;
    }
}

export const authContext = new AuthContext();
