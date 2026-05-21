/**
 * OGMTestPanel.jsx
 *
 * Overclock'taki wrongTopics → OGM kazanım eşleştirme + PDF üretme paneli.
 *
 * Akış:
 *   1. Yanlış konuları listele
 *   2. Eşleştirmesi olmayan konular için "OGM Kazanım Seç" butonunu göster
 *   3. Seçim modal'ı: ders → sınıf → kazanım seçimi (OGM API'sinden çekilerek)
 *   4. Seçim kaydedilir (localStorage["ogm_mapping"]), bir daha sorulmaz
 *   5. Eşleşmiş konular için "PDF Oluştur" butonu
 */

import { useState, useEffect, useCallback } from "react";
import {
  getWrongTopics,
  getOGMMapping,
  saveOGMMapping,
  generatePDFForTopic,
  OGM_DERSLER,
  OGM_SINIF_DERS_IDS,
} from "./ogmIntegration";

// ─── OGM API çağrıları ────────────────────────────────────────────────────

async function fetchKazanimlar(slug, sinifId, dersId) {
  const url = `https://ogmmateryal.eba.gov.tr/soru-bankasi-kazanim/${slug}?s=${sinifId}&d=${dersId}&u=0&k=0`;
  const res = await fetch(url);
  const html = await res.text();

  // HTML'den kazanımları parse et
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const kazanimlar = [];
  // OGM sayfasında kazanımlar liste öğesi olarak geliyor
  doc.querySelectorAll("li").forEach((li) => {
    const text = li.textContent?.trim();
    const link = li.querySelector("a");
    const href = link?.getAttribute("href") || "";

    // k= parametresini URL'den al
    const kMatch = href.match(/[?&]k=(\d+)/);
    if (kMatch && text && text.length > 5) {
      kazanimlar.push({ id: parseInt(kMatch[1]), ad: text });
    }

    // Checkbox input'tan al (alternatif)
    const cb = li.querySelector("input[type='checkbox']");
    if (cb) {
      const cbId = parseInt(cb.value || cb.getAttribute("data-id") || "0");
      const label = li.textContent?.trim() || "";
      if (cbId > 0 && label) kazanimlar.push({ id: cbId, ad: label });
    }
  });

  // input[type=checkbox] ile de tara (OGM'nin asıl yapısı)
  doc.querySelectorAll("input[type='checkbox'][value]").forEach((cb) => {
    const id = parseInt(cb.value);
    const label =
      cb.closest("label")?.textContent?.trim() ||
      cb.parentElement?.textContent?.trim() ||
      `Kazanım ${id}`;
    if (id > 0 && !kazanimlar.find((k) => k.id === id)) {
      kazanimlar.push({ id, ad: label });
    }
  });

  return kazanimlar;
}

// ─── Eşleştirme Modal'ı ───────────────────────────────────────────────────

function MappingModal({ topic, onSave, onClose }) {
  const [ders, setDers] = useState("");
  const [sinifIdx, setSinifIdx] = useState(0);
  const [kazanimlar, setKazanimlar] = useState([]);
  const [seciliIds, setSeciliIds] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");

  const sinifler = ders ? (OGM_SINIF_DERS_IDS[ders] || []) : [];
  const secilenSinif = sinifler[sinifIdx];

  const kazanimlariYukle = useCallback(async () => {
    if (!ders || !secilenSinif) return;
    setYukleniyor(true);
    setHata("");
    setKazanimlar([]);
    setSeciliIds([]);
    try {
      const list = await fetchKazanimlar(ders, secilenSinif.sinifId, secilenSinif.dersId);
      setKazanimlar(list);
      if (list.length === 0) {
        setHata("Kazanım bulunamadı. OGM sitesine doğrudan erişim gerekebilir.");
      }
    } catch (e) {
      setHata("Yüklenemedi: " + String(e));
    } finally {
      setYukleniyor(false);
    }
  }, [ders, secilenSinif]);

  useEffect(() => {
    kazanimlariYukle();
  }, [kazanimlariYukle]);

  const toggleKazanim = (id) => {
    setSeciliIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const kaydet = () => {
    if (!secilenSinif || seciliIds.length === 0) return;
    onSave(topic.key, {
      dersSlug:   ders,
      sinifId:    secilenSinif.sinifId,
      dersId:     secilenSinif.dersId,
      kazanimIds: seciliIds,
    });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>
            🎯 OGM Kazanım Seç
          </span>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.topicBadge}>
          Konu: <strong>{topic.name}</strong>
        </div>

        {/* Ders seçimi */}
        <label style={styles.label}>Ders</label>
        <select
          value={ders}
          onChange={(e) => { setDers(e.target.value); setSinifIdx(0); }}
          style={styles.select}
        >
          <option value="">— Seç —</option>
          {OGM_DERSLER.map((d) => (
            <option key={d.slug} value={d.slug}>{d.label}</option>
          ))}
        </select>

        {/* Sınıf seçimi */}
        {sinifler.length > 0 && (
          <>
            <label style={styles.label}>Sınıf</label>
            <div style={styles.sinifRow}>
              {sinifler.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSinifIdx(i)}
                  style={{
                    ...styles.sinifBtn,
                    ...(sinifIdx === i ? styles.sinifBtnActive : {}),
                  }}
                >
                  {s.sinifAdi}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Kazanım listesi */}
        {yukleniyor && (
          <div style={styles.loadingMsg}>⏳ Kazanımlar yükleniyor...</div>
        )}
        {hata && (
          <div style={styles.hataMsg}>{hata}</div>
        )}
        {!yukleniyor && kazanimlar.length > 0 && (
          <>
            <label style={styles.label}>
              Kazanımlar ({seciliIds.length} seçili)
            </label>
            <div style={styles.kazanimList}>
              {kazanimlar.map((k) => (
                <label key={k.id} style={styles.kazanimItem}>
                  <input
                    type="checkbox"
                    checked={seciliIds.includes(k.id)}
                    onChange={() => toggleKazanim(k.id)}
                    style={{ marginRight: 8, accentColor: "#00ff88" }}
                  />
                  <span style={{ fontSize: 13, lineHeight: 1.4 }}>{k.ad}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {/* Kaydet butonu */}
        <button
          onClick={kaydet}
          disabled={seciliIds.length === 0}
          style={{
            ...styles.saveBtn,
            ...(seciliIds.length === 0 ? styles.saveBtnDisabled : {}),
          }}
        >
          ✅ Kaydet ({seciliIds.length} kazanım)
        </button>
      </div>
    </div>
  );
}

// ─── Ana Panel ────────────────────────────────────────────────────────────

export default function OGMTestPanel() {
  const [topics, setTopics] = useState([]);
  const [mapping, setMapping] = useState({});
  const [modalTopic, setModalTopic] = useState(null);
  const [pdfDurum, setPdfDurum] = useState({});  // { [key]: "yukleniyor"|"tamam"|"hata" }

  useEffect(() => {
    setTopics(getWrongTopics());
    setMapping(getOGMMapping());
  }, []);

  const handleSaveMapping = (key, ogmMapping) => {
    const updated = { ...mapping, [key]: ogmMapping };
    setMapping(updated);
    saveOGMMapping(updated);
    setModalTopic(null);
  };

  const handlePDF = async (topic) => {
    const m = mapping[topic.key];
    if (!m) return;

    setPdfDurum((prev) => ({ ...prev, [topic.key]: "yukleniyor" }));
    try {
      const msg = await generatePDFForTopic(topic, m);
      setPdfDurum((prev) => ({ ...prev, [topic.key]: "tamam" }));
      alert(msg);
    } catch (e) {
      setPdfDurum((prev) => ({ ...prev, [topic.key]: "hata" }));
      alert("Hata: " + String(e));
    }
  };

  if (topics.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={{ fontSize: 40 }}>🎯</div>
        <p style={{ color: "#888", marginTop: 12 }}>
          Henüz yanlış konu yok.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>📄 OGM Test Oluştur</span>
        <span style={styles.headerSub}>{topics.length} yanlış konu</span>
      </div>

      {topics.map((topic) => {
        const m = mapping[topic.key];
        const durum = pdfDurum[topic.key];
        const progress = topic.target > 0
          ? Math.round((topic.solved / topic.target) * 100)
          : 0;

        return (
          <div key={topic.key} style={styles.card}>
            {/* Konu adı ve ilerleme */}
            <div style={styles.cardTop}>
              <div>
                <div style={styles.topicName}>{topic.name}</div>
                <div style={styles.topicMeta}>
                  {topic.solved}/{topic.target} soru · Seviye {topic.level}
                </div>
              </div>
              <div style={styles.progressRing}>
                <svg width="44" height="44">
                  <circle cx="22" cy="22" r="18" fill="none"
                    stroke="#222" strokeWidth="4" />
                  <circle cx="22" cy="22" r="18" fill="none"
                    stroke={progress >= 100 ? "#00ff88" : "#ff4444"}
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 22 22)"
                  />
                  <text x="22" y="27" textAnchor="middle"
                    fill="#fff" fontSize="11" fontWeight="bold">
                    {progress}%
                  </text>
                </svg>
              </div>
            </div>

            {/* OGM eşleştirme durumu */}
            {m ? (
              <div style={styles.mappingInfo}>
                ✅ {OGM_DERSLER.find(d => d.slug === m.dersSlug)?.label ?? m.dersSlug}
                {" · "}
                {OGM_SINIF_DERS_IDS[m.dersSlug]?.find(s => s.sinifId === m.sinifId)?.sinifAdi ?? ""}
                {" · "}{m.kazanimIds.length} kazanım
              </div>
            ) : (
              <div style={styles.noMapping}>
                ⚠️ OGM kazanımı henüz eşleştirilmedi
              </div>
            )}

            {/* Butonlar */}
            <div style={styles.btnRow}>
              <button
                onClick={() => setModalTopic(topic)}
                style={styles.mapBtn}
              >
                {m ? "✏️ Değiştir" : "🔗 OGM Eşleştir"}
              </button>

              {m && (
                <button
                  onClick={() => handlePDF(topic)}
                  disabled={durum === "yukleniyor"}
                  style={{
                    ...styles.pdfBtn,
                    ...(durum === "yukleniyor" ? styles.btnLoading : {}),
                    ...(durum === "tamam"      ? styles.btnDone    : {}),
                    ...(durum === "hata"       ? styles.btnError   : {}),
                  }}
                >
                  {durum === "yukleniyor" ? "⏳ Oluşturuluyor..." :
                   durum === "tamam"      ? "✅ PDF Hazır" :
                   durum === "hata"       ? "❌ Tekrar Dene" :
                   "📄 PDF Oluştur"}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Eşleştirme modal'ı */}
      {modalTopic && (
        <MappingModal
          topic={modalTopic}
          onSave={handleSaveMapping}
          onClose={() => setModalTopic(null)}
        />
      )}
    </div>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────

const styles = {
  container: {
    background: "#0a0a0a",
    minHeight: "100vh",
    padding: "16px",
    fontFamily: "'Courier New', monospace",
    color: "#f0f0f0",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
    borderBottom: "1px solid #222",
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", letterSpacing: 1 },
  headerSub:   { fontSize: 12, color: "#666" },

  card: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 8,
    padding: "14px",
    marginBottom: 10,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  topicName: { fontSize: 15, fontWeight: "bold", color: "#fff", marginBottom: 3 },
  topicMeta: { fontSize: 12, color: "#666" },
  progressRing: { flexShrink: 0 },

  mappingInfo: { fontSize: 12, color: "#00cc66", marginBottom: 10 },
  noMapping:   { fontSize: 12, color: "#ff8800", marginBottom: 10 },

  btnRow: { display: "flex", gap: 8 },
  mapBtn: {
    flex: 1,
    padding: "8px 0",
    background: "#1a1a1a",
    color: "#aaa",
    border: "1px solid #333",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "'Courier New', monospace",
  },
  pdfBtn: {
    flex: 2,
    padding: "8px 0",
    background: "#003311",
    color: "#00ff88",
    border: "1px solid #00aa44",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "'Courier New', monospace",
  },
  btnLoading: { background: "#111",  color: "#666",    border: "1px solid #333" },
  btnDone:    { background: "#002211", color: "#00ff88", border: "1px solid #00aa44" },
  btnError:   { background: "#220000", color: "#ff4444", border: "1px solid #aa0000" },

  emptyState: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: "60vh",
    fontFamily: "'Courier New', monospace",
    background: "#0a0a0a",
  },

  // Modal
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: "16px 16px 0 0",
    padding: "20px 16px 32px",
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    overflowY: "auto",
    fontFamily: "'Courier New', monospace",
    color: "#f0f0f0",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: "bold" },
  closeBtn: {
    background: "none", border: "none",
    color: "#666", fontSize: 18, cursor: "pointer",
  },
  topicBadge: {
    background: "#0a0a0a", border: "1px solid #222",
    borderRadius: 6, padding: "8px 12px",
    fontSize: 13, color: "#aaa", marginBottom: 16,
  },
  label: {
    display: "block", fontSize: 11, color: "#666",
    letterSpacing: 1, textTransform: "uppercase",
    marginBottom: 6, marginTop: 14,
  },
  select: {
    width: "100%", padding: "10px 12px",
    background: "#1a1a1a", border: "1px solid #333",
    borderRadius: 6, color: "#fff", fontSize: 14,
    fontFamily: "'Courier New', monospace",
  },
  sinifRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  sinifBtn: {
    padding: "6px 12px",
    background: "#1a1a1a", border: "1px solid #333",
    borderRadius: 6, color: "#888", fontSize: 12,
    cursor: "pointer", fontFamily: "'Courier New', monospace",
  },
  sinifBtnActive: {
    background: "#002211", border: "1px solid #00aa44", color: "#00ff88",
  },
  loadingMsg: { color: "#666", fontSize: 13, padding: "16px 0", textAlign: "center" },
  hataMsg:    { color: "#ff6600", fontSize: 13, padding: "12px 0" },
  kazanimList: {
    maxHeight: 280, overflowY: "auto",
    border: "1px solid #1e1e1e", borderRadius: 6,
    padding: "4px 0",
  },
  kazanimItem: {
    display: "flex", alignItems: "flex-start",
    padding: "8px 12px", cursor: "pointer",
    borderBottom: "1px solid #1a1a1a",
    color: "#ccc",
  },
  saveBtn: {
    width: "100%", marginTop: 16,
    padding: "12px 0",
    background: "#003311", color: "#00ff88",
    border: "1px solid #00aa44", borderRadius: 8,
    fontSize: 14, fontWeight: "bold",
    cursor: "pointer", fontFamily: "'Courier New', monospace",
  },
  saveBtnDisabled: {
    background: "#111", color: "#444",
    border: "1px solid #222", cursor: "not-allowed",
  },
};
