import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ActiveTaskComponent } from './active-task/active-task.component';
import { GroupsComponent } from './groups/groups.component';
import { TasksComponent } from './tasks/tasks.component';
import { UsageComponent } from './usage/usage.component';
import { AppInitResolver } from './app.init-resolver';
import { AboutComponent } from 'app/about/about.component';

const routes: Routes = [
  {
    path: '',
    resolve: {appData: AppInitResolver},
    children: [
      { path: 'active-task', component: ActiveTaskComponent },
      { path: 'groups', component: GroupsComponent },
      { path: 'tasks', component: TasksComponent },
      { path: 'usage', component: UsageComponent },
      { path: 'about', component: AboutComponent },
      {
        path: '**',
        redirectTo: '/active-task',
      }
    ]
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {useHash: true})
  ],
  providers: [
    AppInitResolver
  ],
  exports: [
    RouterModule,
  ]
})
export class AppRoutingModule { }
