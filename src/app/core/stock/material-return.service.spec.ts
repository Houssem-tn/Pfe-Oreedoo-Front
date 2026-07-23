import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { MaterialReturnService } from './material-return.service';
import { API_BASE_URL } from '../http/api.config';
import { RETURN_SOURCE_LABELS } from './material-return.model';

describe('MaterialReturnService', () => {
  let service: MaterialReturnService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
      ],
    });

    service = TestBed.inject(MaterialReturnService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('RETURN_SOURCE_LABELS should expose both STT stock and collected item stock for the STT modal', () => {
    expect(RETURN_SOURCE_LABELS['STT_STOCK']).toBe('statuses.returnSource.sttStock');
    expect(RETURN_SOURCE_LABELS['COLLECTED_ITEM_STOCK']).toBe('statuses.returnSource.collectedItemStock');
  });

  it('createReturn() should POST the payload to the base returns endpoint', () => {
    const payload = { responsibleZmId: 'zm-1', items: [] } as any;
    service.createReturn(payload).subscribe();

    const req = httpMock.expectOne('/api/v1/stock/returns');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(payload);
    req.flush({});
  });

  it('createReturn() should preserve collected-item ids when the request source is collected stock', () => {
    const payload = {
      responsibleZmId: 'zm-1',
      returnSource: 'COLLECTED_ITEM_STOCK',
      retrievedStockItemIds: ['rsi-1', 'rsi-2'],
      items: [],
    } as any;

    service.createReturn(payload).subscribe();

    const req = httpMock.expectOne('/api/v1/stock/returns');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.retrievedStockItemIds).toEqual(['rsi-1', 'rsi-2']);
    req.flush({});
  });

  it('acceptSchedule() should POST accepted:true with an optional comment', () => {
    service.acceptSchedule('ret-1', 'looks good').subscribe();

    const req = httpMock.expectOne('/api/v1/stock/returns/ret-1/schedule/accept');
    expect(req.request.body).toEqual({ accepted: true, comment: 'looks good' });
    req.flush({});
  });

  it('requestReschedule() should POST accepted:false with the required comment', () => {
    service.requestReschedule('ret-1', 'wrong date').subscribe();

    const req = httpMock.expectOne('/api/v1/stock/returns/ret-1/schedule/reject');
    expect(req.request.body).toEqual({ accepted: false, comment: 'wrong date' });
    req.flush({});
  });

  it('rejectReturn() should POST to the reject endpoint', () => {
    service.rejectReturn('ret-1', { reason: 'damaged' } as any).subscribe();
    const req = httpMock.expectOne('/api/v1/stock/returns/ret-1/reject');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('markHandedOver() should default to an empty body when none is given', () => {
    service.markHandedOver('ret-1').subscribe();
    const req = httpMock.expectOne('/api/v1/stock/returns/ret-1/mark-handed-over');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  // These alias pairs are intentionally redundant (flagged as a testing-gap
  // observation) — locking in that both names really do hit the same
  // endpoint documents the redundancy instead of silently duplicating it.
  it('getMyReturns() should be an alias for getSttReturns()', () => {
    service.getMyReturns().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/returns/stt/my-returns');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getPendingReturns() should be an alias for getZmPendingReturns()', () => {
    service.getPendingReturns().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/returns/zm/pending');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getAllTeamReturns() should be an alias for getZmReturns()', () => {
    service.getAllTeamReturns().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/returns/zm/my-returns');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getById() should be an alias for getReturnById()', () => {
    service.getById('ret-1').subscribe();
    const req = httpMock.expectOne('/api/v1/stock/returns/ret-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('proposeHandover() should be an alias for proposeSchedule()', () => {
    service.proposeHandover('ret-1', { proposedDate: '2026-01-01' } as any).subscribe();
    const req = httpMock.expectOne('/api/v1/stock/returns/ret-1/propose-handover');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
