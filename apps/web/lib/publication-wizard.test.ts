import { describe, expect, it } from 'vitest';
import { createBlankListingInput } from './publication';
import { validateWizardStep } from './publication-wizard';
const photo = { name: 'photo.jpg', type: 'image/jpeg', size: 100_000 };
describe('creation wizard without mutation', () => {
  it('keeps the opening choice immediately usable', () => {
    expect(validateWizardStep(0, createBlankListingInput(), [])).toBeNull();
  });
  it('requires meaningful descriptions and five distinct trade wishes', () => {
    const form = createBlankListingInput();
    expect(validateWizardStep(1, form, [])).toMatch(/titre/);
    form.title = 'Sac de randonnée';
    form.description = 'Sac 40 litres en bon état.';
    expect(validateWizardStep(1, form, [])).toMatch(/souhaits/);
    form.tradeWishes = ['Livre','Jeu','Sac','Lampe','Livre'];
    expect(validateWizardStep(1, form, [])).toMatch(/souhaits/);
    form.tradeWishes[4] = 'Chaise';
    expect(validateWizardStep(1, form, [])).toBeNull();
  });
  it('accepts donations without wishes and blocks incomplete/invalid photos', () => {
    const form = { ...createBlankListingInput(), operationType: 'DONATION' as const, tradeWishes: [], title: 'Lampe', description: 'Lampe de bureau fonctionnelle' };
    expect(validateWizardStep(1, form, [])).toBeNull();
    expect(validateWizardStep(2, form, [photo])).toMatch(/photos/);
    expect(validateWizardStep(2, form, Array.from({length: 5}, () => photo))).toBeNull();
    expect(validateWizardStep(2, form, [ ...Array.from({length:4},()=>photo),{...photo,size:0}])).toMatch(/photo/);
    expect(validateWizardStep(2, form, [ ...Array.from({length:4},()=>photo),{...photo,type:'text/plain'}])).toMatch(/JPEG/);
  });
});
