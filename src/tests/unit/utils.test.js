import { describe, it, expect } from 'vitest';
import {
    escapeRegex, hasListAccess, isValidEmail, isValidPassword, listAccessFilter,
    serializeList, serializeTemplate, sanitizeInstructions, sanitizeSourceUrl, MAX_INSTRUCTIONS
} from '$lib/server/utils';

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

describe('listAccessFilter', () => {
    it('matches owner and shared user with exact values so the index can be used', () => {
        const filter = listAccessFilter('alice');
        expect(filter).toEqual({
            $or: [
                { owner: 'alice' },
                { sharedWith: { $in: ['alice'] } }
            ]
        });
    });

    it('accepts the lowercase variant in sharedWith for accounts predating normalisation', () => {
        const filter = listAccessFilter('Alice');
        expect(filter.$or[1].sharedWith.$in).toEqual(['Alice', 'alice']);
    });

    it('never widens the owner clause — a case variant must not see your own lists', () => {
        expect(listAccessFilter('Alice').$or[0]).toEqual({ owner: 'Alice' });
    });

    it('never produces a regex, which would defeat the sharedWith index', () => {
        const serialised = JSON.stringify(listAccessFilter('alice'));
        expect(serialised).not.toContain('$regex');
    });
});

describe('hasListAccess', () => {
    it('grants the owner access', () => {
        expect(hasListAccess({ owner: 'alice', sharedWith: [] }, 'alice')).toBe(true);
    });

    it('grants a shared user access, including the lowercase variant', () => {
        expect(hasListAccess({ owner: 'bob', sharedWith: ['alice'] }, 'alice')).toBe(true);
        expect(hasListAccess({ owner: 'bob', sharedWith: ['alice'] }, 'Alice')).toBe(true);
    });

    it('denies a user who has been removed from sharedWith', () => {
        expect(hasListAccess({ owner: 'bob', sharedWith: [] }, 'alice')).toBe(false);
        expect(hasListAccess({ owner: 'bob', sharedWith: ['carol'] }, 'alice')).toBe(false);
    });

    it('denies a case variant of the owner, matching listAccessFilter', () => {
        expect(hasListAccess({ owner: 'alice', sharedWith: [] }, 'Alice')).toBe(false);
    });

    it('tolerates a missing sharedWith array', () => {
        expect(hasListAccess({ owner: 'bob' }, 'alice')).toBe(false);
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
            profileId: null,
            sharedWith: ['bob'],
            pendingInvites: [],
            items: [{ itemId: '1', name: 'Mjölk', spec: '3%', quantity: 2, unit: '', bought: false, category: 'Mejeri', addedBy: '' }]
        });
    });

    // Varor skapade innan enheter fanns saknar fältet helt. De är varor i
    // styck och ska fortsätta renderas precis som förut.
    it('behandlar varor utan unit som styck, och saknad mängd som ingen mängd', () => {
        const doc = {
            _id: { toString: () => '1' },
            name: 'Gammal',
            owner: 'alice',
            items: [
                { itemId: '1', name: 'Bröd', spec: '', quantity: 1, bought: false, category: '' },
                { itemId: '2', name: 'Salt', spec: '', bought: false, category: '' }
            ]
        };
        const items = serializeList(doc).items;
        expect(items[0].unit).toBe('');
        expect(items[0].quantity).toBe(1);
        expect(items[1].quantity).toBeNull();
    });

    it('defaults missing sharedWith / pendingInvites to empty arrays', () => {
        const doc = { _id: { toString: () => '1' }, name: 'Test', owner: 'alice' };
        const result = serializeList(doc);
        expect(result.sharedWith).toEqual([]);
        expect(result.pendingInvites).toEqual([]);
        expect(result.items).toEqual([]);
    });
});


describe('sanitizeInstructions', () => {
    it('behåller radbrytningar men trimmar kanterna', () => {
        expect(sanitizeInstructions('  Koka vattnet.\n\nHäll i riset.  '))
            .toBe('Koka vattnet.\n\nHäll i riset.');
    });

    it('normaliserar radbrytningar från Windows', () => {
        expect(sanitizeInstructions('Ett\r\nTvå')).toBe('Ett\nTvå');
    });

    it('kapar vid gränsen', () => {
        expect(sanitizeInstructions('x'.repeat(MAX_INSTRUCTIONS + 500))).toHaveLength(MAX_INSTRUCTIONS);
    });

    it('ger tom sträng för allt som inte är text', () => {
        for (const value of [undefined, null, 42, {}, []]) {
            expect(sanitizeInstructions(value)).toBe('');
        }
    });
});

describe('sanitizeSourceUrl', () => {
    it('släpper igenom http och https', () => {
        expect(sanitizeSourceUrl('https://exempel.se/recept')).toBe('https://exempel.se/recept');
        expect(sanitizeSourceUrl('http://exempel.se')).toBe('http://exempel.se');
    });

    it('kastar adresser som kan köra kod när någon klickar', () => {
        expect(sanitizeSourceUrl('javascript:alert(1)')).toBe('');
        expect(sanitizeSourceUrl('data:text/html,<script>')).toBe('');
        expect(sanitizeSourceUrl('file:///etc/passwd')).toBe('');
    });

    it('kastar det som inte är en adress alls', () => {
        expect(sanitizeSourceUrl('bara text')).toBe('');
        expect(sanitizeSourceUrl('')).toBe('');
        expect(sanitizeSourceUrl(null)).toBe('');
    });
});

describe('serializeTemplate', () => {
    it('tar med tillagning och källänk', () => {
        const doc = serializeTemplate({
            _id: { toString: () => 'abc' },
            owner: 'benji', name: 'Pannkakor', kind: 'recipe', servings: 4,
            instructions: 'Vispa ihop.', sourceUrl: 'https://exempel.se', items: []
        });
        expect(doc.instructions).toBe('Vispa ihop.');
        expect(doc.sourceUrl).toBe('https://exempel.se');
    });

    it('ger tomma strängar för äldre recept utan fälten', () => {
        const doc = serializeTemplate({
            _id: { toString: () => 'abc' },
            owner: 'benji', name: 'Gammal mall', items: []
        });
        expect(doc.instructions).toBe('');
        expect(doc.sourceUrl).toBe('');
    });
});
