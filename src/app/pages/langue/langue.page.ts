import { Component } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Language, LanguageService, LANGUAGES } from '../../services/language.service';

@Component({
  selector: 'app-langue',
  templateUrl: './langue.page.html',
  styleUrls: ['./langue.page.scss'],
  standalone: false
})
export class LanguePage {
  languages: Language[] = LANGUAGES;

  constructor(
    public langService: LanguageService,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private translate: TranslateService
  ) {}

  get currentCode(): string {
    return this.langService.getCurrent();
  }

  async selectLanguage(lang: Language): Promise<void> {
    if (lang.code === this.currentCode) return;
    this.langService.setLanguage(lang.code);
    const msg = await this.translate.get('LANG.SELECT').toPromise();
    const toast = await this.toastCtrl.create({
      message: `${lang.flag} ${lang.name}`,
      duration: 1500,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  goBack(): void {
    this.navCtrl.back();
  }
}
