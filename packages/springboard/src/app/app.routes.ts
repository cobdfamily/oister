import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'apps',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'apps',
    pathMatch: 'full',
  },
  {
    path: 'welcome',
    loadComponent: () => import('./welcome/welcome.page').then( m => m.WelcomePage)
  },
];
