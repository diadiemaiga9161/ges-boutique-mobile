import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

interface Message {
  role: 'user' | 'assistant';
  texte: string;
  heure: string;
}

interface QuestionPredefinies {
  id: string;
  label: string;
  icone: string;
}

const QUESTIONS_PREDEFINIES: Record<string, string> = {
  ventes_jour: "J'ai vendu combien aujourd'hui ?",
  comptant_credit: 'Quelle est la différence entre mes ventes comptant et crédit ce mois ?',
  mobile_money: 'Quel est le total de mes paiements Orange Money et Moov Money ?',
  credits_dus: 'Quels clients ont encore des dettes non réglées ?',
  stock_faible: 'Quels produits sont en alerte de stock ?',
  conseils: 'Donne-moi des conseils pour améliorer ma gestion de boutique.',
  bilan_semaine: 'Quel est mon bilan pour cette semaine ?',
  bilan_mois: 'Quel est mon bilan pour ce mois ?'
};

@Component({
  selector: 'app-assistant-ia',
  templateUrl: './assistant-ia.page.html',
  standalone: false
})
export class AssistantIaPage implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: Message[] = [];
  questionsPredefinies: QuestionPredefinies[] = [];
  texteLibre = '';
  loading = false;
  afficherQuestions = true;

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.chargerQuestions();
    this.messages.push({
      role: 'assistant',
      texte: "Bonjour ! Je suis votre assistant de gestion. Posez-moi une question sur votre boutique ou choisissez parmi les suggestions ci-dessous. 😊",
      heure: this.heureActuelle()
    });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private headers(): HttpHeaders {
    const token = this.auth.getToken() || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  chargerQuestions() {
    this.http.get<QuestionPredefinies[]>('/api/ia/questions-predefinies', { headers: this.headers() })
      .subscribe({ next: (q) => { this.questionsPredefinies = q; } });
  }

  poserQuestionPredefinies(id: string) {
    const question = QUESTIONS_PREDEFINIES[id] || id;
    this.envoyerQuestion(question);
  }

  envoyerTexteLibre() {
    if (!this.texteLibre.trim()) return;
    const q = this.texteLibre.trim();
    this.texteLibre = '';
    this.envoyerQuestion(q);
  }

  private envoyerQuestion(question: string) {
    this.afficherQuestions = false;
    this.messages.push({ role: 'user', texte: question, heure: this.heureActuelle() });
    this.loading = true;

    this.http.post<{ reponse: string }>('/api/ia/chat', { question }, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          this.messages.push({ role: 'assistant', texte: res.reponse, heure: this.heureActuelle() });
          this.loading = false;
        },
        error: () => {
          this.messages.push({
            role: 'assistant',
            texte: "Désolé, une erreur s'est produite. Vérifie ta connexion et réessaie.",
            heure: this.heureActuelle()
          });
          this.loading = false;
        }
      });
  }

  nouvelleConversation() {
    this.messages = [{
      role: 'assistant',
      texte: "Bonjour ! Je suis votre assistant de gestion. Comment puis-je vous aider ? 😊",
      heure: this.heureActuelle()
    }];
    this.afficherQuestions = true;
  }

  private scrollToBottom() {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  private heureActuelle(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
