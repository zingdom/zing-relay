#!/usr/bin/env bash

set -e
trap times EXIT

{ # this ensures the entire script is downloaded #

if [[ $(id -u) -ne 0 ]] ; then echo "Please run as root" ; echo ; exit 1 ; fi

echomsg() { echo; echo "[INSTALLER] # $@" ; }
echoexec() { echo ; echo "[INSTALLER] \$ $@" ; "$@" ; }

zing_do_install() {
	local __TMP_DIR="/tmp/zing.install"
	local __BLUEZ_VERSION="5.44"
	local __NVM_VERSION="0.33.1"
	local __BLUETOOTH_CFG="/etc/systemd/system/bluetooth.target.wants/bluetooth.service"

	echoexec apt update
	echoexec apt full-upgrade -y

	# install dependencies for the bluetooth driver
	echoexec apt install -y libusb-dev \
							libdbus-1-dev \
							libglib2.0-dev \
							libudev-dev \
							libical-dev \
							libreadline-dev

	# download and build bluez
	echoexec mkdir -p "${__TMP_DIR}"
	echoexec wget -O "${__TMP_DIR}/bluez-${__BLUEZ_VERSION}.tar.xz" http://www.kernel.org/pub/linux/bluetooth/bluez-${__BLUEZ_VERSION}.tar.xz
	echoexec cd "${__TMP_DIR}"
	echoexec tar xvf bluez-${__BLUEZ_VERSION}.tar.xz
	echoexec cd bluez-${__BLUEZ_VERSION}
	echoexec ./configure --enable-deprecated
	echoexec make
	echoexec make install

	# setup/overwrite existing systemd unit
	echoexec systemctl stop bluetooth
	echoexec cp /usr/local/libexec/bluetooth/bluetoothd /usr/lib/bluetooth/
	echoexec cp /usr/local/libexec/bluetooth/obexd /usr/lib/bluetooth/

	# add --experimental flag to enable BLE
	if grep -xq "ExecStart=.*\/bluetoothd\s*\-\-experimental" "$__BLUETOOTH_CFG"
	then
		echomsg "bluetoothd already using '--experimental' flag"
	else
		echoexec sed -i '/^ExecStart=.*\/bluetoothd\s*$/ s/$/ --experimental/' "$__BLUETOOTH_CFG" \
				|| exit -1
	fi

	echoexec systemctl daemon-reload
	echoexec systemctl start bluetooth

	# done with root stuff, continue as the calling user, presuambly 'pi'
	echomsg "continuing installation as '${SUDO_USER}'"

su ${SUDO_USER} <<'EOF_EOF_EOF'
	set -e

	echomsg() { echo; echo "[installer] # $@" ; }

	echomsg "installing nvm..."
	wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash
	export NVM_DIR="$HOME/.nvm"
	[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

	echomsg "installing Node.js..."
	nvm install --lts node

	echomsg "give Node.js permission to access bluetooth..."
	sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

	echomsg "installing zing-relay..."
	npm install -g zing-relay

EOF_EOF_EOF
	
	echomsg "done, reboot to complete the installation"
	echo
}

[ "_$ZING_ENV" = "_testing" ] || zing_do_install

} # this ensures the entire script is downloaded #
