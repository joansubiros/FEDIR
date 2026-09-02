import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './home.page';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: HomePage },
];

@NgModule({
  declarations: [HomePage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes), SharedModule],
})
export class HomeModule {}
