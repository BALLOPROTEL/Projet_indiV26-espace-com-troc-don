import type { ListingInput } from './types';
import { MIN_IMAGES, MAX_IMAGES, MAX_IMAGE_SIZE, MIN_WISHES, MAX_WISHES, validatePublicationDraft, type ImageCandidate } from './publication';

export const PUBLICATION_STEPS = ['Choix', 'Description', 'Photos', 'Vérification'] as const;

export function validateWizardStep(step: number, value: ListingInput, images: ImageCandidate[]): string | null {
  if (step === 0) return null;
  if (step === 1) {
    if (value.title.trim().length < 3 || value.title.trim().length > 120)
      return 'Donnez un titre de 3 à 120 caractères à cet objet.';
    if (value.description.trim().length < 10 || value.description.trim().length > 2000)
      return 'Décrivez votre objet en 10 à 2 000 caractères.';
    if (value.operationType === 'TRADE') {
      const wishes = value.tradeWishes.map(w => w.trim()).filter(Boolean);
      if (wishes.length < MIN_WISHES || wishes.length > MAX_WISHES ||
          wishes.some(w => w.length > 120) ||
          new Set(wishes.map(w => w.toLocaleLowerCase('fr'))).size !== wishes.length) {
        return 'Un troc nécessite 5 à 10 souhaits distincts et précis.';
      }
    }
    return null;
  }
  if (step === 2) {
    if (images.length < MIN_IMAGES || images.length > MAX_IMAGES)
      return `Sélectionnez entre ${MIN_IMAGES} et ${MAX_IMAGES} photos.`;
    if (images.some(img => img.size > MAX_IMAGE_SIZE || img.size === 0))
      return 'Chaque photo doit peser entre 1 octet et 5 Mio.';
    return validatePublicationDraft(value, images, 0);
  }
  return null;
}
