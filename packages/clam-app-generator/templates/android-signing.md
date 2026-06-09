# Android signing for generated apps

The keystore is **never** committed and **never** baked into the disposable
`build.gradle`. It's injected at build time via Gradle properties, so it works
unchanged against a freshly regenerated project:

```sh
cd .generated/<app>/android
./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file="$ANDROID_KEYSTORE" \
  -Pandroid.injected.signing.store.password="$ANDROID_KEYSTORE_PASSWORD" \
  -Pandroid.injected.signing.key.alias="$ANDROID_KEY_ALIAS" \
  -Pandroid.injected.signing.key.password="$ANDROID_KEY_PASSWORD"
```

In CI the keystore comes from a base64 secret decoded to `$ANDROID_KEYSTORE`.
With **Play App Signing**, this is only the *upload* key — Google holds the real
app signing key.
