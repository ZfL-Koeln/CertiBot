import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CertConfigLoader } from './cert-config-loader';
import { CERTCONFIG } from '../certificates/cert-config';

describe('CertConfigLoader', () => {
  let loader: CertConfigLoader;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CertConfigLoader, provideHttpClient(), provideHttpClientTesting()]
    });
    loader = TestBed.inject(CertConfigLoader);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches config/<id>.json and returns the config', () => {
    const cfg: CERTCONFIG = {
      template: 'templates/abc.pdf', outputFile: 'abc.pdf',
      name: { x: 1, y: 2, size: 3 }, dialogTitle: 'T'
    };
    let result: CERTCONFIG | null | undefined;
    loader.load('abc123').subscribe(r => (result = r));
    const req = httpMock.expectOne('config/abc123.json');
    expect(req.request.method).toBe('GET');
    req.flush(cfg);
    expect(result).toEqual(cfg);
  });

  it('returns null on 404 (unknown id)', () => {
    let result: CERTCONFIG | null | undefined;
    loader.load('missing').subscribe(r => (result = r));
    httpMock.expectOne('config/missing.json').flush('nope', { status: 404, statusText: 'Not Found' });
    expect(result).toBeNull();
  });
});
