import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Certificate } from './certificate';
import { Dialog } from '../dialog/dialog';
import { ErrorDialog } from '../error-dialog/error-dialog';
import { Encryption } from '../../services/encryption';
import { CERTCONFIG } from '../../certificates/cert-config';

const BASE_CONFIG: CERTCONFIG = {
  template: 'templates/t.pdf',
  outputFile: 'o.pdf',
  name: { x: 1, y: 2, size: 3 },
  dialogTitle: 'T',
};

describe('Certificate', () => {
  let fixture: ComponentFixture<Certificate>;
  let httpMock: HttpTestingController;
  let openSpy: jasmine.Spy;

  async function setup(id: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Certificate],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
        // Identity "decrypt" so tests don't depend on the AES password.
        { provide: Encryption, useValue: { decrypt: (s: string) => s } },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    // Spy on the root MatDialog singleton before ngOnInit runs. The name dialog
    // returns an afterClosed() that emits nothing actionable, so generation is
    // never triggered from these tests.
    openSpy = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({
      afterClosed: () => of(undefined),
    } as ReturnType<MatDialog['open']>);

    fixture = TestBed.createComponent(Certificate);
    fixture.detectChanges(); // triggers ngOnInit
  }

  afterEach(() => httpMock.verify());

  it('should create', async () => {
    await setup('evt1');
    httpMock.expectOne('config/evt1.json').flush(BASE_CONFIG);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('opens the name dialog directly when the config has no participant list', async () => {
    await setup('evt1');
    httpMock.expectOne('config/evt1.json').flush(BASE_CONFIG);
    expect(openSpy).toHaveBeenCalledOnceWith(Dialog, jasmine.anything());
  });

  it('does not open the name dialog until the participant list has loaded', async () => {
    await setup('evt2');
    httpMock.expectOne('config/evt2.json').flush({ ...BASE_CONFIG, participants: 'participants/evt2.txt' });

    // The name dialog must not appear before the allowlist is available.
    expect(openSpy).not.toHaveBeenCalledWith(Dialog, jasmine.anything());

    httpMock.expectOne('participants/evt2.txt').flush('Alice\nBob\n');
    expect(openSpy).toHaveBeenCalledWith(Dialog, jasmine.anything());
  });

  it('blocks with an error dialog (fail closed) when the participant list cannot be loaded', async () => {
    await setup('evt3');
    httpMock.expectOne('config/evt3.json').flush({ ...BASE_CONFIG, participants: 'participants/evt3.txt' });

    httpMock.expectOne('participants/evt3.txt').flush('down', { status: 500, statusText: 'Server Error' });

    // Must block, and must never fall through to the name dialog.
    expect(openSpy).toHaveBeenCalledWith(ErrorDialog, jasmine.anything());
    expect(openSpy).not.toHaveBeenCalledWith(Dialog, jasmine.anything());
  });

  it('shows the invalid-link error dialog for an unknown id (config 404)', async () => {
    await setup('missing');
    httpMock.expectOne('config/missing.json').flush('nope', { status: 404, statusText: 'Not Found' });
    expect(openSpy).toHaveBeenCalledWith(ErrorDialog, jasmine.anything());
    expect(openSpy).not.toHaveBeenCalledWith(Dialog, jasmine.anything());
  });
});
