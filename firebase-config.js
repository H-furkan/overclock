/* ════════════════════════════════════════════════════════════════════
   FIREBASE AYARLARI — telefon ↔ tablet otomatik senkron için
   --------------------------------------------------------------------
   1) https://console.firebase.google.com → "Add project" (ücretsiz)
   2) Sol menü ⚙ → Project settings → "Your apps" → Web app ekle (</> ikonu)
   3) Sana verilen "firebaseConfig" nesnesindeki değerleri buraya yapıştır
   4) Build → Authentication → Sign-in method → "Email/Password" → Enable
   5) Build → Firestore Database → Create database → Production mode
   6) Firestore → Rules sekmesine şunu yapıştır ve Publish et:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /users/{uid} {
              allow read, write: if request.auth != null && request.auth.uid == uid;
            }
          }
        }

   Aşağıdaki alanlar BOŞ kalırsa uygulama eskisi gibi sadece yerel
   (localStorage) çalışır — hiçbir şey bozulmaz. Doldurunca senkron açılır.
   ════════════════════════════════════════════════════════════════════ */
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
