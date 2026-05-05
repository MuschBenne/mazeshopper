// Dynamic read so global-setup can set process.env.MONGODB_URI before modules load
export const MONGODB_URI = process.env.MONGODB_URI ?? '';
export const RESEND_API_KEY = 'test-key';
export const EMAIL_FROM = 'test@test.com';

// $env/dynamic/private exposes an `env` object
export const env = {
    get MONGODB_URI() { return process.env.MONGODB_URI ?? ''; },
    RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'test@test.com',
};
