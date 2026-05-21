package com.hfurkan.overclock

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * OGMPlugin — Overclock için OGM Soru Bankası entegrasyonu
 *
 * Kullanım:
 *   OGMPlugin.generateTestPDF({
 *     kazanimIds: [3460, 3461, 3462],
 *     dersSlug: "matematik",
 *     sinifId: 9,
 *     dersId: 51,
 *     testAdi: "Türev Yanlış Konular Testi"
 *   })
 */
@CapacitorPlugin(name = "OGMPlugin")
class OGMPlugin : Plugin() {

    private var printWebView: WebView? = null

    @PluginMethod
    fun generateTestPDF(call: PluginCall) {
        val kazanimIds: JSArray = call.getArray("kazanimIds") ?: run {
            call.reject("kazanimIds gerekli")
            return
        }
        val dersSlug  = call.getString("dersSlug")  ?: "matematik"
        val sinifId   = call.getInt("sinifId")      ?: 9
        val dersId    = call.getInt("dersId")       ?: 51
        val testAdi   = call.getString("testAdi")   ?: "OGM Test"

        // Kazanım ID'lerini URL query string'e çevir
        // Örnek: &k[]=3460&k[]=3461
        val kazanimParam = buildString {
            for (i in 0 until kazanimIds.length()) {
                if (i > 0) append("&")
                append("k[]=${kazanimIds.getInt(i)}")
            }
        }

        val ogmUrl = "https://ogmmateryal.eba.gov.tr/soru-bankasi/$dersSlug/test-olustur" +
                     "?s=$sinifId&d=$dersId&$kazanimParam"

        activity.runOnUiThread {
            setupAndLoadWebView(ogmUrl, testAdi, call)
        }
    }

    private fun setupAndLoadWebView(url: String, testAdi: String, call: PluginCall) {
        val webView = WebView(activity).apply {
            settings.apply {
                javaScriptEnabled      = true
                domStorageEnabled      = true
                loadWithOverviewMode   = true
                useWideViewPort        = true
                setSupportZoom(false)
                // OGM sitesinin medya sorgularını düzgün yorumlaması için
                defaultTextEncodingName = "UTF-8"
            }

            webViewClient = object : WebViewClient() {

                private var injected = false

                override fun onPageFinished(view: WebView?, loadedUrl: String?) {
                    super.onPageFinished(view, loadedUrl)
                    if (injected) return
                    injected = true

                    // Sayfa tam yüklendikten 3 sn sonra inject et
                    view?.postDelayed({
                        injectAndPrint(view, testAdi, call)
                    }, 3_000L)
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    // Tüm yönlendirmeleri WebView içinde tut
                    return false
                }
            }
        }

        printWebView = webView
        webView.loadUrl(url)
    }

    private fun injectAndPrint(webView: WebView, testAdi: String, call: PluginCall) {
        /*
         * OGM'nin "test-olustur" sayfasında:
         *  - Checkboxlar kazanımları temsil eder.
         *  - URL'deki k[] parametreleri sayfaya geldiğinde zaten seçili olabilir.
         *  - Eğer seçili değilse hepsini seçiyoruz.
         *  - "Soru Getir" butonuna tıklıyoruz.
         *  - Sorular yüklendikten sonra window.print() ile PDF akışı başlatıyoruz.
         */
        val escapedTitle = testAdi.replace("'", "\\'")

        val js = """
            (function() {
                try {
                    // 1. Tüm kazanım checkboxlarını seç
                    document.querySelectorAll('input[type="checkbox"]')
                        .forEach(function(cb) { cb.checked = true; });

                    // 2. "Soru Getir" butonunu bul ve tıkla
                    var btn = document.querySelector(
                        'a[href*="Soru"], button[onclick*="soru"], .soru-getir-btn, .btn-primary'
                    );
                    if (btn) btn.click();

                    // 3. Sorular yüklendikten sonra yazdır
                    setTimeout(function() {
                        document.title = '$escapedTitle';
                        window.print();
                    }, 4000);

                } catch(e) {
                    console.error('OGM inject hatası:', e);
                }
            })();
        """.trimIndent()

        webView.evaluateJavascript(js) { _ ->
            startPrintJob(webView, testAdi, call)
        }
    }

    private fun startPrintJob(webView: WebView, testAdi: String, call: PluginCall) {
        try {
            val printManager =
                activity.getSystemService(Context.PRINT_SERVICE) as PrintManager

            val jobName = "$testAdi — OGM"
            val printAdapter = webView.createPrintDocumentAdapter(jobName)

            val attributes = PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setResolution(
                    PrintAttributes.Resolution("ogm_pdf", "OGM Test PDF", 600, 600)
                )
                .setMinMargins(PrintAttributes.Margins(
                    /* left   */ 500,   // ~1.27 cm sol
                    /* top    */ 500,
                    /* right  */ 500,
                    /* bottom */ 500
                ))
                .build()

            val printJob = printManager.print(jobName, printAdapter, attributes)

            // Kullanıcıya dialog gösterildi, işin takibini JS tarafına bildir
            val result = JSObject().apply {
                put("success",  true)
                put("jobId",    printJob.id)
                put("message",  "PDF yazdırma iletişim kutusu açıldı. " +
                                 "\"PDF olarak kaydet\" seçerek indirin.")
            }
            call.resolve(result)

        } catch (e: Exception) {
            call.reject("PDF oluşturulamadı: ${e.message}", e)
        } finally {
            // WebView'ı temizle
            printWebView?.destroy()
            printWebView = null
        }
    }
}
