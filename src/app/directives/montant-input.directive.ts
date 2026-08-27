import { Directive, ElementRef, OnDestroy, OnInit, Optional, Self } from '@angular/core';
import { AbstractControl, NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';

/**
 * Directive à appliquer sur un champ de saisie de MONTANT D'ARGENT (FCFA) :
 *
 *   <input type="text" inputmode="numeric" appMontantInput [(ngModel)]="form.montant">
 *   <ion-input type="text" inputmode="numeric" appMontantInput [(ngModel)]="form.montant"></ion-input>
 *
 * ── Pourquoi cette directive ────────────────────────────────────────────────
 * Un input natif `type="number"` ne peut représenter qu'un nombre anglo-saxon
 * (UN SEUL point = virgule décimale). Dès que l'utilisateur tape un 2e point
 * (ex: en tapant "1.000.000"), le champ devient invalide côté navigateur → sa
 * valeur DOM devient "" (badInput) → le ValueAccessor d'Angular/Ionic pousse
 * alors `null`/NaN dans le modèle ALORS QUE l'écran continue d'afficher
 * "1.000.000". L'utilisateur voit un montant correct mais l'appli utilise
 * silencieusement `null`/0.
 *
 * ── Ce que fait la directive ────────────────────────────────────────────────
 * 1. Affiche la valeur formatée avec des points comme séparateurs de milliers
 *    PENDANT LA SAISIE (ex: "1000000" → "1.000.000" au fur et à mesure).
 * 2. Nettoie l'entrée (retire tout sauf les chiffres) avant de reformater :
 *    tolère que l'utilisateur tape déjà des points, colle un texte avec des
 *    espaces/lettres, etc.
 * 3. Met à jour le ngModel/FormControl sous-jacent avec la valeur NUMÉRIQUE
 *    PURE (sans points) — le binding `[(ngModel)]` du template reste
 *    inchangé, aucune variable des .ts n'est renommée.
 * 4. Ne gère jamais de décimales : les montants FCFA sont toujours des
 *    entiers.
 * 5. Fonctionne au clavier, au copier-coller et au clavier virtuel mobile, en
 *    s'appuyant uniquement sur le pipeline standard `AbstractControl.valueChanges`
 *    d'Angular (donc indépendant de l'ordre d'exécution des autres écouteurs
 *    DOM/ValueAccessor posés sur le même élément — natif `<input>` ou
 *    `<ion-input>`).
 *
 * ── Ce qu'il faut faire en plus dans chaque page ────────────────────────────
 * Le champ doit passer de `type="number"` à `type="text" inputmode="numeric"`.
 * Les contraintes `min`/`max` HTML natives ne fonctionnant que sur
 * `type="number"`, elles doivent être reportées en TypeScript (vérification
 * avant soumission ou sur (ionBlur)/(blur)) : cette directive ne gère PAS la
 * validation min/max, uniquement le formatage/la fiabilité de la saisie.
 *
 * NE PAS utiliser sur des champs de quantité, pourcentage ou identifiant.
 */
@Directive({
  selector: '[appMontantInput]',
  standalone: true
})
export class MontantInputDirective implements OnInit, OnDestroy {

  private sub?: Subscription;
  private applying = false;

  constructor(
    private el: ElementRef<any>,
    @Optional() @Self() private ngControl?: NgControl
  ) {}

  ngOnInit(): void {
    const control = this.ngControl?.control;
    if (!control) {
      return;
    }

    this.sub = control.valueChanges.subscribe(() => {
      if (this.applying) {
        return;
      }
      // On reporte la correction au micro-tick suivant : à ce moment-là, le
      // pipeline interne d'Angular (view -> model OU model -> view) a fini de
      // s'exécuter, quel que soit l'ordre des écouteurs enregistrés sur
      // l'élément. Notre correction s'applique donc TOUJOURS en dernier.
      queueMicrotask(() => this.applyValue(control));
    });

    // Formate la valeur déjà présente à l'ouverture (ex: modale pré-remplie).
    queueMicrotask(() => this.applyValue(control));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private applyValue(control: AbstractControl): void {
    const digits = this.extractDigits(control.value);
    const numeric = digits === '' ? null : parseInt(digits, 10);
    const formatted = digits === '' ? '' : this.formatMilliers(digits);

    const host = this.el.nativeElement;
    if (host.value !== formatted) {
      host.value = formatted;
    }

    if (control.value !== numeric) {
      this.applying = true;
      // On met à jour le FormControl interne SANS redéclencher writeValue
      // (qui écraserait l'affichage formaté avec la valeur brute), puis on
      // pousse nous-mêmes la valeur numérique pure dans le ngModel/FormControl
      // exposé au composant, exactement comme le fait Angular en interne.
      control.setValue(numeric, { emitModelToViewChange: false });
      this.ngControl?.viewToModelUpdate(numeric);
      this.applying = false;
    }
  }

  private extractDigits(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).replace(/[^\d]/g, '');
  }

  private formatMilliers(digits: string): string {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
}
