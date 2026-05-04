import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'segments',
    pathMatch: 'full',
  },
  {
    path: 'segments',
    loadComponent: () =>
      import('./pages/segments-list/segments-list.component').then(
        (m) => m.SegmentsListComponent,
      ),
  },
  {
    path: 'segments/:id',
    loadComponent: () =>
      import('./pages/segment-detail/segment-detail.component').then(
        (m) => m.SegmentDetailComponent,
      ),
  },
  {
    path: 'simulate',
    loadComponent: () =>
      import('./pages/simulate/simulate.component').then(
        (m) => m.SimulateComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'segments',
  },
];
