import UIKit
import WebKit

final class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(self, name: "sodesu")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadBundledApp()
    }

    deinit {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "sodesu")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "sodesu" else { return }

        if let body = message.body as? [String: Any],
           let type = body["type"] as? String,
           type == "setActive" {
            let lastOpen = SodesuActivity.shared.markActive()
            SodesuNotifications.shared.scheduleDailyNotifications(lastOpen: lastOpen)
        }
    }

    private func loadBundledApp() {
        guard let wwwURL = Bundle.main.url(forResource: "www", withExtension: nil),
              let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") else {
            showMissingBundleError()
            return
        }

        webView.loadFileURL(indexURL, allowingReadAccessTo: wwwURL)
    }

    private func showMissingBundleError() {
        let html = """
        <!doctype html>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <body style="font-family:-apple-system;padding:24px;background:#0b0e1a;color:#eef1ff">
          <h1>そうです</h1>
          <p>Не найден bundled каталог www.</p>
        </body>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}
