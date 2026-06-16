import { TestBed } from '@angular/core/testing';

import { Boutique } from './boutique';

describe('Boutique', () => {
  let service: Boutique;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Boutique);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
