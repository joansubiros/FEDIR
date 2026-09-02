import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FedirDatePipe } from './pipes/fedir-date.pipe';
import { TabsComponent } from './tabs/tabs.component';
import { TodayDatePipe } from './pipes/today-date.pipe';

@NgModule({
  declarations: [FedirDatePipe, TodayDatePipe, TabsComponent],
  imports: [CommonModule, IonicModule],
  exports: [FedirDatePipe, TodayDatePipe, TabsComponent],
})
export class SharedModule {}
