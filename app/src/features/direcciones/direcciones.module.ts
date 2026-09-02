import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { DireccionesPage } from './direcciones.page';

const routes: Routes = [{ path: '', component: DireccionesPage }];

@NgModule({
  declarations: [DireccionesPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class DireccionesModule {}
