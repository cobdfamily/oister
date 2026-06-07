import { HttpClient } from "@angular/common/http";
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AppsService {

  constructor( private httpClient: HttpClient ) { }

public getApps() {
return this.httpClient.get( "assets/apps.json" );
}

}
