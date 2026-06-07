import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AppsService } from './apps.service';

describe('AppsService', () => {
  let service: AppsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AppsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
