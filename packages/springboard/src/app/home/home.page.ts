import { Component, OnInit } from '@angular/core';
import { IonHeader, IonLabel, IonRadio, IonRadioGroup, IonToolbar, IonTitle, IonContent } from '@ionic/angular/standalone';

import { AppsService } from "../services/apps/apps.service";

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonLabel, IonRadio, IonRadioGroup, IonToolbar, IonTitle, IonContent],
})
export class HomePage implements OnInit {

public apps: Array<{url: string, title: string}> = [
{
title: "Welcome",
url: "/components/springboard/index.html#/welcome"
}
];

  constructor( private appsService: AppsService ) {}

ngOnInit() {

this.appsService.getApps().subscribe( {
next: ( apps: any ) => {
this.apps = apps;
}
} );

}

public onAppLaunch( url: string ): void {
if( url.startsWith( "/" ) )
{
url = `${window.location.href}${url}`;
}

parent.postMessage( { name: 'CBNavigateTo', detail: { url: url } }, '*' );
}

}
