class NotificationContext {
    /** @type {{ id: string, message: string, type: 'error' | 'success' }[]} */
    toasts = $state([]);

    /**
     * @param {string} message
     * @param {'error' | 'success'} [type]
     */
    show(message, type = 'error') {
        const id = crypto.randomUUID();
        this.toasts = [...this.toasts, { id, message, type }];
        setTimeout(() => this.dismiss(id), 3500);
    }

    /** @param {string} id */
    dismiss(id) {
        this.toasts = this.toasts.filter(t => t.id !== id);
    }
}

export const notificationContext = new NotificationContext();
