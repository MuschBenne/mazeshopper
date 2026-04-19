// Manages the global toast notification queue.
// Toasts are auto-dismissed after 3.5 seconds but can also be dismissed manually.
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
        // Auto-dismiss after 3.5 seconds.
        setTimeout(() => this.dismiss(id), 3500);
    }

    /** @param {string} id */
    dismiss(id) {
        this.toasts = this.toasts.filter(t => t.id !== id);
    }
}

export const notificationContext = new NotificationContext();
