import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Dictionary } from 'lodash';
import { Observable } from 'rxjs/Observable';
import { of } from 'rxjs/observable/of';
import { shareReplay } from 'rxjs/operators/shareReplay';
import { switchMap } from 'rxjs/operators/switchMap';
import { map } from 'rxjs/operators/map';
import { forkJoin } from 'rxjs/observable/forkJoin';

@Injectable()
export class DemoFileLoaderService {

  private fileCache = new Map<string, Observable<Dictionary<string>>>();

  constructor(
    private http: HttpClient
  ) {
    // Preload this file since it's used in every demos
    this.loadFile('example.css');
  }

  getDemoFiles(exampleName: string) {
    let req$ = this.fileCache.get(exampleName);
    if (req$) {
      return req$;
    }
    req$ = this.http.get(`app/demo/examples/${exampleName}.component.ts`, {
      responseType: 'text'
    }).pipe(
      switchMap((fileContent) => this.loadAdditionnalFilesIfNecessary(fileContent)),
      shareReplay(1)
      );
    this.fileCache.set(exampleName, req$);
    return req$;
  }

  private loadAdditionnalFilesIfNecessary(fileContent: string) {
    const r = /'\.\/([\w-.]+\.\w+)'/g;
    let match;
    const files = [];
    const result = {
      'demo.ts': fileContent
    };
    while (match = r.exec(fileContent)) {
      files.push(this.loadFile(match[1]));
    }
    if (files.length) {
      return forkJoin(files).pipe(
        map((files) => {
          return {
            ...Object.assign({}, ...files),
            ...result
          };
        })
      );
    }
    return of(result);
  }

  private loadFile(fileName: string) {
    let req$ = this.fileCache.get(fileName);
    if (req$) {
      return req$;
    }
    req$ = this.http.get(`app/demo/examples/${fileName}`, {
      responseType: 'text'
    }).pipe(
      map((fileContent) => ({
        [fileName]: fileContent
      })),
      shareReplay(1)
      );
    this.fileCache.set(fileName, req$);
    return req$;
  }
}
