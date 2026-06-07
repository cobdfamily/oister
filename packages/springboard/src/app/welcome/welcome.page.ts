import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonCard, IonContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [IonCard, IonContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, CommonModule, FormsModule]
})
export class WelcomePage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
