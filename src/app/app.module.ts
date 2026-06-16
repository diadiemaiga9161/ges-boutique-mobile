import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { ServiceWorkerModule } from '@angular/service-worker';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AuthInterceptor } from './services/auth.interceptor';
import { ClientRequestIdInterceptor } from './services/client-request-id.interceptor';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { LoadingInterceptor } from './interceptors/loading.interceptor';
import { CapacitorUrlInterceptor } from './interceptors/capacitor-url.interceptor';
import { OfflineStatusModule } from './components/offline-status/offline-status.module';
import { PwaInstallComponent } from './components/pwa-install/pwa-install.component';
import { DataPreloadService } from './services/data-preload.service';
import { BoutiqueConfigService } from './services/boutique-config.service';
import { environment } from '../environments/environment';

export function initializeApp(boutiqueConfig: BoutiqueConfigService, preload: DataPreloadService) {
  return async () => {
    await boutiqueConfig.init();
    await preload.preload();
  };
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicModule.forRoot(),
    IonicStorageModule.forRoot(),
    AppRoutingModule,
    OfflineStatusModule,
    PwaInstallComponent,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: HTTP_INTERCEPTORS, useClass: CapacitorUrlInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ClientRequestIdInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [BoutiqueConfigService, DataPreloadService],
      multi: true
    }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
