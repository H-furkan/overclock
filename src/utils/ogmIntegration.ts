import { registerPlugin } from '@capacitor/core';

// ─── Capacitor Plugin arayüzü ─────────────────────────────────────────────

interface OGMPluginInterface {
  generateTestPDF(options: {
    kazanimIds: number[];
    dersSlug:   string;
    sinifId:    number;
    dersId:     number;
    testAdi:    string;
  }): Promise<{ success: boolean; jobId: string; message: string }>;
}

export const OGMPlugin = registerPlugin<OGMPluginInterface>('OGMPlugin');

// ─── Overclock wrongTopics yapısı ────────────────────────────────────────
//
// localStorage["overclock_v5"].wrongTopics:
// {
//   [key: string]: {         ← key = kullanıcının girdiği serbest metin (örn: "dalgalar")
//     name:    string;       ← görünen ad (örn: "Dalgalar")
//     level:   number;       ← tekrar seviyesi
//     solved:  number;       ← doğru çözülen soru sayısı
//     fixed:   boolean;      ← tamamlandı mı
//     target:  number;       ← hedef soru sayısı (örn: 15)
//     history: Array<{ date: string; examId: number }>;
//   }
// }

export interface WrongTopic {
  key:     string;   // "dalgalar"
  name:    string;   // "Dalgalar"
  solved:  number;
  target:  number;
  fixed:   boolean;
  level:   number;
}

// ─── OGM sabit veri tablosu ───────────────────────────────────────────────

export const OGM_DERSLER = [
  { slug: 'matematik',   label: 'Matematik' },
  { slug: 'fizik',       label: 'Fizik' },
  { slug: 'kimya',       label: 'Kimya' },
  { slug: 'biyoloji',    label: 'Biyoloji' },
  { slug: 'tarih',       label: 'Tarih' },
  { slug: 'cografya',    label: 'Coğrafya' },
  { slug: 'tde',         label: 'Türk Dili ve Edebiyatı' },
  { slug: 'felsefe',     label: 'Felsefe' },
  { slug: 'ingilizce',   label: 'İngilizce' },
  { slug: 'fl-matematik',label: 'Fen Lisesi Matematik' },
  { slug: 'fl-fizik',    label: 'Fen Lisesi Fizik' },
  { slug: 'fl-kimya',    label: 'Fen Lisesi Kimya' },
  { slug: 'fl-biyoloji', label: 'Fen Lisesi Biyoloji' },
];

// sinifId ve dersId → OGM URL parametreleri
// Kaynak: ogmmateryal.eba.gov.tr/soru-bankasi-kazanim/{slug}?s=X&d=Y
export const OGM_SINIF_DERS_IDS: Record<string, Array<{
  sinifAdi: string; sinifId: number; dersId: number;
}>> = {
  matematik:    [
    { sinifAdi: '9. Sınıf',  sinifId: 6,  dersId: 48 },
    { sinifAdi: '10. Sınıf', sinifId: 7,  dersId: 49 },
    { sinifAdi: '11. Sınıf', sinifId: 8,  dersId: 50 },
    { sinifAdi: '12. Sınıf', sinifId: 9,  dersId: 51 },
  ],
  fizik: [
    { sinifAdi: '9. Sınıf',  sinifId: 6,  dersId: 52 },
    { sinifAdi: '10. Sınıf', sinifId: 7,  dersId: 53 },
    { sinifAdi: '11. Sınıf', sinifId: 8,  dersId: 54 },
    { sinifAdi: '12. Sınıf', sinifId: 9,  dersId: 55 },
  ],
  kimya: [
    { sinifAdi: '9. Sınıf',  sinifId: 6,  dersId: 56 },
    { sinifAdi: '10. Sınıf', sinifId: 7,  dersId: 57 },
    { sinifAdi: '11. Sınıf', sinifId: 8,  dersId: 58 },
    { sinifAdi: '12. Sınıf', sinifId: 9,  dersId: 59 },
  ],
  biyoloji: [
    { sinifAdi: '9. Sınıf',  sinifId: 6,  dersId: 5 },
    { sinifAdi: '10. Sınıf', sinifId: 7,  dersId: 6 },
    { sinifAdi: '11. Sınıf', sinifId: 8,  dersId: 7 },
    { sinifAdi: '12. Sınıf', sinifId: 9,  dersId: 8 },
  ],
};

// ─── Overclock'tan yanlış konuları oku ────────────────────────────────────

export function getWrongTopics(): WrongTopic[] {
  try {
    const raw = localStorage.getItem('overclock_v5');
    if (!raw) return [];
    const state = JSON.parse(raw);
    const wt: Record<string, any> = state.wrongTopics ?? {};

    return Object.entries(wt)
      .filter(([, v]) => !v.fixed)           // çözülmüş konuları atla
      .map(([key, v]) => ({
        key,
        name:   v.name   ?? key,
        solved: v.solved ?? 0,
        target: v.target ?? 15,
        fixed:  v.fixed  ?? false,
        level:  v.level  ?? 0,
      }))
      .sort((a, b) => a.solved - b.solved);  // en az çözülen başta
  } catch {
    return [];
  }
}

// ─── OGM Kazanım seçici: kullanıcıya konu→kazanım eşleştirme UI'ı ────────
//
// wrongTopics key'leri serbest metin olduğu için otomatik OGM eşleştirmesi
// mümkün değil. Bunun yerine:
//   1. Kullanıcıya yanlış konularını göster
//   2. Her konu için OGM kazanımlarını seçmesini iste (tek seferlik)
//   3. Seçimleri localStorage'a kaydet, bir daha sorma
//
// Seçim formatı: localStorage["ogm_mapping"] = {
//   "dalgalar": { dersSlug: "fizik", sinifId: 8, dersId: 54, kazanimIds: [4060, 4061] },
//   "optik":    { dersSlug: "fizik", sinifId: 8, dersId: 54, kazanimIds: [4070] },
// }

export interface OGMMapping {
  dersSlug:   string;
  sinifId:    number;
  dersId:     number;
  kazanimIds: number[];
}

export function getOGMMapping(): Record<string, OGMMapping> {
  try {
    const raw = localStorage.getItem('ogm_mapping');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveOGMMapping(mapping: Record<string, OGMMapping>): void {
  localStorage.setItem('ogm_mapping', JSON.stringify(mapping));
}

// ─── PDF üretici ─────────────────────────────────────────────────────────

export async function generatePDFForTopic(
  topic: WrongTopic,
  mapping: OGMMapping
): Promise<string> {
  const result = await OGMPlugin.generateTestPDF({
    kazanimIds: mapping.kazanimIds,
    dersSlug:   mapping.dersSlug,
    sinifId:    mapping.sinifId,
    dersId:     mapping.dersId,
    testAdi:    `${topic.name} — OGM Soruları`,
  });
  return result.message;
}
