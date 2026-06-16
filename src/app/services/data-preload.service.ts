import { Injectable } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductService } from './product.service';
import { ClientService } from './client.service';
import { BoutiqueService } from './boutique.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class DataPreloadService {

  constructor(
    private productService: ProductService,
    private clientService: ClientService,
    private boutiqueService: BoutiqueService,
    private auth: AuthService
  ) {}

  preload(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      return Promise.resolve();
    }

    return forkJoin([
      this.productService.getProducts().pipe(catchError(() => of([]))),
      this.clientService.getAll().pipe(catchError(() => of([]))),
      this.boutiqueService.refreshBoutique().pipe(catchError(() => of(null))),
      this.productService.getAllCategories().pipe(catchError(() => of([])))
    ]).toPromise().then(() => undefined);
  }
}
