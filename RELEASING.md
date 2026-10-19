# Локальные выпуски Sodesu

Версия хранится в `version.properties`. Перед сборкой запишите реальные изменения в локальном `UPDATE.txt`.

- `Build Releases.exe -EarlyAccess` (или `Build Release.exe -EarlyAccess`) — следующий patch, увеличение versionCode, lint, сборка и проверка APK. Папка: `releases/vX.Y.Z/`.
- `Public Release.exe` — commit разрешённых исходников, push и GitHub Release последнего локального выпуска. Early Access публикуется как prerelease.
- `Build Releases.exe -ValidateOnly -EarlyAccess` — проверка окружения без сборки.
- `Public Release.exe -ReleaseDirectory releases/vX.Y.Z` — повтор публикации после сетевого сбоя без новой сборки.

Сборка требует JDK 17–21 (подходит JBR Android Studio), Gradle 8.7 и Android SDK 34. Для нестандартных путей: `-JavaHome`, `-GradlePath`, `-AndroidSdk`.

Early Access подписывается существующим локальным `.android/debug.keystore`; сертификат проверяется относительно предыдущего APK. Для обычного выпуска нужен постоянный release-keystore через переменные `SODESU_KEYSTORE_FILE`, `SODESU_KEYSTORE_PASSWORD`, `SODESU_KEY_ALIAS`, `SODESU_KEY_PASSWORD` или локальный `android/key.properties`. Ключи и пароли не публикуются.

Для GitHub выполните `gh auth login`. Загрузчик передаёт только APK и UPDATE.txt; журналы и release.json остаются локально. При ошибке текст изменений сохраняется. Приложение и инструменты сами не запускают публикацию без действий пользователя.
