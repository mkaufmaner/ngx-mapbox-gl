import { HttpClient } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild
  } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import StackBlitzSDK from '@stackblitz/sdk';
import { VM } from '@stackblitz/sdk/typings/VM';
import { Dictionary } from 'lodash';
import { AsyncSubject } from 'rxjs/AsyncSubject';
import { Observable } from 'rxjs/Observable';
import { forkJoin } from 'rxjs/observable/forkJoin';
import { shareReplay } from 'rxjs/operators/shareReplay';
import { Subscription } from 'rxjs/Subscription';
import { DemoFileLoaderService } from '../demo-file-loader.service';

@Component({
  template: `
    <div #container></div>
    <div *ngIf="loading" class="loader"><mat-spinner></mat-spinner><div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      position: relative;
    }
    :host ::ng-deep iframe {
      height: 100%;
      width: 100%;
      border: 0;
    }
    .loader {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%,-50%);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StackblitzEditComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container') stackblitzContainer: ElementRef;

  loading: boolean;

  private sub: Subscription;
  private base$: Observable<string>;

  private afterViewInit = new AsyncSubject<void>();
  private vm: VM;

  constructor(
    private http: HttpClient,
    private zone: NgZone,
    private activatedRoute: ActivatedRoute,
    private DemoFileLoaderService: DemoFileLoaderService,
    private ChangeDetectorRef: ChangeDetectorRef
  ) {
    this.base$ = this.http.get('assets/stackblitz-base.txt', {
      responseType: 'text'
    }).pipe(shareReplay(1));
    this.sub = this.activatedRoute.params.subscribe((params) => {
      this.loading = true;
      this.ChangeDetectorRef.markForCheck();
      forkJoin(
        this.base$,
        this.DemoFileLoaderService.getDemoFiles(params.demoUrl)
      ).subscribe(([base, demoFiles]) => this.openExample(base, demoFiles));
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  ngAfterViewInit() {
    this.afterViewInit.complete();
  }

  private async openExample(base: string, demoFiles: Dictionary<string>) {
    await this.afterViewInit.toPromise();
    if (this.vm) {
      await this.vm.applyFsDiff({
        create: {
          ...demoFiles
        },
        destroy: []
      });
      this.loading = false;
      this.ChangeDetectorRef.markForCheck();
      return;
    }
    const project = {
      files: {
        'main.ts': base,
        'index.html': '<mgl-demo></mgl-demo>',
        '.angular-cli.json': `
{
"apps": [{
  "styles": ["styles.css"]
}]
}`,
        'styles.css': `
@import "~@angular/material/prebuilt-themes/indigo-pink.css";
@import "~mapbox-gl/dist/mapbox-gl.css";
html, body {
display: flex;
flex: 1;
min-height: 100vh;
margin: 0;
}
`,
        ...demoFiles
      },
      title: '',
      description: '',
      template: 'angular-cli',
      dependencies: {
        tslib: '*',
        'mapbox-gl': '*',
        'ngx-mapbox-gl': '*',
        '@angular/cdk': '*',
        '@angular/material': '*',
        '@angular/animations': '*',
        '@angular/forms': '*',
        'url': '*',
        'querystring': '*'
      }
    };
    this.zone.runOutsideAngular(async () => {
      this.vm = await StackBlitzSDK.embedProject(this.stackblitzContainer.nativeElement, project, {
        hideExplorer: true,
        hideNavigation: true,
        forceEmbedLayout: true,
        openFile: 'demo.ts'
      });
      this.loading = false;
      this.ChangeDetectorRef.detectChanges();
    });
  }
}
