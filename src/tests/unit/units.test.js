import { describe, it, expect } from 'vitest';
import {
    formatAmount,
    formatQuantity,
    isContinuousUnit,
    normalizeUnit,
    parseLeadingAmount,
    parseQuantityInput,
    roundToNiceStep,
    sanitizeQuantity,
    scaleQuantity,
    stepForUnit
} from '$lib/units';

describe('normalizeUnit', () => {
    it('lagrar styck som frånvaron av enhet', () => {
        expect(normalizeUnit('st')).toBe('');
        expect(normalizeUnit('ST')).toBe('');
        expect(normalizeUnit('styck')).toBe('');
        expect(normalizeUnit(undefined)).toBe('');
    });

    it('ger kända enheter deras kanoniska skrivsätt', () => {
        expect(normalizeUnit(' DL ')).toBe('dl');
        expect(normalizeUnit('Msk')).toBe('msk');
        expect(normalizeUnit('förp')).toBe('förp');
    });

    it('behåller egna enheter som fritext, kapade till 20 tecken', () => {
        expect(normalizeUnit('klyfta')).toBe('klyfta');
        expect(normalizeUnit('x'.repeat(50))).toHaveLength(20);
    });
});

describe('sanitizeQuantity', () => {
    it('släpper igenom decimaler inom 0 < q <= 9999', () => {
        expect(sanitizeQuantity(1.5)).toBe(1.5);
        expect(sanitizeQuantity('2,5'.replace(',', '.'))).toBe(2.5);
        expect(sanitizeQuantity(9999)).toBe(9999);
    });

    it('ser noll, negativa tal och skräp som ingen mängd', () => {
        expect(sanitizeQuantity(0)).toBeNull();
        expect(sanitizeQuantity(-3)).toBeNull();
        expect(sanitizeQuantity('mycket')).toBeNull();
        expect(sanitizeQuantity(null)).toBeNull();
        expect(sanitizeQuantity(undefined)).toBeNull();
        expect(sanitizeQuantity('')).toBeNull();
    });

    it('kapar flyttalsbruset från en multiplikation', () => {
        expect(sanitizeQuantity(0.1 * 3)).toBe(0.3);
    });

    it('taket är 9999', () => {
        expect(sanitizeQuantity(50000)).toBe(9999);
    });
});

describe('roundToNiceStep', () => {
    it('avrundar till närmaste halva under 10', () => {
        expect(roundToNiceStep(2.25)).toBe(2.5);
        expect(roundToNiceStep(2.2)).toBe(2);
        expect(roundToNiceStep(9.9)).toBe(10);
    });

    // Gränserna är där en tyst regressionsrisk finns: 10 hör till heltalen,
    // 100 också, och först över 100 börjar tiotalen gälla.
    it('avrundar till närmaste heltal från 10 till och med 100', () => {
        expect(roundToNiceStep(10)).toBe(10);
        expect(roundToNiceStep(10.4)).toBe(10);
        expect(roundToNiceStep(66.6)).toBe(67);
        expect(roundToNiceStep(100)).toBe(100);
        expect(roundToNiceStep(100.4)).toBe(100);
    });

    it('avrundar till närmaste tiotal över 100', () => {
        expect(roundToNiceStep(101)).toBe(100);
        expect(roundToNiceStep(106)).toBe(110);
        expect(roundToNiceStep(333)).toBe(330);
    });

    it('landar aldrig på noll — en nedskalad vara får inte försvinna', () => {
        expect(roundToNiceStep(0.1)).toBe(0.5);
    });
});

describe('scaleQuantity', () => {
    // Kärnan i "×2 salt"-problemet: en vara utan mängd har ingen mängd att
    // dubbla, oavsett hur receptet skalas.
    it('skalar aldrig en mängd som inte är angiven', () => {
        expect(scaleQuantity(null, '', 2)).toBeNull();
        expect(scaleQuantity(undefined, 'krm', 4)).toBeNull();
        expect(scaleQuantity('', 'g', 0.5)).toBeNull();
    });

    it('avrundar räknbara enheter uppåt, minst 1', () => {
        expect(scaleQuantity(6, '', 1.5)).toBe(9);
        expect(scaleQuantity(1, '', 1.5)).toBe(2);
        expect(scaleQuantity(2, 'förp', 1.25)).toBe(3);
        expect(scaleQuantity(4, '', 0.1)).toBe(1);
    });

    it('avrundar kontinuerliga enheter till trevliga steg', () => {
        // Det gamla Math.ceil gav 3 kg här — en fjärdedel för mycket.
        expect(scaleQuantity(1.5, 'kg', 1.5)).toBe(2.5);
        expect(scaleQuantity(2, 'dl', 1.5)).toBe(3);
        expect(scaleQuantity(45, 'g', 1.5)).toBe(68);
        expect(scaleQuantity(500, 'g', 1.5)).toBe(750);
    });

    it('gör ingen enhetsomvandling — 1500 g förblir 1500 g', () => {
        expect(scaleQuantity(1000, 'g', 1.5)).toBe(1500);
    });

    it('lämnar mängden orörd vid skalfaktor 1', () => {
        expect(scaleQuantity(0.25, 'tsk', 1)).toBe(0.25);
        expect(scaleQuantity(6, '', 1)).toBe(6);
    });

    it('ignorerar en obrukbar skalfaktor istället för att nolla mängden', () => {
        expect(scaleQuantity(6, '', NaN)).toBe(6);
        expect(scaleQuantity(6, '', 0)).toBe(6);
        expect(scaleQuantity(6, '', -2)).toBe(6);
    });
});

describe('stepForUnit', () => {
    it('stegar i varans egen enhet', () => {
        expect(stepForUnit('')).toBe(1);
        expect(stepForUnit('dl')).toBe(1);
        expect(stepForUnit('l')).toBe(0.5);
        expect(stepForUnit('kg')).toBe(0.5);
        expect(stepForUnit('g')).toBe(50);
        expect(stepForUnit('msk')).toBe(1);
        expect(stepForUnit('klyfta')).toBe(1);
    });
});

describe('isContinuousUnit', () => {
    it('skiljer räknbart från kontinuerligt', () => {
        expect(isContinuousUnit('dl')).toBe(true);
        expect(isContinuousUnit('kg')).toBe(true);
        expect(isContinuousUnit('')).toBe(false);
        expect(isContinuousUnit('förp')).toBe(false);
        expect(isContinuousUnit('klyfta')).toBe(false);
    });
});

describe('formatQuantity / formatAmount', () => {
    it('visar svenskt decimalkomma', () => {
        expect(formatQuantity(3.5)).toBe('3,5');
        expect(formatQuantity(3)).toBe('3');
    });

    it('visar mängden med enhet, ×-form utan enhet och tomt utan mängd', () => {
        expect(formatAmount(3, 'dl')).toBe('3 dl');
        expect(formatAmount(1.5, 'kg')).toBe('1,5 kg');
        expect(formatAmount(3, '')).toBe('×3');
        expect(formatAmount(1, '')).toBe('1');
        expect(formatAmount(null, '')).toBe('');
        expect(formatAmount(null, 'dl')).toBe('');
    });
});

describe('parseQuantityInput', () => {
    it('accepterar svenskt komma', () => {
        expect(parseQuantityInput('1,5')).toBe(1.5);
        expect(parseQuantityInput(' 2 ')).toBe(2);
    });

    it('låter tomt förbli tomt istället för att hoppa till 1', () => {
        expect(parseQuantityInput('')).toBeNull();
        expect(parseQuantityInput('   ')).toBeNull();
        expect(parseQuantityInput('abc')).toBeNull();
    });
});

describe('parseLeadingAmount', () => {
    it('delar upp "3 dl grädde"', () => {
        expect(parseLeadingAmount('3 dl grädde')).toEqual({ name: 'grädde', quantity: 3, unit: 'dl' });
    });

    it('klarar decimaler, saknat mellanslag och versaler', () => {
        expect(parseLeadingAmount('1,5 kg potatis')).toEqual({ name: 'potatis', quantity: 1.5, unit: 'kg' });
        expect(parseLeadingAmount('500g kaffe')).toEqual({ name: 'kaffe', quantity: 500, unit: 'g' });
        expect(parseLeadingAmount('2 MSK olja')).toEqual({ name: 'olja', quantity: 2, unit: 'msk' });
    });

    it('tolkar "st" som styck, alltså ingen enhet', () => {
        expect(parseLeadingAmount('3 st ägg')).toEqual({ name: 'ägg', quantity: 3, unit: '' });
    });

    it('tar mängden utan enhet när ingen känd enhet står först', () => {
        expect(parseLeadingAmount('2 mjölk')).toEqual({ name: 'mjölk', quantity: 2, unit: '' });
    });

    // Det här är fallet som gör tolkningen farlig om regeln är för slapp:
    // siffran hör till varunamnet och ska inte bli en mängd.
    it('rör inte ett namn där talet inte står först', () => {
        expect(parseLeadingAmount('Kaffe Zoégas 500')).toBeNull();
        expect(parseLeadingAmount('Coca-Cola 1,5 l')).toBeNull();
    });

    it('kräver att något står kvar efter mängden', () => {
        expect(parseLeadingAmount('3 dl')).toBeNull();
        expect(parseLeadingAmount('12')).toBeNull();
        expect(parseLeadingAmount('')).toBeNull();
    });

    it('låter en enhet som råkar inleda ett ord vara ett ord', () => {
        expect(parseLeadingAmount('3 gram salt')).toEqual({ name: 'gram salt', quantity: 3, unit: '' });
    });
});
