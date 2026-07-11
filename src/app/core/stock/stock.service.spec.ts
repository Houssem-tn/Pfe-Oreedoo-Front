import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { StockService } from './stock.service';
import { API_BASE_URL } from '../http/api.config';

describe('StockService', () => {
  let service: StockService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
      ],
    });

    service = TestBed.inject(StockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getEquipment() should GET the equipment list', () => {
    service.getEquipment().subscribe();
    const req = httpMock.expectOne('/api/v1/stock/equipment');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('createDpm() should POST the DPM payload', () => {
    const payload = { sttId: 'stt-1', items: [] } as any;
    service.createDpm(payload).subscribe();

    const req = httpMock.expectOne('/api/v1/stock/dpms');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(payload);
    req.flush({});
  });

  it('confirmDpm() should POST to the confirm endpoint for the given id', () => {
    const payload = { items: [{ equipmentId: 'eq-1', confirmedQuantity: 5 }] } as any;
    service.confirmDpm('dpm-1', payload).subscribe();

    const req = httpMock.expectOne('/api/v1/stock/dpms/dpm-1/confirm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('distributeToTech() should POST to the STT distribute endpoint', () => {
    const payload = { techId: 'tech-1', items: [{ equipmentId: 'eq-1', quantity: 2 }] } as any;
    service.distributeToTech(payload).subscribe();

    const req = httpMock.expectOne('/api/v1/stock/stt/distribute');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deactivateEquipment() should DELETE the equipment by id', () => {
    service.deactivateEquipment('eq-1').subscribe();
    const req = httpMock.expectOne('/api/v1/stock/equipment/eq-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('createEquipment() should send a multipart form with the JSON data part', () => {
    service.createEquipment({ name: 'ONT Box' } as any).subscribe();

    const req = httpMock.expectOne('/api/v1/stock/equipment');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush({});
  });
});
