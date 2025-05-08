import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Authority } from '@shared/models/authority.enum';
import { AuthGuard } from '@core/guards/auth.guard';
import { PigFarmConfigComponent } from './pig-farm-config/pig-farm-config.component';

const routes: Routes = [
  {
    path: 'pigFarmConfig',
    component: PigFarmConfigComponent,
    data: {
      auth: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
      title: '猪场配置',
      breadcrumb: {
        label: 'menu.pig-farm-config',
        menuId: 'pig_farm_config'
      }
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: []
})
export class HomePagesRoutingModule { }