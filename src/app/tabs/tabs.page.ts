import { Component } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { LoadingService } from '../services/loading.service';
import { RoleService } from '../services/role.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  constructor(
    public auth: AuthService,
    private menuCtrl: MenuController,
    public notifService: NotificationService,
    public loadingService: LoadingService,
    // Rôles personnalisés : un onglet que le rôle ne permet pas de voir est masqué.
    public roles: RoleService
  ) {}

  // Le 5e onglet "Menu" n'est pas une route : il ouvre le tiroir latéral existant
  // (même menuId que celui utilisé partout ailleurs — voir app.component.html/.ts).
  openMenu(): void {
    this.menuCtrl.open('main-menu');
  }
}
