import { describe, it, expect } from 'vitest';
import { escapeRegex, isValidEmail, isValidPassword, serializeList } from '$lib/server/utils';

describe('escapeRegex', () => {
    it('escapes all regex special characters', () => {
        expect(escapeRegex('a.b*c+d?e^f$g{h}i(j)k[l]m\\n|o')).toBe(
            'a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\[l\\]m\\\\n\\|o'
        );
    });

    it('leaves plain strings unchanged', () => {
        expect(escapeRegex('hello123')).toBe('hello123');
    });

    it('allows safe use in case-insensitive username lookup', () => {
        const username = 'user.name+test';
        const regex = new RegExp(`^${escapeRegex(username)}$`, 'i');
        expect(regex.test('user.name+test')).toBe(true);
        expect(regex.test('USER.NAME+TEST')).toBe(true);
        expect(regex.test('username')).toBe(false);
    });
});

describe('isValidEmail', () => {
    it('accepts standard emails', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
        expect(isValidEmail('a@b.io')).toBe(true);
        expect(isValidEmail('  user@example.com  ')).toBe(true); // trims whitespace
    });

    it('rejects malformed emails', () => {
        expect(isValidEmail('notanemail')).toBe(false);
        expect(isValidEmail('@nodomain.com')).toBe(false);
        expect(isValidEmail('noatsign.com')).toBe(false);
        expect(isValidEmail('user@')).toBe(false);
        expect(isValidEmail('')).toBe(false);
    });
});

describe('isValidPassword', () => {
    it('accepts passwords meeting all requirements', () => {
        expect(isValidPassword('password1')).toBe(true);
        expect(isValidPassword('Lösenord1')).toBe(true); // Swedish chars
        expect(isValidPassword('åäö12345')).toBe(true);
    });

    it('rejects passwords shorter than 8 characters', () => {
        expect(isValidPassword('abc1234')).toBe(false);
    });

    it('rejects passwords without letters', () => {
        expect(isValidPassword('12345678')).toBe(false);
    });

    it('rejects passwords without digits', () => {
        expect(isValidPassword('password')).toBe(false);
    });
});

describe('serializeList', () => {
    it('serializes a MongoDB document to a plain list object', () => {
        const doc = {
            _id: { toString: () => 'abc123' },
            name: 'Handla',
            owner: 'alice',
            sharedWith: ['bob'],
            pendingInvites: [],
            items: [
                { itemId: '1', name: 'Mjölk', spec: '3%', quantity: 2, bought: false, category: 'Mejeri' }
            ]
        };
        const result = serializeList(doc);
        expect(result).toEqual({
            id: 'abc123',
            name: 'Handla',
            owner: 'alice',
            sharedWith: ['bob'],
            pendingInvites: [],
            items: [{ itemId: '1', name: 'Mjölk', spec: '3%', quantity: 2, bought: false, category: 'Mejeri' }]
        });
    });

    it('defaults missing sharedWith / pendingInvites to empty arrays', () => {
        const doc = { _id: { toString: () => '1' }, name: 'Test', owner: 'alice' };
        const result = serializeList(doc);
        expect(result.sharedWith).toEqual([]);
        expect(result.pendingInvites).toEqual([]);
        expect(result.items).toEqual([]);
    });
});
