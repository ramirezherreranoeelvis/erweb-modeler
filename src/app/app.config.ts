import {
      ApplicationConfig,
      importProvidersFrom,
      provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
      Check,
      Eye,
      Lock,
      LucideAngularModule,
      Menu,
      PenLine,
      Plus,
      Save,
      Server,
      Trash2,
} from 'lucide-angular';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
      providers: [
            provideBrowserGlobalErrorListeners(),
            provideRouter(routes),
            provideClientHydration(withEventReplay()),
            importProvidersFrom(
                  LucideAngularModule.pick({
                        Menu,
                        Save,
                        Server,
                        Check,
                        PenLine,
                        Lock,
                        Plus,
                        Trash2,
                        Eye,
                  }),
            ),
      ],
};
