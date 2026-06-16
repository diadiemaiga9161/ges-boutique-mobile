import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false
})
export class NotificationsPage implements OnInit, OnDestroy {

  notifications: Notification[] = [];
  isLoading = false;
  private subs: Subscription[] = [];

  constructor(
    private notifService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.notifService.nonLues$.subscribe(n => this.notifications = n)
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  ionViewWillEnter(): void {
    this.notifService.charger();
  }

  cliquer(n: Notification): void {
    this.notifService.marquerLue(n.id).subscribe(() => {
      if (n.lien) this.router.navigateByUrl(n.lien);
    });
  }

  toutLire(): void {
    this.notifService.marquerToutesLues().subscribe();
  }

  icone(type: string): string {
    const map: Record<string, string> = {
      STOCK_FAIBLE: 'alert-circle-outline',
      RUPTURE_STOCK: 'warning-outline',
      TRANSFERT_RECU: 'arrow-forward-outline',
      TRANSFERT_MODIFIE: 'create-outline',
      TRANSFERT_CONFIRME: 'checkmark-circle-outline',
    };
    return map[type] ?? 'notifications-outline';
  }

  couleur(type: string): string {
    if (type === 'RUPTURE_STOCK') return 'danger';
    if (type === 'STOCK_FAIBLE') return 'warning';
    if (type === 'TRANSFERT_CONFIRME') return 'success';
    return 'primary';
  }
}
