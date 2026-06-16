import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor(
    public auth: AuthService,
    private router: Router,
    public notifService: NotificationService,
    public loadingService: LoadingService
  ) {}

  newSale(): void {
    this.router.navigateByUrl('/cart');
  }
}
