class AuthContext {
    /** @type {{ username: string } | null} */
    user = $state(null);

    /**
     * @param {string} username
     * @param {string} password
     * @returns {Promise<'ok' | 'wrong_password' | 'not_found'>}
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
     * @returns {Promise<'ok' | 'taken' | 'email_taken' | 'invalid_email'>}
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

    async logout() {
        await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout' })
        });
        this.user = null;
    }

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
