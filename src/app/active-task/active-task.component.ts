import { environment } from 'environments/environment';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { timer } from 'rxjs/observable/timer';
import { debounceTime, filter, map, startWith } from 'rxjs/operators';
import { Ngxs, Select } from 'ngxs';
import { DateTime } from 'luxon';
import * as Schema from '@web-workers/db/db.schema';
import * as Store from '@store/.';

import { StopTaskComponent } from '../stop-task/stop-task.component';

@Component({
  selector: 'app-active-task',
  templateUrl: './active-task.component.html',
  styleUrls: ['./active-task.component.scss']
})
export class ActiveTaskComponent implements OnDestroy, OnInit {
  // Public properties
  public filteredTasks: Observable<Schema.ITask[]>;
  public tasks: Store.TasksState = {byId: {}, allIds: []};
  public groups: Store.GroupsState;
  public activeTask: Store.ActiveTaskState = {id: 0};
  public started: DateTime = null;
  public startForm: FormGroup;
  public duration: string;
  public latestTask: number;

  // Private properties
  private _latest$: Subscription;
  private _tasks$: Subscription;
  private _groups$: Subscription;
  private _timer$: Subscription;
  private _activeTask$: Subscription;

  constructor(
    private ngxs: Ngxs,
    private dialog: MatDialog,
    private fb: FormBuilder
  ) {
    this._log('construct!');
    this.startForm = this.fb.group({
      task: [null, Validators.required]
    });
  }

  private _log(...args: any[]): void {
    if (environment.production === false) {
      console.log('[active-tasks.component]', ...args);
    }
  }

  ngOnInit() {
    this._log('init!');
    this._tasks$ = this.ngxs.select(state => state.hours.tasks).subscribe((tasks: Store.TasksState) => {
      this.tasks = tasks;
      this.setLatestTask();
    });
    this._groups$ = this.ngxs.select(state => state.hours.groups).subscribe((groups: Store.GroupsState) => this.groups = groups);

    this._activeTask$ = this.ngxs.select(state => state.hours.activeTask).subscribe((active: Store.ActiveTaskState) => {
      this._log('active task', active);
      if (active && active.id > 0 && active.started) {
        this.started = DateTime.fromJSDate(active.started);
      } else {
        this.started = null;
      }
      this.activeTask = active;
    });

    this._timer$ = timer(0, 1000).pipe(
      filter(() => this.started !== null)
    ).subscribe(() => {
      let d = {hours: 0, minutes: 0, seconds: 0};
      d = {...d, ...DateTime.local().diff(this.started, ['hours', 'minutes', 'seconds']).toObject()};
      this.duration = '' +
        (d.hours < 10 ? '0' : '') + d.hours + ':' +
        (d.minutes < 10 ? '0' : '') + d.minutes + ':' +
        (d.seconds < 10 ? '0' : '') + Math.floor(d.seconds);
    });

    this.filteredTasks = this.startForm.get('task').valueChanges.pipe(
      startWith<string | Schema.ITask>(''),
      map(value => {
        this._log('filter map 1st:', value);
        return typeof value === 'string' ? value : value.name;
      }),
      map(name => {
        this._log('filter map 2nd:', name);
        return name ? this.filter(name) : this.tasks.allIds.map(id => this.tasks.byId[id]);
      })
    );

    this._latest$ = this.ngxs.select(state => state.hours.latestTask).subscribe((taskId: number) => {
      this.latestTask = taskId;
      this.setLatestTask();
    });
  }

  ngOnDestroy() {
    this._latest$.unsubscribe();
    this._tasks$.unsubscribe();
    this._groups$.unsubscribe();
    this._activeTask$.unsubscribe();
    this._timer$.unsubscribe();
  }

  setLatestTask(): void {
    if (this.tasks.byId[this.latestTask]) {
      this.startForm.patchValue({
        task: this.tasks.byId[this.latestTask]
      });
    }
  }

  filter(name: string): Schema.ITask[] {
    const f = this.tasks.allIds.filter(id => {
      return this.tasks.byId[id].name.toLowerCase().indexOf(name.toLowerCase()) === 0;
    }).map(id => this.tasks.byId[id]);

    this._log('filter', name, f);
    return f;
  }

  displayFn(task?: Schema.ITask): string | undefined {
    return task ? task.name : undefined;
  }

  startTask() {
    if (this.startForm.valid) {
      this.ngxs.dispatch(new Store.StartTask(this.startForm.value.task)).toPromise().then((res) => {
        // started
        this._log('response', res);
      }).catch(e => {
        this._log('starting task failed!');
      });
    }
  }

  stopTask() {
    if (this.activeTask.id > 0) {
      this.dialog.open(StopTaskComponent, {
        data: {
          tasks: this.tasks.allIds.map(id => ({id, name: this.tasks.byId[id].name})),
          start: this.activeTask.started,
          id: this.activeTask.id,
          end: new Date(),
          notes: ''
        }
      }).afterClosed().toPromise().then((res: Schema.IStopTask) => {
        if (res) {
          this._log('Stopping task!', res);
          this.ngxs.dispatch(new Store.StopTask(res)).toPromise().then(() => {
            this.activeTask.started = null;
            this.activeTask.id = 0;
          });
        } else {
          this._log('Canceled task stop');
        }
      });
    }
  }
}
