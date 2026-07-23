import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { RetrievedStockService } from './retrieved-stock.service';
import { API_BASE_URL } from '../http/api.config';

describe('RetrievedStockService', () => {
  let service: RetrievedStockService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
      ],
    });

    service = TestBed.inject(RetrievedStockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMyRetrievedStock() should GET the technician pending bucket', () => {
    service.getMyRetrievedStock().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/tech/mine');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('uploadRetrievalProof() should POST a multipart file to the item proof endpoint', () => {
    const file = new File(['data'], 'label.jpg', { type: 'image/jpeg' });
    service.uploadRetrievalProof('rsi-1', file).subscribe();

    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/rsi-1/proof');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({});
  });

  it('getSttPendingCollection() should GET the STT pending queue grouped by technician', () => {
    service.getSttPendingCollection().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/stt/pending');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getSttCollectedStock() should GET the collected STT bucket', () => {
    service.getSttCollectedStock().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/stt/collected');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getSttReturnEligible() should GET only collected items that are eligible for return requests', () => {
    service.getSttReturnEligible().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/stt/return-eligible');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('confirmCollection() should POST the selected item ids and an optional note', () => {
    const payload = { itemIds: ['rsi-1', 'rsi-2'], note: 'picked up' };
    service.confirmCollection(payload).subscribe();

    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/stt/confirm-collection');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ collectedItems: [] });
  });

  it('getZmTracking() should GET the read-only ZM tracking view', () => {
    service.getZmTracking().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/zm/tracking');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getByCase() should GET items linked to a case', () => {
    service.getByCase('case-1').subscribe();
    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/case/case-1');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getAllAudit() should GET the admin audit list', () => {
    service.getAllAudit().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/retrieved-stock/admin/all');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
