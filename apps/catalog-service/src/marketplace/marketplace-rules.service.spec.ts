import { BadRequestException } from '@nestjs/common';
import { ListingOperationType } from '../../generated/prisma';
import {
  MAX_LISTING_IMAGES,
  MarketplaceRulesService,
} from './marketplace-rules.service';

describe('Catalog publication rules', () => {
  const rules = new MarketplaceRulesService();
  const wishes = ['Console', 'Tablette', 'Écran', 'Clavier', 'Casque'];

  it('accepts a donation with 5 images and no trade wish', () => {
    expect(
      rules.validatePublicationAssets(
        ListingOperationType.DONATION,
        5,
        [],
      ),
    ).toEqual([]);
  });

  it('accepts a trade with 5 distinct normalized wishes', () => {
    expect(
      rules.validatePublicationAssets(
        ListingOperationType.TRADE,
        5,
        wishes,
      ),
    ).toEqual(wishes);
  });

  it('rejects duplicate wishes after trim/case normalization', () => {
    expect(() =>
      rules.validateTradeWishes(ListingOperationType.TRADE, [
        'Console',
        ' console ',
        'Écran',
        'Clavier',
        'Casque',
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects galleries outside 5 to 8 images', () => {
    expect(() =>
      rules.validatePublicationAssets(
        ListingOperationType.DONATION,
        MAX_LISTING_IMAGES + 1,
        [],
      ),
    ).toThrow(BadRequestException);
  });
});
