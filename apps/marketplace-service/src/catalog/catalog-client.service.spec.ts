import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogClientService } from './catalog-client.service';
import {
  CatalogListingSnapshot,
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from './catalog-contract';

describe('M8 Marketplace → Catalog HTTP integration contract', () => {
  const listing: CatalogListingSnapshot = {
    id: 'abc/123',
    ownerId: 'owner-m8',
    operationType: ListingOperationType.DONATION,
    status: ListingStatus.APPROVED,
    availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
  };

  const config = new ConfigService({
    CATALOG_INTERNAL_URL: 'http://catalog:3101/',
    INTERNAL_SERVICE_TOKEN: 'm8-test-token',
  });

  const service = new CatalogClientService(config);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the token, escapes IDs and parses a valid Catalog snapshot', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(listing), { status: 200 }),
    );

    await expect(service.getListing(listing.id)).resolves.toEqual(listing);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://catalog:3101/internal/listings/abc%2F123',
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-internal-service-token': 'm8-test-token' },
      }),
    );
  });

  it.each([
    ['reserveListing', '/reserve'],
    ['completeListing', '/complete'],
    ['releaseListing', '/release'],
  ] as const)('%s follows the internal POST contract', async (method, suffix) => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(listing), { status: 200 }),
    );

    await expect(service[method]('listing-123')).resolves.toEqual(listing);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://catalog:3101/internal/listings/listing-123' + suffix,
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-internal-service-token': 'm8-test-token' },
      }),
    );
  });

  it.each([
    [404, NotFoundException],
    [409, ConflictException],
    [503, BadGatewayException],
  ])('maps Catalog HTTP %s to the correct Nest exception', async (status, exception) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ statusCode: status }), { status }),
    );

    await expect(service.getListing('missing')).rejects.toBeInstanceOf(exception);
  });

  it('rejects malformed successful Catalog snapshots instead of trusting upstream data', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'wrong-shape' }), { status: 200 }),
    );

    await expect(service.getListing('abc')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('returns BadGateway if Catalog is unavailable', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.reserveListing('abc')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('queries owned IDs via the authenticated internal Catalog endpoint', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(['owned-1', 'owned-2']), { status: 200 }),
    );
    await expect(service.getOwnerListingIds('owner/123'))
      .resolves.toEqual(['owned-1', 'owned-2']);
    expect(spy).toHaveBeenCalledWith(
      'http://catalog:3101/internal/listings/owner/owner%2F123/ids',
      expect.objectContaining({
        headers: { 'x-internal-service-token': 'm8-test-token' },
      }),
    );
  });

  it('maps malformed HTTP 200 owner-list JSON to upstream 502', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('not JSON', { status: 200 }),
    );
    await expect(service.getOwnerListingIds('owner'))
      .rejects.toBeInstanceOf(BadGatewayException);
  });

  it('maps an aborted owner-list response body to upstream 502', async () => {
    const response = new Response('[]', { status: 200 });
    jest.spyOn(response, 'json').mockRejectedValue(new Error('body stream aborted'));
    jest.spyOn(global, 'fetch').mockResolvedValue(response);
    await expect(service.getOwnerListingIds('owner'))
      .rejects.toBeInstanceOf(BadGatewayException);
  });

  it('fails closed when Catalog URL or internal token is missing', () => {
    // An explicit empty provider avoids reading CI process.env while testing
    // the real client's fail-closed constructor behavior.
    const withoutConfig = { get: () => undefined } as unknown as ConfigService;
    expect(() => new CatalogClientService(withoutConfig)).toThrow(
      'CATALOG_INTERNAL_URL and INTERNAL_SERVICE_TOKEN must be configured',
    );
  });
});
