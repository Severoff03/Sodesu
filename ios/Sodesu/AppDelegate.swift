import UIKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        SodesuNotifications.shared.configure()
        let lastOpen = SodesuActivity.shared.markActive()
        SodesuNotifications.shared.requestAuthorizationAndSchedule(lastOpen: lastOpen)
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
}

final class SodesuActivity {
    static let shared = SodesuActivity()
    private let lastOpenKey = "souda.lastOpen"

    private init() {}

    @discardableResult
    func markActive(now: Date = Date()) -> Date {
        UserDefaults.standard.set(now.timeIntervalSince1970, forKey: lastOpenKey)
        return now
    }

    func lastOpenDate() -> Date? {
        let lastOpen = UserDefaults.standard.double(forKey: lastOpenKey)
        guard lastOpen > 0 else { return nil }
        return Date(timeIntervalSince1970: lastOpen)
    }

    func daysSinceLastOpen(now: Date = Date()) -> Int {
        guard let lastOpen = lastOpenDate() else { return 0 }
        let interval = now.timeIntervalSince(lastOpen)
        return max(0, Int(interval / 86_400))
    }
}

final class SodesuNotifications {
    static let shared = SodesuNotifications()

    private let center = UNUserNotificationCenter.current()
    private let dailyId = "souda.daily"
    private let missId = "souda.miss"
    private let missMessages = [
        "ルパちゃんが寂しがってるよ… (Рупа-чан скучает по тебе)",
        "今日も一緒に頑張ろう？ルパちゃんより",
        "ちょっとだけでも復習しない？ ルパちゃんが応援してる！"
    ]

    private init() {}

    func configure() {
        center.delegate = UIApplication.shared.delegate as? UNUserNotificationCenterDelegate
    }

    func requestAuthorizationAndSchedule(lastOpen: Date = Date()) {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] granted, _ in
            guard granted else { return }
            self?.scheduleDailyNotifications(lastOpen: lastOpen)
        }
    }

    func scheduleDailyNotifications(lastOpen: Date = Date()) {
        center.removePendingNotificationRequests(withIdentifiers: [dailyId, missId])
        scheduleDailyStudyReminder()
        scheduleMissReminder(after: lastOpen)
    }

    private func scheduleDailyStudyReminder() {
        let content = UNMutableNotificationContent()
        content.title = "今日の一言 · そうです"
        content.body = "Сегодня можно повторить пару карточек."
        content.sound = .default

        var date = DateComponents()
        date.hour = 10
        date.minute = 0

        let trigger = UNCalendarNotificationTrigger(dateMatching: date, repeats: true)
        let request = UNNotificationRequest(identifier: dailyId, content: content, trigger: trigger)
        center.add(request)
    }

    private func scheduleMissReminder(after lastOpen: Date) {
        let content = UNMutableNotificationContent()
        content.title = "ルパちゃん"
        content.body = missMessages.randomElement() ?? missMessages[0]
        content.sound = .default

        let calendar = Calendar.current
        let twoDaysLater = calendar.date(byAdding: .day, value: 2, to: lastOpen) ?? lastOpen.addingTimeInterval(172_800)
        var date = calendar.dateComponents([.year, .month, .day], from: twoDaysLater)
        date.hour = 10
        date.minute = 5

        var fireDate = calendar.date(from: date) ?? twoDaysLater
        if fireDate < twoDaysLater {
            fireDate = calendar.date(byAdding: .day, value: 1, to: fireDate) ?? twoDaysLater
        }

        let triggerDate = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: triggerDate, repeats: false)
        let request = UNNotificationRequest(identifier: missId, content: content, trigger: trigger)
        center.add(request)
    }
}
