## Setup a **ZING** Relay on Raspberry Pi

The following instructions has been extensively tested on [Raspberry Pi 3 Model B](https://www.raspberrypi.org/products/raspberry-pi-3-model-b/) and [Pi Zero Wireless](https://www.raspberrypi.org/products/pi-zero-wireless/), both using the embedded WiFi & Bluetooth hardware. This should also work on older models with supported external wireless adapters.

### Step-by-Step Instructions

1. Install [Raspbian Jessie Lite](https://www.raspberrypi.org/downloads/raspbian/)   
(as of this writing, the latest available is kernel version 4.4)

1. Boot & Login   
default username: `pi`  
default password: `raspberry`

1. Perform Basic Setup
	<pre>
	pi@raspberrypi:~ $ <strong>sudo raspi-config</strong>
	</pre>
	1. Update localization settings to your specific region, e.g. from `GB` to `US`
		- locale
		- keyboard
		- wifi
		- etc...
	1. Reboot  
	   (... verify locale settings)
	1. Change default password for user `pi`  
	   (make sure you do this after changing the keyboard locale)
	1. Enabled SSH Server

1. Setup Wifi  
	- Edit the [WPA supplicant](http://w1.fi/wpa_supplicant/) configuration file
		<pre>
		pi@raspberrypi:~ $ <strong>sudo nano /etc/wpa_supplicant/wpa_supplicant.conf</strong>
		</pre>
	- Add your wifi credentials to the end of the file, in the form of
		<pre>
		network={
			ssid="<strong>&lt;YOUR SSID&gt;</strong>"
			psk="<strong>&lt;YOUR PSK&gt;</strong>"
		}
		</pre>
	- Reboot  
	  (... verify network connectivity)

1. Update Installed Packages & Firmware
	<pre>
	pi@raspberrypi:~ $ <strong>sudo apt update</strong>
	pi@raspberrypi:~ $ <strong>sudo apt full-upgrade</strong>
	pi@raspberrypi:~ $ <strong>sudo apt install -y rpi-update</strong>
	pi@raspberrypi:~ $ <strong>sudo rpi-update</strong>
	</pre>
	- Reboot  
	(the Pi may hang at this point -- black screen with flashing green ACTI led, simply power cycle if that happens)

1. Install bluez from source
	- Install Dependencies
	<pre>
	pi@raspberrypi:~ $ <strong>sudo apt install -y \
			libusb-dev \
			libdbus-1-dev \
			libglib2.0-dev \
			libudev-dev \
			libical-dev \
			libreadline-dev</strong>
	</pre>

		```bash
		$
		```
	- Download the latest version of bluez (v5.44) from http://www.bluez.org/download/

			$ wget http://www.kernel.org/pub/linux/bluetooth/bluez-5.44.tar.xz
			$ tar xvf bluez-5.44.tar.xz
			$ cd bluez-5.44
			$ ./configure
			$ make
			$ sudo make install

	- Enable full Bluetooth LE support by
	editing `bluetooth.service` and add `–experimental` flag to `bluetoothd` service
		```bash
		$ sudo nano \
	    	/etc/systemd/system/bluetooth.target.wants/bluetooth.service
		```
	- the edited line should look like:
		<pre>
		...
		ExecStart=/usr/local/libexec/bluetooth/bluetoothd <strong>--experimental</strong>
		...
		</pre>
reindex the systemd units and reboot


1. Install Node.js
		$ curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
		$ sudo apt install -y nodejs
		$ node -v
		$ sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
