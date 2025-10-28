// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

import { importProvidersFrom } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es-PE';
import { LOCALE_ID } from '@angular/core';
import { MatNativeDateModule } from '@angular/material/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ApiService } from './app/core/services/api.service';

registerLocaleData(localeEs);

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...(appConfig.providers || []),
    importProvidersFrom(BrowserAnimationsModule, MatNativeDateModule),
    { provide: LOCALE_ID, useValue: 'es-PE' },
  ],
}).then(async appRef => {
  const api = appRef.injector.get(ApiService);

  const path = location.pathname || '';
  if (!/^\/login\/?$/.test(path) && api.hasSession()) {
    try { await api.ensureUserReady(); } catch { }
  }
}).catch(err => console.error(err));