import { Injectable } from '@angular/core';

export type DesignFacture = 1 | 2 | 3;

export interface DesignInfo {
  id: DesignFacture;
  nom: string;
  description: string;
  couleurPrimaire: string;
  couleurSecondaire: string;
  preview: string;
}

export const DESIGNS: DesignInfo[] = [
  {
    id: 1,
    nom: 'Classique',
    description: 'Design professionnel bleu et blanc, sobre et élégant',
    couleurPrimaire: '#1e40af',
    couleurSecondaire: '#eff6ff',
    preview: 'classic'
  },
  {
    id: 2,
    nom: 'Moderne',
    description: 'Design contemporain avec en-tête sombre et accent coloré',
    couleurPrimaire: '#0f172a',
    couleurSecondaire: '#f59e0b',
    preview: 'modern'
  },
  {
    id: 3,
    nom: 'Minimaliste',
    description: 'Design épuré, noir et blanc, très lisible',
    couleurPrimaire: '#18181b',
    couleurSecondaire: '#f4f4f5',
    preview: 'minimal'
  }
];

const STORAGE_KEY = 'facture_design';

@Injectable({ providedIn: 'root' })
export class FactureDesignService {

  getDesign(): DesignFacture {
    const saved = localStorage.getItem(STORAGE_KEY);
    const n = parseInt(saved || '1', 10);
    return (n === 1 || n === 2 || n === 3) ? n as DesignFacture : 1;
  }

  setDesign(d: DesignFacture): void {
    localStorage.setItem(STORAGE_KEY, String(d));
  }

  getDesignInfo(): DesignInfo {
    return DESIGNS.find(d => d.id === this.getDesign()) || DESIGNS[0];
  }
}
