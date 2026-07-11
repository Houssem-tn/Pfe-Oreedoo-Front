import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CasesService } from './cases.service';
import { API_BASE_URL } from '../http/api.config';

describe('CasesService', () => {
  let service: CasesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
      ],
    });

    service = TestBed.inject(CasesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getCasesByType() should build the URL without caseModule when none is given', () => {
    service.getCasesByType('ACTIVATION').subscribe();
    const req = httpMock.expectOne('/api/v1/cases?type=ACTIVATION');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getComplaintCases() should request PLAINTE cases scoped to the PLT module', () => {
    service.getComplaintCases().subscribe();
    const req = httpMock.expectOne('/api/v1/cases?type=PLAINTE&caseModule=PLT');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getResiliationCases() should request PLAINTE cases scoped to the RES module', () => {
    service.getResiliationCases().subscribe();
    const req = httpMock.expectOne('/api/v1/cases?type=PLAINTE&caseModule=RES');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getOperationalCases() should fan out one request per type and flatten the results', () => {
    let result: unknown[] | undefined;
    service.getOperationalCases(['ACTIVATION', 'PLAINTE']).subscribe((r) => (result = r));

    const activationReq = httpMock.expectOne('/api/v1/cases?type=ACTIVATION');
    const plainteReq = httpMock.expectOne('/api/v1/cases?type=PLAINTE');
    activationReq.flush([{ id: 'a1' }]);
    plainteReq.flush([{ id: 'p1' }, { id: 'p2' }]);

    expect(result).toEqual([{ id: 'a1' }, { id: 'p1' }, { id: 'p2' }] as any);
  });

  it('assignStt() should accept a plain sttId string and wrap it in the request body', () => {
    service.assignStt('case-1', 'stt-1').subscribe();
    const req = httpMock.expectOne('/api/v1/cases/case-1/assign-stt');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sttId: 'stt-1' });
    req.flush({});
  });

  it('assignTech() should accept a request object and forward its techId', () => {
    service.assignTech('case-1', { techId: 'tech-1' } as any).subscribe();
    const req = httpMock.expectOne('/api/v1/cases/case-1/assign-tech');
    expect(req.request.body).toEqual({ techId: 'tech-1' });
    req.flush({});
  });

  it('getCaseById() should GET the case by id', () => {
    service.getCaseById('case-1').subscribe();
    const req = httpMock.expectOne('/api/v1/cases/case-1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('downloadCasePdf() should request a blob response', () => {
    service.downloadCasePdf('case-1').subscribe();
    const req = httpMock.expectOne('/api/v1/cases/case-1/pdf');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });
});
