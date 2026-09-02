import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { RutasListPage } from './rutas-list.page';
import { RutaDetallePage } from './ruta-detalle.page';
import { RutaNewPage } from './ruta-new.page';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: RutasListPage },
  { path: 'new', component: RutaNewPage },
  { path: ':id', component: RutaDetallePage },
];

@NgModule({
  declarations: [RutasListPage, RutaDetallePage, RutaNewPage],
  imports: [CommonModule, ReactiveFormsModule, IonicModule, RouterModule.forChild(routes), SharedModule],
})
export class RutasModule {}
