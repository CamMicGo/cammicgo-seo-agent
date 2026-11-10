plugins { id("com.android.application") }

// Test builds are signed with one fixed key so new APKs install over older ones.
// Before a public release, set CMG_KEYSTORE_FILE / CMG_KEYSTORE_PASSWORD / CMG_KEY_ALIAS / CMG_KEY_PASSWORD
// (GitHub Actions secrets) to sign with a private key instead of this committed test key.
val keystoreFile = System.getenv("CMG_KEYSTORE_FILE")?.let { file(it) } ?: rootProject.file("signing/cammicgo-test.jks")

android {
  namespace = "com.cammicgo.kamikoseo"
  compileSdk = 35
  defaultConfig {
    applicationId = "com.cammicgo.kamikoseo"; minSdk = 26; targetSdk = 35; versionCode = 47; versionName = "0.7.0"
    // sherpa-onnx native libraries: phones (64 and 32 bit ARM) and the x86_64 emulator.
    ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
  }
  compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
  packaging { jniLibs { useLegacyPackaging = false } }
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

dependencies {
  implementation("androidx.core:core:1.13.1")
  // On-device speech recognition (Qwen3-ASR through sherpa-onnx, Apache-2.0).
  implementation("com.github.k2-fsa.sherpa-onnx:sherpa-onnx:v2.0.1")
  implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.24")
  // bzip2 + tar, to unpack the model archive while it downloads.
  implementation("org.apache.commons:commons-compress:1.24.0")
  testImplementation("junit:junit:4.13.2")
}
