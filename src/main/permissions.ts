import { systemPreferences, shell, desktopCapturer } from 'electron'

export interface PermissionStatus {
  accessibility: boolean
  screenRecording: boolean
}

export function checkPermissions(): PermissionStatus {
  return {
    accessibility: systemPreferences.isTrustedAccessibilityClient(false),
    screenRecording: systemPreferences.getMediaAccessStatus('screen') === 'granted',
  }
}

export function openAccessibilitySettings(): void {
  shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
  )
}

export async function openScreenRecordingSettings(): Promise<void> {
  // Calling getSources() registers the app with macOS and triggers the
  // permission prompt — without this the app never appears in the list.
  try {
    await desktopCapturer.getSources({ types: ['screen'] })
  } catch {
    // Expected to fail if permission is denied; that's fine
  }
  shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  )
}

export function allGranted(status: PermissionStatus): boolean {
  return status.accessibility && status.screenRecording
}
