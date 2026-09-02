import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ParadaDetallePage } from './parada-detalle.page';

const routes: Routes = [{ path: ':id', component: ParadaDetallePage }];

@NgModule({
  declarations: [ParadaDetallePage],
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
})
export class ParadasModule {}
