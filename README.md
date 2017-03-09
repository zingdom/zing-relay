## Installation

### Raspberry Pi

The following step-by-step instructions has been extensively tested on [Raspberry Pi 3 Model B](https://www.raspberrypi.org/products/raspberry-pi-3-model-b/) and [Pi Zero Wireless](https://www.raspberrypi.org/products/pi-zero-wireless/), both using the embedded WiFi & Bluetooth hardware. This should also work on older models with supported external wireless adapters.

1. Install [Raspbian Jessie Lite](https://www.raspberrypi.org/downloads/raspbian/)   
(we are using kernel version 4.4)

1. Boot

1. Login   
default username: `pi`  
password: `raspberry`

1. Basic Setup  

		$ sudo raspi-config

	- Change all localization options from GB to US
		- locale
		- keyboard
		- wifi
		- etc...
	- Enabled SSH
	- Reboot

1. Setup Wifi
	- Change default password for user pi  
	  (make sure you do this after changing the keyboard locale)
> `$ sudo nano /etc/wpa_supplicant/wpa_supplicant.conf`

	- Add wifi access point info in the form of
	  ```
	  network={
		ssid="<SSID>"
		psk="<PSK>"
	  }```
	- Reboot & verify connected to WiFi

1. Update Installed Packages & Firmware
	```
	$ sudo apt update
	$ sudo apt full-upgrade
	$ sudo apt install -y rpi-update
	$ sudo rpi-update
	```
- Reboot
the computer may hang at this point (black screen with flashing green led) – just power cycle
Install bluez from source
Download the latest version (v5.44) from http://www.bluez.org/download/
$ sudo apt install -y \
	    libusb-dev \
	    libdbus-1-dev \
	    libglib2.0-dev \
	    libudev-dev \
	    libical-dev \
	    libreadline-dev
	$ wget http://www.kernel.org/pub/linux/bluetooth/bluez-5.44.tar.xz
	$ tar xvf bluez-5.44.tar.xz
	$ cd bluez-5.44
	$ ./configure
	$ make
	$ sudo make install
Enable Bluetooth LE
edit bluetooth.service and add –experimental flag to the service executable /usr/local/libexec/bluetooth/bluetoothd
$ sudo nano \
	    /etc/systemd/system/bluetooth.target.wants/bluetooth.service
the edited line should look like:
...
	ExecStart=/usr/local/libexec/bluetooth/bluetoothd --experimental
	...
reindex the systemd units and reboot
$ sudo systemctl daemon-reload
	$ sudo reboot
Install Node.js
		$ curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
		$ sudo apt install -y nodejs
		$ node -v
		$ sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
