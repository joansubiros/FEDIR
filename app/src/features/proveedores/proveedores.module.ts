import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ProveedorNewPage } from './proveedor-new.page';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', redirectTo: 'nuevo', pathMatch: 'full' },
  { path: 'nuevo', component: ProveedorNewPage },
];

@NgModule({
  declarations: [ProveedorNewPage],
  imports: [CommonModule, ReactiveFormsModule, IonicModule, RouterModule.forChild(routes), SharedModule],
})
export class ProveedoresModule {}
