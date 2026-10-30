plugins { id("com.android.application") }

// Test builds are signed with one fixed key so new APKs install over older ones.
// Before a public release, set CMG_KEYSTORE_FILE / CMG_KEYSTORE_PASSWORD / CMG_KEY_ALIAS / CMG_KEY_PASSWORD
// (GitHub Actions secrets) to sign with a private key instead of this committed test key.
val keystoreFile = System.getenv("CMG_KEYSTORE_FILE")?.let { file(it) } ?: rootProject.file("signing/cammicgo-test.jks")

android {
  namespace = "com.cammicgo.kamikoseo"
  compileSdk = 35
  defaultConfig { applicationId = "com.cammicgo.kamikoseo"; minSdk = 26; targetSdk = 35; versionCode = 4; versionName = "0.3.1" }
  signingConfigs {
    create("cammicgo") {
      storeFile = keystoreFile
      storePassword = System.getenv("CMG_KEYSTORE_PASSWORD") ?: "cammicgo-test"
      keyAlias = System.getenv("CMG_KEY_ALIAS") ?: "cammicgo-test"
      keyPassword = System.getenv("CMG_KEY_PASSWORD") ?: "cammicgo-test"
    }
  }
  buildTypes { getByName("debug") { signingConfig = signingConfigs.getByName("cammicgo") } }
}
