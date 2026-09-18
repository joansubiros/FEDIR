import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../core/services/auth.guard';

const routes: Routes = [
  { path: 'auth/login', loadChildren: () => import('../features/auth/login.module').then(m => m.LoginModule) },
  { path: 'home', loadChildren: () => import('../features/home/home.module').then(m => m.HomeModule), canActivate: [AuthGuard] },
  { path: 'rutas', loadChildren: () => import('../features/rutas/rutas.module').then(m => m.RutasModule), canActivate: [AuthGuard] },
  { path: 'pesajes', loadChildren: () => import('../features/pesajes/pesajes.module').then(m => m.PesajesModule), canActivate: [AuthGuard] },
  { path: 'paradas', loadChildren: () => import('../features/paradas/paradas.module').then(m => m.ParadasModule), canActivate: [AuthGuard] },
  { path: 'direcciones', loadChildren: () => import('../features/direcciones/direcciones.module').then(m => m.DireccionesModule), canActivate: [AuthGuard] },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
