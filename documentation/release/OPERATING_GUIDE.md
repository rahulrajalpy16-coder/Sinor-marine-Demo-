# Sinor Marine Vessel Systems Simulator 1.0.1: install, operation and troubleshooting

The simulator runs with **no internet connection**. Everything it needs is on the pendrive. There is nothing to
install on Windows, on a Mac (Apple Silicon) and on Android TV the app is installed once from the pendrive. The offline
versions have the same features and the same look as the online version.

## 1. What is on the pendrive

| Folder | Contents |
|---|---|
| `Mac` | The Mac app (`Sinor Marine Simulator.zip`), `Install on this Mac.command`, `Start Exhibition Demo.command` and `READ_ME_MAC.txt` |
| `Windows` | The portable Windows app (folder `Sinor Marine Simulator`) and two start files |
| `Android_TV` | `SinorMarine-1.0.0.apk` and the TV install steps |
| `Documentation` | This guide, the demo sequence, release notes, the engineering register, test results |
| `Version_Information` | Version, build date, source commit, signing certificate fingerprint |
| `CHECKSUMS.sha256` | SHA-256 of every file, to check the copy is complete |

Use a pendrive of at least 1 GB. USB 3 is recommended; from a slow USB 2 stick the first start can take a minute.

## 2. Mac (Apple Silicon: M1, M2, M3 or M4, macOS 11 or newer)

1. Copy the folder `Mac` from the pendrive to the Mac, for example to Downloads. (The app cannot run from the
   pendrive itself, because pendrives formatted for Windows and Mac do not keep the links the Mac app needs.)
2. In that folder, Control-click **`Install on this Mac.command`**, choose **Open**, then **Open** again. If macOS
   offers only *Done* or *Move to Bin*, open **System Settings > Privacy & Security**, click **Open Anyway** next to
   the message about the file, and try again.
3. A Terminal window shows the steps: the app is copied to **Applications**, prepared for this Mac, and started.
4. Afterwards start **Sinor Marine Simulator** from Launchpad or Applications. For a stand, double-click
   **`Start Exhibition Demo.command`**: full screen, the demo loops on its own.

Why the install step: the app is not notarised by Apple (that needs a paid Apple developer account). The install file
uses only Apple's own built-in tools (`ditto`, `xattr`, `codesign`) to unpack the app, remove the "downloaded from the
internet" flag and sign the app for this Mac only. It downloads nothing and sends nothing anywhere. An Intel Mac is
not supported by this package.

Keys on a Mac: **Ctrl+Cmd+F** or **F11** full screen on or off, **Esc** close the open panel or leave the demo,
**Cmd+R** reload, **Cmd+Q** quit. Saved scenarios and settings stay on the Mac, in the user's Library folder.

## 3. Windows (Windows 10 or 11, 64-bit)

1. Plug in the pendrive and open it in File Explorer.
2. Open `Windows`, then double-click **`Start Sinor Marine Simulator.bat`** (or open the folder
   `Sinor Marine Simulator` and double-click `Sinor Marine Simulator.exe`).
3. For a stand or a TV screen, use **`Start Exhibition Demo.bat`**: full screen, the demo loops on its own.

The first time, Windows may show *"Windows protected your PC"* (Microsoft Defender SmartScreen), because the program
is not code-signed. Choose **More info**, check that the app name is *Sinor Marine Simulator*, then **Run anyway**.
This only allows this one program; do not turn SmartScreen or antivirus off. A code-signing certificate would remove
this message (see Release notes).

Keys on Windows: **F11** full screen on or off, **Esc** close the open panel or leave the demo, **Ctrl+R** reload,
**Ctrl+Q** quit.

Saved scenarios and settings are written to `Windows\Sinor Marine Simulator\SinorMarineData` on the pendrive, so they
go with the pendrive to the next PC. If the pendrive is write-protected the app still runs and saves to the
Windows user profile instead.

## 4. Android TV (Android 7.0 or newer, also Google TV)

Android TV cannot run an app straight from a USB drive, so the app is installed once, offline, from the pendrive.

1. Plug the pendrive into the TV or TV box.
2. Open a file manager app on the TV and open the pendrive, then the `Android_TV` folder.
   Many TVs have one built in. If yours has none, a file manager (for example *X-plore File Manager*) has to be added
   once from Google Play, or by the TV's IT administrator, before the exhibition.
3. Select `SinorMarine-1.0.0.apk`. The TV asks to allow installs from this file manager: open **Settings**, allow it
   for that app only, go back and select **Install**.
4. If Google Play Protect asks to scan the app, you can let it; the app has no internet permission.
5. The app appears in the TV's app row as **Sinor Marine Simulator** with the Sinor banner.

The app has no internet permission at all; it cannot connect to any network.

### TV remote

| Button | Action |
|---|---|
| Arrows (D-pad) | Move the yellow focus ring between buttons and lists |
| OK / Enter | Press the focused button |
| Back | Close the open panel, then the open system, then the guide. On the main view, Back leaves the app |
| On-screen camera pad (bottom right) | Rotate and zoom the 3D view |

## 5. Running all day

* While the simulator is open the screen does not go to sleep, and the 3D view keeps full speed even when another
  window is in front.
* If the page or the graphics ever crash, or the page stops responding for 20 seconds, the simulator reloads itself
  within a few seconds with the same start options, so a running exhibition demo starts again on its own.
* Keep the laptop on its charger. Mac: **System Settings > Battery > Options**, turn on *Prevent automatic sleeping
  on power adapter when the display is off*, and keep the lid open (or use an external display). Windows:
  **Settings > System > Power**, Power mode *Best performance*.
* For a television, connect the laptop with an HDMI cable. Samsung televisions (Tizen) cannot install the app.

## 6. Using the simulator

* **Systems list** (left): choose a system, or click it in the 3D view. The camera flies to it and the details panel
  opens with *Operate*, *How it works* and *Specifications*.
* **Power & Electrical**: the PMS screen (single line diagram, generators, switchboard, loads, DP power, alarms,
  trends, faults), the generators, switchboards, emergency generator and the DP UPS.
* **Heading & Wind Sensors**: wind sensors (measured wind kept separate from the real wind), gyrocompasses and MRUs.
* **⚙ Simulator** (bottom bar):
  * **Reset all** puts everything back to the start, from any state: blackout, faults, frozen, demo.
  * **Freeze / Run** stops and continues the whole simulation. **Speed** 1×, 5×, 10×, 20×.
  * **Training scenarios** set up a situation and inject a fault (generator trip, blackout, busbar fault, UPS on
    battery, wind sensor failure, gyro drift).
  * **Saved on this device**: name and save the current moment, load it later. Damaged saved data is reported and set
    aside; it never stops the app.
  * **Start exhibition demo**: loops through the scenarios with captions. **Exit demo** button, **Esc** or **Back**
    stops it and resets the simulator.
* Alarms always show a symbol and text as well as a colour (▲ alarm, ◆ warning, ● normal).

## 7. Troubleshooting

| Symptom | What to do |
|---|---|
| Mac: "cannot be opened" or "is damaged" | Run `Install on this Mac.command` again (section 2). Another way: open Terminal, type `bash `, drag the file into the window, press Return |
| Mac: "This Mac has an Intel processor" | This package is for Apple Silicon Macs only; use the Windows package on a PC, or the online version |
| Windows: nothing happens on double-click | Wait up to a minute on a slow pendrive. Check that the whole `Windows` folder was copied (compare with `CHECKSUMS.sha256`) |
| Windows: SmartScreen message | More info, then Run anyway (section 2) |
| Windows: black or very slow 3D | The PC has no working graphics driver; the app falls back to software drawing. Set *Quality* to *low* in the top bar, or update the graphics driver |
| Windows: saves are not kept | The pendrive is write-protected or full; saves go to the user profile of that PC |
| Android TV: *App not installed* | Free some storage on the TV; if an older Sinor Marine Simulator signed differently is installed, uninstall it first |
| Android TV: APK not visible in the file manager | Use a file manager that can open APK files; the pendrive must be FAT32 or exFAT |
| Android TV: the remote does not move the focus | Press an arrow key once to show the focus ring |
| The simulator is in a strange state | ⚙ Simulator, then **Reset all** |
| Check the files are intact | Windows PowerShell: `Get-FileHash -Algorithm SHA256 <file>` and compare with `CHECKSUMS.sha256` |
